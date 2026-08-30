# Manual de Integracion Frontend y Mosquitto MQTT

**Project Luminaria — Municipalidad de Neuquén**

---

## 1. Introduccion

Este documento describe la integracion entre la interfaz de usuario (UI) desarrollada en HTML, CSS y JavaScript nativo y el broker de mensajeria **Mosquitto MQTT**. 

La interfaz permite visualizar la telemetria enviada por los microcontroladores (ESP32) instalados en los tableros electricos y mostrar alertas inmediatas cuando se detectan anomalias de tension o fallas en las luminarias.

---

## 2. Requisitos de Red y Protocolo

MQTT utiliza TCP/IP como transporte base. Dado que los navegadores web no pueden abrir sockets TCP nativos directos a puertos como el 1883, la comunicacion entre la UI y Mosquitto se realiza mediante **WebSockets**.

### Puertos Estandar
- **1883**: Puerto TCP sin cifrar para dispositivos de campo (ESP32, gateways LoRa).
- **9001**: Puerto WebSocket sin cifrar para clientes web (UI en navegador).
- **8883**: Puerto TCP cifrado con TLS.
- **8083**: Puerto WebSocket cifrado o alternativo.

---

## 3. Configuracion de Mosquitto (`mosquitto.conf`)

Para permitir que la interfaz web se conecte al servidor Mosquitto, el archivo de configuracion del broker debe incluir la siguiente definicion de listeners:

```ini
# Configuración global
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log

# Listener 1: Puerto nativo MQTT para hardware y gateways
listener 1883
protocol mqtt
allow_anonymous true

# Listener 2: Puerto WebSockets para la interfaz Web UI
listener 9001
protocol websockets
allow_anonymous true
```

### Ejecucion con Docker Compose
```yaml
version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:latest
    container_name: luminaria_broker
    restart: always
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
```

---

## 4. Estructura de Payloads JSON

Todos los eventos enviados a traves del topic `api/evento` o sub-topics bajo `neuquen/iluminacion/#` deben respetar el formato JSON especificado.

### 4.1 Evento: Baja Tension en Red (`BAJA_TENSION`)
Se emite cuando la tension en la red de 220V cae por debajo del umbral de 190V.

```json
{
  "tipo_evento": "BAJA_TENSION",
  "id_tablero": "TABLERO_01",
  "timestamp": "2025-06-10T14:32:05Z",
  "datos": {
    "tension_medida_v": 185.3,
    "tension_nominal_v": 220.0,
    "umbral_minimo_v": 190.0,
    "fase": "L1"
  },
  "severidad": "CRITICA",
  "ubicacion": "Centro / Palacio Municipal"
}
```

### 4.2 Evento: Desconexion Abrupta / Robo de Foco (`DESCONEXION_ABRUPTA_FOCO`)
Se emite cuando la corriente cae a 0 mA en menos de 200 ms mientras el circuito permanece activo.

```json
{
  "tipo_evento": "DESCONEXION_ABRUPTA_FOCO",
  "id_tablero": "TABLERO_01",
  "timestamp": "2025-06-10T15:10:22Z",
  "datos": {
    "id_foco": "FOCO_A3",
    "corriente_previa_ma": 450.0,
    "corriente_actual_ma": 0.0,
    "tiempo_caida_ms": 85,
    "estado_circuito": "ACTIVO"
  },
  "severidad": "CRITICA",
  "ubicacion": "Pasillo Principal - Luminaria 3"
}
```

### 4.3 Evento: Foco Quemado (`FOCO_QUEMADO`)
Se emite cuando la corriente medida se mantiene significativamente baja (por debajo del 20% del valor esperado) durante mas de 10 segundos.

```json
{
  "tipo_evento": "FOCO_QUEMADO",
  "id_tablero": "TABLERO_01",
  "timestamp": "2025-06-10T16:45:00Z",
  "datos": {
    "id_foco": "FOCO_B1",
    "corriente_esperada_ma": 450.0,
    "corriente_medida_ma": 12.5,
    "duracion_anomalia_s": 30,
    "estado_circuito": "ACTIVO"
  },
  "severidad": "ADVERTENCIA",
  "ubicacion": "Laboratorio de Electronica - Luminaria 1"
}
```

---

## 5. Modo Simulacion Integrado

La UI incluye un simulador local que emite estos mismos eventos JSON directamente a traves de la logica interna de JavaScript cuando no hay una conexion activa con Mosquitto. Esto permite validar el correcto funcionamiento de la interfaz y la respuesta visual ante anomalias durante el desarrollo o demostraciones tecnicas.
