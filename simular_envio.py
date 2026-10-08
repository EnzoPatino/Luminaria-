#!/usr/bin/env python3
"""Simulador interactivo de telemetría para Luminaria.

Uso: python3 simular_envio.py [SERVER_IP|URL]
En la TTY, elegir tablero y alerta con las teclas indicadas y alternarla con la
misma tecla. La telemetría normal se envía continuamente a todos los tableros.
"""

import curses
import json
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone


SERVER_URL = sys.argv[1] if len(sys.argv) > 1 else "http://192.168.148.4/api/eventos"
if not SERVER_URL.startswith(("http://", "https://")):
    SERVER_URL = f"http://{SERVER_URL}/api/eventos"

TABLEROS = [
    {"id": "TABLERO_01", "nombre": "Centro / Palacio Municipal", "fase": "L1"},
    {"id": "TABLERO_02", "nombre": "Parque Norte", "fase": "L2"},
    {"id": "TABLERO_03", "nombre": "Paseo de la Costa", "fase": "L3"},
    {"id": "TABLERO_04", "nombre": "Avenida Argentina", "fase": "L1"},
]

# Umbrales operativos para la simulación normal (tensión nominal: 220 V).
TENSION_NORMAL = (217.0, 223.0)
CORRIENTE_NORMAL = (4.0, 8.5)
INTERVALO_ENVIO = 2.0
TIMEOUT_HTTP = 2


def evento(tablero, tipo):
    """Construye una medición y su payload para un tablero."""
    if tipo == "BAJA_TENSION":
        tension = round(random.uniform(160.0, 188.0), 1)
        corriente = round(random.uniform(2.0, 6.0), 1)
        severidad = "CRITICA"
        datos = {
            "tension_medida_v": tension,
            "tension_nominal_v": 220.0,
            "umbral_minimo_v": 190.0,
            "corriente_medida_ma": corriente * 1000,
            "corriente_actual_ma": corriente * 1000,
            "fase": tablero["fase"],
            "rssi_lora": -random.randint(65, 105),
            "estado_conexion": "ONLINE",
        }
    elif tipo == "FOCO_QUEMADO":
        tension = round(random.uniform(216.0, 224.0), 1)
        corriente = round(random.uniform(0.1, 0.4), 1)
        severidad = "ADVERTENCIA"
        datos = {
            "id_foco": "FOCO_02",
            "corriente_esperada_ma": 450.0,
            "corriente_medida_ma": corriente * 1000,
            "duracion_anomalia_s": 30,
            "estado_circuito": "ACTIVO",
            "tension_medida_v": tension,
            "tension_nominal_v": 220.0,
            "fase": tablero["fase"],
            "rssi_lora": -random.randint(65, 105),
            "estado_conexion": "ONLINE",
        }
    elif tipo == "DESCONEXION_ABRUPTA_FOCO":
        tension = round(random.uniform(*TENSION_NORMAL), 1)
        corriente = round(random.uniform(0.0, 0.1), 1)
        severidad = "CRITICA"
        datos = {
            "id_foco": "FOCO_02",
            "corriente_previa_ma": round(random.uniform(400.0, 500.0), 1),
            "corriente_actual_ma": corriente * 1000,
            "tiempo_caida_ms": random.randint(20, 250),
            "estado_circuito": "INACTIVO",
            "tension_medida_v": tension,
            "tension_nominal_v": 220.0,
            "fase": tablero["fase"],
            "rssi_lora": -random.randint(65, 105),
            "estado_conexion": "ONLINE",
        }
    else:
        tipo = "TELEMETRIA_NORMAL"
        tension = round(random.uniform(*TENSION_NORMAL), 1)
        corriente = round(random.uniform(*CORRIENTE_NORMAL), 1)
        severidad = "INFO"
        datos = {
            "tension_medida_v": tension,
            "tension_nominal_v": 220.0,
            "corriente_medida_ma": corriente * 1000,
            "corriente_actual_ma": corriente * 1000,
            "fase": tablero["fase"],
            "rssi_lora": -random.randint(65, 105),
            "estado_conexion": "ONLINE",
        }

    payload = {
        "tipo_evento": tipo,
        "id_tablero": tablero["id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "datos": datos,
        "severidad": severidad,
        "ubicacion": tablero["nombre"],
    }
    return payload, tension, corriente


def enviar(payload):
    req = urllib.request.Request(
        SERVER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_HTTP) as response:
        return f"HTTP {response.getcode()}"


def dibujar(stdscr, valores, alertas, estados, ultimo_envio, mensaje):
    stdscr.erase()
    alto, ancho = stdscr.getmaxyx()

    def linea(y, texto):
        if 0 <= y < alto:
            stdscr.addnstr(y, 0, texto, max(0, ancho - 1))

    linea(0, "LUMINARIA | Simulador interactivo de telemetría")
    linea(1, f"Destino: {SERVER_URL}")
    linea(2, "Normal: tensión 217–223 V, corriente 4.0–8.5 A (umbral de baja tensión: 190 V)")
    linea(3, "Teclas: 1–4 seleccionan tablero; b = baja tensión, f = foco quemado, d = desconexión abrupta; misma tecla alterna.")
    linea(4, "q = salir. Las mediciones se envían a todos los tableros cada 2 s.")
    linea(6, f"{'TABLERO':<13} {'ESTADO':<18} {'TENSIÓN':>9} {'CORRIENTE':>12}  ÚLTIMO ENVÍO")
    linea(7, "─" * min(ancho - 1, 105))
    for i, tablero in enumerate(TABLEROS):
        medicion = valores.get(i, ("—", "—"))
        tipo = alertas.get(i, "NORMAL")
        estado = estados.get(i, "Esperando…")
        linea(8 + i, f"{tablero['id']:<13} {tipo:<18} {str(medicion[0] + ' V'):>9} {str(medicion[1] + ' A'):>12}  {estado}")
    linea(13, f"Tablero seleccionado: {TABLEROS[ultimo_envio]['id']}")
    linea(14, f"{mensaje}" if mensaje else "")
    stdscr.refresh()


def ejecutar(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.keypad(True)
    seleccion = 0
    alertas = {}  # índice de tablero -> tipo de alerta activa
    valores, estados = {}, {}
    mensaje = "Conectando…"
    siguiente_envio = 0.0

    while True:
        tecla = stdscr.getch()
        if tecla in (ord("q"), ord("Q"), 27):
            break
        if ord("1") <= tecla <= ord("4"):
            seleccion = tecla - ord("1")
            mensaje = f"Seleccionado {TABLEROS[seleccion]['id']}"
        elif tecla in (ord("b"), ord("B"), ord("f"), ord("F"), ord("d"), ord("D")):
            if tecla in (ord("b"), ord("B")):
                tipo = "BAJA_TENSION"
            elif tecla in (ord("f"), ord("F")):
                tipo = "FOCO_QUEMADO"
            else:
                tipo = "DESCONEXION_ABRUPTA_FOCO"
            if alertas.get(seleccion) == tipo:
                del alertas[seleccion]
                mensaje = f"{TABLEROS[seleccion]['id']}: vuelve a medición normal"
            else:
                alertas[seleccion] = tipo
                mensaje = f"{TABLEROS[seleccion]['id']}: alerta activa {tipo}"

        ahora = time.monotonic()
        if ahora >= siguiente_envio:
            # Enviar un evento por tablero en cada ciclo; el panel conserva una fila fija por tablero.
            for i, tablero in enumerate(TABLEROS):
                tipo = alertas.get(i, "TELEMETRIA_NORMAL")
                payload, tension, corriente = evento(tablero, tipo)
                valores[i] = (f"{tension:.1f}", f"{corriente:.1f}")
                try:
                    estados[i] = enviar(payload)
                except urllib.error.HTTPError as exc:
                    # HTTPError es también URLError: leer su body evita ocultar
                    # el detalle que devuelve la API detrás de "Internal Server Error".
                    detalle = exc.read().decode("utf-8", errors="replace").strip()
                    estados[i] = f"ERROR HTTP {exc.code}"
                    mensaje = f"{tablero['id']}: {detalle or exc.reason}"
                except (urllib.error.URLError, TimeoutError, OSError) as exc:
                    detalle = getattr(exc, "reason", exc)
                    estados[i] = "ERROR de conexión"
                    mensaje = f"{tablero['id']}: {detalle}"
            siguiente_envio = time.monotonic() + INTERVALO_ENVIO

        dibujar(stdscr, valores, alertas, estados, seleccion, mensaje)
        time.sleep(0.05)


if __name__ == "__main__":
    try:
        curses.wrapper(ejecutar)
    except KeyboardInterrupt:
        pass
    except curses.error as exc:
        print(f"No se pudo iniciar la interfaz TTY: {exc}. Ejecuta el programa en una terminal interactiva.", file=sys.stderr)
