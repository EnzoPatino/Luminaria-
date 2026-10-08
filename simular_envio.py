#!/usr/bin/env python3
"""
Simulador de envío continuo de telemetría a Luminaria (Server remoto)
Uso: python3 simulate_telemetry.py [SERVER_IP]
"""

import sys
import time
import random
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

SERVER_URL = sys.argv[1] if len(sys.argv) > 1 else "http://192.168.148.4/api/eventos"
if not SERVER_URL.startswith("http"):
    SERVER_URL = f"http://{SERVER_URL}/api/eventos"

TABLEROS = [
    {"id": "TABLERO_01", "nombre": "Centro / Palacio Municipal", "fase": "L1"},
    {"id": "TABLERO_02", "nombre": "Parque Norte", "fase": "L2"},
    {"id": "TABLERO_03", "nombre": "Paseo de la Costa", "fase": "L3"},
    {"id": "TABLERO_04", "nombre": "Avenida Argentina", "fase": "L1"},
]

EVENTOS_TIPOS = ["TELEMETRIA_NORMAL", "TELEMETRIA_NORMAL", "TELEMETRIA_NORMAL", "BAJA_TENSION", "FOCO_QUEMADO"]

print(f"[*] Iniciando generador de telemetría hacia: {SERVER_URL}")
print("[*] Presiona Ctrl + C para detener.\n")

while True:
    tablero = random.choice(TABLEROS)
    tipo = random.choice(EVENTOS_TIPOS)

    if tipo == "BAJA_TENSION":
        tension = round(random.uniform(160.0, 188.0), 1)
        corriente = round(random.uniform(2.0, 6.0), 1)
        severidad = "CRITICA"
    elif tipo == "FOCO_QUEMADO":
        tension = round(random.uniform(216.0, 224.0), 1)
        corriente = round(random.uniform(0.1, 0.4), 1)
        severidad = "ADVERTENCIA"
    else:
        tipo = "TELEMETRIA_NORMAL"
        tension = round(random.uniform(217.0, 223.0), 1)
        corriente = round(random.uniform(4.0, 8.5), 1)
        severidad = "INFO"

    payload = {
        "tipo_evento": tipo,
        "id_tablero": tablero["id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "datos": {
            "tension_medida_v": tension,
            "tension_nominal_v": 220.0,
            "corriente_medida_ma": corriente * 1000,
            "fase": tablero["fase"],
            "rssi_lora": - random.randint(65, 105),
            "estado_conexion": "ONLINE"
        },
        "severidad": severidad,
        "ubicacion": tablero["nombre"]
    }

    req = urllib.request.Request(
        SERVER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.getcode()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {tablero['id']} -> {tipo:<18} ({tension}V / {corriente}A) | HTTP {status}")
    except urllib.error.URLError as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Error al conectar con {SERVER_URL}: {e}")

    time.sleep(random.uniform(2.0, 4.0))
