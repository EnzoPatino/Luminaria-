#!/usr/bin/env python3
"""Envía un uplink de prueba con el formato del webhook HTTP de ChirpStack.

Este script prueba el receptor de Luminaria directamente; no inyecta el uplink
en ChirpStack ni lo muestra en la consola de esa plataforma. Escribe en el tablero
seleccionado y puede crear o resolver una alerta, por lo que pide confirmación.
"""

import base64
import getpass
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


DEFAULT_URL = "https://luminarias.neuquencapital.gob.ar/api/uplink?event=up"
TIMEOUT_HTTP = 10


def normalizar_url(value):
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"

    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("Usá una URL HTTP(S) válida.")

    path = parts.path.rstrip("/") or "/api/uplink"
    if path != "/api/uplink":
        raise ValueError("La URL debe ser el dominio o terminar en /api/uplink.")

    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("event", "up")
    return urlunsplit((parts.scheme, parts.netloc, path, urlencode(query), ""))


def construir_payload(application_name, tablero, sobrecorriente):
    corriente_ma = 75 if sobrecorriente else 25
    payload_binario = corriente_ma.to_bytes(2, byteorder="big", signed=False)
    return {
        "deduplicationId": str(uuid.uuid4()),
        "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "deviceInfo": {
            "applicationName": application_name,
            "deviceName": tablero,
            "devEui": uuid.uuid4().hex[:16],
        },
        "fPort": 1,
        "fCnt": int(time.time()) % 65536,
        "data": base64.b64encode(payload_binario).decode("ascii"),
        "object": {
            "corriente_mA": corriente_ma,
            "fase": "L1",
        },
        "rxInfo": [{"gatewayId": "demo-gateway", "rssi": -85, "snr": 7.5}],
    }


def enviar(url, token, payload):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-ChirpStack-Token": token,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_HTTP) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, body


def main():
    try:
        url = normalizar_url(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL)
    except ValueError as exc:
        print(f"URL inválida: {exc}", file=sys.stderr)
        return 2

    print(f"Destino: {url}")
    print("El simulador envía un uplink HTTP; no crea un mensaje en ChirpStack.")

    tablero = input("Tablero destino [TABLERO_01]: ").strip().upper() or "TABLERO_01"
    if tablero not in {f"TABLERO_{number:02d}" for number in range(1, 5)}:
        print("El tablero debe ser TABLERO_01, TABLERO_02, TABLERO_03 o TABLERO_04.", file=sys.stderr)
        return 2

    application_name = input("Nombre de la aplicación ChirpStack [Simulador]: ").strip() or "Simulador"
    tipo = input("Lectura [N]ormal (25 mA) o [S]obrecorriente (75 mA) (defecto N): ").strip().lower()
    sobrecorriente = tipo == "s"
    print(f"AVISO: se escribirá una medición en {tablero}; esto puede crear o resolver una alerta real.")
    if input(f"Para confirmar, escribí ENVIAR A {tablero}: ").strip().upper() != f"ENVIAR A {tablero}":
        print("Prueba cancelada.")
        return 0

    token = getpass.getpass("CHIRPSTACK_WEBHOOK_TOKEN: ").strip()
    if not token:
        print("El token no puede estar vacío.", file=sys.stderr)
        return 2

    payload = construir_payload(application_name, tablero, sobrecorriente)
    try:
        status, body = enviar(url, token, payload)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"No se pudo conectar: {getattr(exc, 'reason', exc)}", file=sys.stderr)
        return 1

    print(f"HTTP {status}")
    try:
        print(json.dumps(json.loads(body), ensure_ascii=False, indent=2))
    except json.JSONDecodeError:
        print(body)

    if status != 200:
        return 1
    if sobrecorriente:
        print(f"Uplink enviado. Buscá la alerta SOBRECORRIENTE de {tablero} en el historial.")
    else:
        print(f"Uplink enviado. La lectura normal de {tablero} puede resolver una alerta activa de sobrecorriente.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
