#!/usr/bin/env python3
"""Simulador interactivo de telemetría para Luminaria.

Uso: python3 simular_envio.py [https://DOMINIO/api/simulacion]
Al iniciar, confirmar el destino e ingresar el email y la contraseña de una
cuenta administradora. En la TTY, elegir tablero y alerta con las teclas indicadas.
Envía telemetría a cuatro tableros cada dos segundos; presionar q para parar.
"""

import curses
import getpass
import json
import random
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit, urlunsplit
from datetime import datetime, timezone


DEFAULT_SERVER_URL = "https://luminarias.neuquencapital.gob.ar/api/simulacion"
SERVER_INPUT = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SERVER_URL


def normalizar_url(valor):
    if not valor.startswith(("http://", "https://")):
        esquema = "http" if valor.startswith(("127.0.0.1", "localhost", "192.168.")) else "https"
        valor = f"{esquema}://{valor}"

    partes = urlsplit(valor)
    if partes.scheme not in ("http", "https") or not partes.netloc:
        raise ValueError("Usá una URL HTTP(S) válida o una IP/nombre de servidor.")

    ruta = partes.path.rstrip("/")
    if not ruta:
        ruta = "/api/simulacion"
    elif not ruta.endswith("/api/simulacion"):
        raise ValueError("La URL debe ser el dominio o terminar en /api/simulacion.")

    return urlunsplit((partes.scheme, partes.netloc, ruta, "", ""))


try:
    SERVER_URL = normalizar_url(SERVER_INPUT)
except ValueError as exc:
    print(f"URL inválida: {exc}", file=sys.stderr)
    sys.exit(2)

API_BASE_URL = SERVER_URL.removesuffix("/simulacion")

TABLEROS = [
    {"id": "DEMO_TABLERO_01", "nombre": "DEMO / Centro", "fase": "L1"},
    {"id": "DEMO_TABLERO_02", "nombre": "DEMO / Parque Norte", "fase": "L2"},
    {"id": "DEMO_TABLERO_03", "nombre": "DEMO / Paseo de la Costa", "fase": "L3"},
    {"id": "DEMO_TABLERO_04", "nombre": "DEMO / Avenida Argentina", "fase": "L1"},
]

# Rangos de simulación: los módulos reportan corriente, expresada en mA.
CORRIENTE_NORMAL_MA = (1000.0, 2500.0)
INTERVALO_ENVIO = 2.0
TIMEOUT_HTTP = 5


def evento(tablero, tipo):
    """Construye una medición y su payload para un tablero."""
    rssi = -random.randint(65, 105)
    if tipo == "SOBRECORRIENTE":
        corriente = round(random.uniform(2501.0, 3500.0), 1)
        severidad = "CRITICA"
        datos = {
            "corriente_medida_ma": corriente,
            "corriente_actual_ma": corriente,
            "umbral_maximo_ma": 2500.0,
            "fase": tablero["fase"],
            "rssi_lora": rssi,
            "estado_conexion": "ONLINE",
        }
    elif tipo == "FOCO_QUEMADO":
        corriente = round(random.uniform(0.0, 5.0), 1)
        severidad = "ADVERTENCIA"
        datos = {
            "id_foco": "FOCO_02",
            "corriente_esperada_ma": 2500.0,
            "corriente_medida_ma": corriente,
            "duracion_anomalia_s": 30,
            "estado_circuito": "ACTIVO",
            "fase": tablero["fase"],
            "rssi_lora": rssi,
            "estado_conexion": "ONLINE",
        }
    elif tipo == "DESCONEXION_ABRUPTA_FOCO":
        corriente = round(random.uniform(0.0, 5.0), 1)
        severidad = "CRITICA"
        datos = {
            "id_foco": "FOCO_02",
            "corriente_previa_ma": round(random.uniform(1000.0, 2500.0), 1),
            "corriente_actual_ma": corriente,
            "tiempo_caida_ms": random.randint(20, 250),
            "estado_circuito": "INACTIVO",
            "fase": tablero["fase"],
            "rssi_lora": rssi,
            "estado_conexion": "ONLINE",
        }
    else:
        tipo = "TELEMETRIA_NORMAL"
        corriente = round(random.uniform(*CORRIENTE_NORMAL_MA), 1)
        severidad = "INFO"
        datos = {
            "corriente_medida_ma": corriente,
            "corriente_actual_ma": corriente,
            "fase": tablero["fase"],
            "rssi_lora": rssi,
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
    return payload, corriente


def autenticar(email, password):
    req = urllib.request.Request(
        f"{API_BASE_URL}/auth/login",
        data=json.dumps({"email": email, "password": password}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_HTTP) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode("utf-8"))
            detalle = body.get("message", "")
        except (json.JSONDecodeError, UnicodeDecodeError):
            detalle = ""
        raise RuntimeError(f"Login rechazado (HTTP {exc.code})" + (f": {detalle}" if detalle else "")) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"No se pudo conectar con la API: {getattr(exc, 'reason', exc)}") from exc

    token = body.get("data", {}).get("token")
    if not token:
        raise RuntimeError("La API no devolvió un token de sesión.")
    return token


def enviar(payload, token):
    req = urllib.request.Request(
        SERVER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
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
    linea(2, "Telemetría actual: corriente solamente; rango normal 1000–2500 mA.")
    linea(3, "Teclas: 1–4 seleccionan tablero; s = sobrecorriente, f = foco quemado, d = desconexión; misma tecla alterna.")
    linea(4, "q = salir. Las mediciones se envían a todos los tableros cada 2 s.")
    linea(6, f"{'TABLERO':<18} {'ESTADO':<25} {'CORRIENTE':>12}  ÚLTIMO ENVÍO")
    linea(7, "─" * min(ancho - 1, 105))
    for i, tablero in enumerate(TABLEROS):
        medicion = valores.get(i, "—")
        tipo = alertas.get(i, "NORMAL")
        estado = estados.get(i, "Esperando…")
        linea(8 + i, f"{tablero['id']:<18} {tipo:<25} {str(medicion + ' mA'):>12}  {estado}")
    linea(13, f"Tablero seleccionado: {TABLEROS[ultimo_envio]['id']}")
    linea(14, f"{mensaje}" if mensaje else "")
    stdscr.refresh()


def ejecutar(stdscr, token):
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
        elif tecla in (ord("s"), ord("S"), ord("f"), ord("F"), ord("d"), ord("D")):
            if tecla in (ord("s"), ord("S")):
                tipo = "SOBRECORRIENTE"
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
                payload, corriente = evento(tablero, tipo)
                valores[i] = f"{corriente:.1f}"
                try:
                    estados[i] = enviar(payload, token)
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
        print(f"Destino: {SERVER_URL}")
        print("ATENCIÓN: se crean cuatro tableros DEMO y se envían lecturas cada dos segundos.")
        print("La ruta de simulación requiere cuenta admin; los DEMO se borran tras cinco minutos sin eventos.")
        if input("Para continuar, escribí SI (cualquier otra respuesta cancela): ").strip() != "SI":
            print("Simulación cancelada.")
            sys.exit(0)

        email = input("Email de una cuenta administradora: ").strip()
        password = getpass.getpass("Contraseña: ")
        token = autenticar(email, password)
        password = ""
        print("Sesión iniciada. El token se mantiene solo en memoria; presioná q para detener el envío.")
        curses.wrapper(ejecutar, token)
    except KeyboardInterrupt:
        pass
    except RuntimeError as exc:
        print(f"No se pudo iniciar el simulador: {exc}", file=sys.stderr)
        sys.exit(1)
    except curses.error as exc:
        print(f"No se pudo iniciar la interfaz TTY: {exc}. Ejecuta el programa en una terminal interactiva.", file=sys.stderr)
