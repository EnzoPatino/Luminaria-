# Manual de Integracion Frontend y Mosquitto MQTT

**Project Luminaria — Municipalidad de Neuquén**

---

## 1. Introduccion

Este documento describe la integracion entre la interfaz de usuario (UI) desarrollada en HTML, CSS y JavaScript nativo y el broker de mensajeria **Mosquitto MQTT**. 

La interfaz permite visualizar la telemetria enviada por los microcontroladores (ESP32) instalados en los tableros electricos y mostrar alertas inmediatas cuando se detectan anomalias de tension o fallas en las luminarias.

---

## 2. Red, autenticación y permisos

Compose mantiene los puertos 1883 (MQTT TCP) y 9001 (WebSockets) en la red
privada de Docker. El panel se conecta a `/mqtt` por WSS a través de Caddy; no
expongas esos puertos directamente a Internet. Mosquitto rechaza conexiones
anónimas y aplica los permisos declarados en `deploy/mosquitto/aclfile`.

Compose genera los hashes bcrypt para `backend_worker`, `web_dashboard` y
`esp32_writer` desde secretos únicos del `.env`. El backend puede publicar y
leer; el panel solo puede leer; los dispositivos pueden publicar telemetría.
El panel pide su usuario y contraseña desde **Servidor** y conserva la clave
solo en memoria. Si se conecta hardware directamente por MQTT, configurá un
listener cifrado con TLS y una regla de firewall antes de publicar un puerto.
La opción recomendada en esta instalación es enviar telemetría por el webhook
HTTPS autenticado de ChirpStack.

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

## 5. Disponibilidad de conexión

La interfaz requiere una conexión activa con Mosquitto para recibir mensajes. Si el broker no está disponible, el estado MQTT aparece desconectado y el cliente reintenta automáticamente; los mensajes no se procesan localmente.
