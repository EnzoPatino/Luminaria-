# 🔌 Project Luminaria — UI Web de Monitoreo Eléctrico

**Proyecto interescolar EPET 14 × EPET 20 — Municipalidad de Neuquén**
`UI Frontend` · `Preparada para MQTT / Mosquitto` · `HTML + CSS + JS`

---

## 📌 Resumen

Esta interfaz web fue diseñada siguiendo las especificaciones de la **Documentación Técnica (Draft v0.2)** y la **Guía de Estudio MQTT**. Es una aplicación **liviana, responsiva y de alto rendimiento**, desarrollada en HTML5, CSS3 vanilla y JavaScript moderno.

Permite a los técnicos y estudiantes monitorear en tiempo real los tableros eléctricos, el voltaje de la red y el estado individual de cada luminaria/foco.

---

## ⚡ Características Principales

1. **Dashboard de Telemetría Eléctrica**:
   - Medidor analógico/digital de voltaje de red con indicación de umbral crítico (< 190V).
   - Matriz de luminarias (`FOCO_A1`, `FOCO_A2`, etc.) con monitoreo de consumo en miliamperios (mA) e indicadores LED de estado.
2. **Recepción de Alertas en Tiempo Real**:
   - ⚡ `BAJA_TENSION` (CRÍTICA - Rojo): Caída de voltaje en la red eléctrica.
   - 🚨 `DESCONEXION_ABRUPTA_FOCO` (CRÍTICA - Rojo): Robo o desconexión física abrupta de un foco (< 200ms).
   - 💡 `FOCO_QUEMADO` (ADVERTENCIA - Amarillo): Falla por consumo anómalo prolongado.
   - 🟢 `TELEMETRIA_NORMAL` (INFO - Verde): Red y componentes restablecidos.
3. **Integración con Mosquitto MQTT**:
   - Conexión vía **WebSockets** usando la librería Paho MQTT.
   - Configuración de Host, Puerto (9001/8083), Path, ID de Cliente y Topics (`neuquen/iluminacion/#`, `api/evento`).
4. **Modo Simulación Integrado (EPET 14 Hardware Mock)**:
   - Incluye un simulador con 1-click para probar los 3 casos de uso documentados sin necesidad de tener un broker Mosquitto encendido o el hardware ESP32 conectado.
5. **Consola e Inspector MQTT**:
   - Log visual en tiempo real de todos los mensajes recibidos y transmitidos.
6. **Alertas Sonoras y Visuales**:
   - Sintetizador de audio nativo WebAudio API para avisos acústicos diferenciados ante alertas críticas.

---

## 🚀 Cómo Ejecutar la UI

### Opción 1: Abrir directamente en el navegador (Sin servidor)
Simplemente hace doble clic en [index.html](file:///home/ale/Documentos/BACK/Project_Luminaria/index.html) o ábrelo en cualquier navegador web (Chrome, Firefox, Edge, Safari). La UI arrancará en **Modo Simulación** automáticamente si no detecta Mosquitto activo.

### Opción 2: Usar un servidor HTTP simple de desarrollo
Si deseas servir la app mediante HTTP:
```bash
npx serve /home/ale/Documentos/BACK/Project_Luminaria
# O usando Python:
python3 -m http.server 8080 --directory /home/ale/Documentos/BACK/Project_Luminaria
```
Luego abre en el navegador: `http://localhost:8080`

---

## 📡 Configuración del Broker Mosquitto con WebSockets

Para conectar la UI con un servidor Mosquitto real en Linux / Docker / Windows:

### 1. Configurar `mosquitto.conf`
Asegúrate de habilitar el listener de WebSockets en tu archivo de configuración de Mosquitto:

```ini
# mosquitto.conf
listener 1883
protocol mqtt

# Listener para WebSockets (Usado por esta UI Web)
listener 9001
protocol websockets
allow_anonymous true
```

### 2. Ejecutar Mosquitto con Docker
```bash
docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 \
  -v /path/to/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  eclipse-mosquitto
```

### 3. Conectar en la UI
1. Presiona el botón **"Broker MQTT"** en la barra superior de la UI.
2. Configura:
   - **Host**: `localhost` (o la IP de la máquina/servidor)
   - **Puerto WebSocket**: `9001`
   - **Topics**: `neuquen/iluminacion/#, api/evento`
3. Haz clic en **"Conectar a Mosquitto"**.

---

## 📦 Estructura del JSON de los Eventos (EPET 14 → Mosquitto/API → UI)

### 1. Baja Tensión
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
  "ubicacion": "Aula Taller 3 - Planta Baja"
}
```

### 2. Desconexión Abrupta / Robo de Foco
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

### 3. Foco Quemado
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
  "ubicacion": "Laboratorio de Electrónica - Luminaria 1"
}
```

---

## 🛠 Estructura de Archivos del Frontend

```
Project_Luminaria/
├── index.html               # Estructura principal y componentes visuales
├── css/
│   └── styles.css           # Tema Dark Industrial Glassmorphism y diseño responsivo
├── js/
│   ├── mqtt-client.js       # Manejador del cliente Mosquitto WebSocket / Paho
│   └── app.js               # Lógica de renderizado, medidores, alertas y audio
└── README_MQTT_UI.md        # Documentación de uso e integración Mosquitto
```
