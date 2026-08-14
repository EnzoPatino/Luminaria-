# Documentacion Tecnica — Project Luminaria

**Sistema de Monitoreo y Alertas Electricas en Tiempo Real**
*Proyecto interescolar EPET N.º 14 × EPET N.º 20 — Municipalidad de Neuquén*
*Version: 1.0 | Fecha: Junio 2025 / Agosto 2026*

---

## 1. Resumen Ejecutivo y Alcance del Proyecto

El sistema **Project Luminaria** surge como una solucion de ingenieria orientada al mantenimiento eficiente del alumbrado publico en la ciudad de Neuquen (cobertura en Parque Norte, Paseo de la Costa, avenidas principales y plazas). 

El sistema monitorea de forma continua los tableros electricos y luminarias instaladas en campo, detectando e informando tres anomalias criticas:
1. **Baja Tension en la Red**: Caida del voltaje por debajo de los limites operativos de seguridad (190V sobre red nominal de 220V).
2. **Desconexion Abrupta / Robo de Luminaria**: Caida instantanea de corriente (en menos de 200 ms) en un circuito activo.
3. **Foco Quemado o Falla de Componente**: Disminucion severa de corriente sostenida en el tiempo (por debajo del 20% del valor nominal durante mas de 10 segundos).

### Division de Responsabilidades Interescolares
- **EPET N.º 14 (Hardware y Campo)**: Diseño e instalacion de sensores electricos (transformadores de corriente SCT-013, sensores de tension ZMPT101B), acondicionamiento de señal, microcontroladores (ESP32) y transmision de datos mediante radiofrecuencia (LoRa / LoRaWAN) o WiFi.
- **EPET N.º 20 (Software, Backend y Frontend)**: Despliegue de infraestructura de servidores, broker de mensajeria Mosquitto MQTT, API REST, base de datos relacional PostgreSQL y panel de control web (UI).

---

## 2. Arquitectura General del Sistema

El flujo completo de datos sigue la siguiente trayectoria desacoplada:

```
[Sensores de Tension y Corriente]
             │
             ▼
      [Placa ESP32 / EPET 14]
             │
             ▼  (LoRaWAN / WiFi)
      [Gateway / Servidor de Campo]
             │
             ▼  (MQTT TCP 1883)
      [Broker Mosquitto MQTT]
       ├───► (MQTT WS 9001) ───► [Panel Web UI / Tecnico]
       └───► (Subscriber)   ───► [Backend API (FastAPI / Express)]
                                        │
                                        ▼
                                 [PostgreSQL DB]
```

### Componentes de la Arquitectura
- **Broker Mosquitto MQTT**: Actua como el nodo central de mensajeria, desacoplando los dispositivos de campo del consumo de datos.
- **Backend API (EPET 20)**: Servicio encargado de persistir eventos en PostgreSQL, aplicar reglas de diagnostico complejas y servir endpoints REST.
- **Base de Datos PostgreSQL**: Almacenamiento estructurado de tableros, historial de alertas, intervenciones de mantenimiento y metricas.
- **Panel Web (UI Frontend)**: Interfaz responsiva y liviana para monitoreo en tiempo real, operando mediante suscripciones MQTT por WebSockets.

---

## 3. Especificacion de JSON y Contrato de Datos

Todos los mensajes transmitidos a traves del broker MQTT o enviados mediante peticiones HTTP POST responden a una estructura JSON estandarizada.

### 3.1 Evento: Baja Tension (`BAJA_TENSION`)

Se dispara cuando el sensor de tension registra un valor inferior a 190.0 V.

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

| Campo | Tipo | Descripcion |
|---|---|---|
| `tipo_evento` | String | Constante `"BAJA_TENSION"` |
| `id_tablero` | String | Identificador unico del tablero de control (ej: `"TABLERO_01"`) |
| `timestamp` | String ISO 8601 | Marca de tiempo UTC de la medicion |
| `tension_medida_v` | Float | Voltaje real medido en voltios |
| `tension_nominal_v` | Float | Voltaje de referencia de la red (220.0 V) |
| `umbral_minimo_v` | Float | Límite inferior configurable (190.0 V) |
| `fase` | String | Identificador de fase (`"L1"`, `"L2"`, `"L3"`, `"MONOFASICA"`) |
| `severidad` | String | Nivel de severidad (`"CRITICA"`, `"ADVERTENCIA"`, `"INFO"`) |
| `ubicacion` | String | Descripcion geografica o del recinto |

---

### 3.2 Evento: Desconexion Abrupta / Robo de Foco (`DESCONEXION_ABRUPTA_FOCO`)

Se dispara cuando la corriente cae a 0.0 mA de forma repentina (velocidad de caida < 200 ms) mientras el circuito electrico continua activo.

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

| Campo | Tipo | Descripcion |
|---|---|---|
| `id_foco` | String | Identificador unico del foco dentro del tablero (ej: `"FOCO_A3"`) |
| `corriente_previa_ma` | Float | Consumo en mA registrado antes de la caida |
| `corriente_actual_ma` | Float | Consumo actual registrado en mA (normalmente 0.0) |
| `tiempo_caida_ms` | Integer | Tiempo transcurrido durante la caida de corriente en milisegundos |
| `estado_circuito` | String | Estado del rele / alimentacion (`"ACTIVO"` o `"INACTIVO"`) |

---

### 3.3 Evento: Foco Quemado (`FOCO_QUEMADO`)

Se dispara cuando la corriente medida desciende por debajo del 20% del consumo esperado durante mas de 10 segundos continuos.

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

| Campo | Tipo | Descripcion |
|---|---|---|
| `corriente_esperada_ma` | Float | Consumo nominal esperado para la luminaria instalada |
| `corriente_medida_ma` | Float | Consumo real medido por el sensor |
| `duracion_anomalia_s` | Integer | Tiempo en segundos con lectura anomala |

---

## 4. Configuracion de la Infraestructura Backend y Broker

### 4.1 Broker Mosquitto MQTT (`mosquitto.conf`)

Mosquitto debe configurarse con dos listeners independientes: uno en puerto nativo TCP (1883) para la comunicacion con los microcontroladores y gateways, y otro en puerto WebSockets (9001) para la comunicacion con la interfaz web.

```ini
persistence true
persistence_location /mosquitto/data/
log_dest stdout

# Listener TCP para Hardware ESP32 / Gateway
listener 1883
protocol mqtt
allow_anonymous true

# Listener WebSocket para Frontend Web UI
listener 9001
protocol websockets
allow_anonymous true
```

### 4.2 Base de Datos PostgreSQL (Esquema SQL)

```sql
-- Tabla de tableros registrados
CREATE TABLE IF NOT EXISTS tableros (
  id          VARCHAR(20) PRIMARY KEY,
  ubicacion   TEXT NOT NULL,
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de registro de alertas y eventos
CREATE TABLE IF NOT EXISTS alertas (
  id            SERIAL PRIMARY KEY,
  id_tablero    VARCHAR(20) REFERENCES tableros(id),
  tipo_evento   VARCHAR(50)  NOT NULL,
  severidad     VARCHAR(20)  NOT NULL,
  payload_raw   JSONB        NOT NULL,
  ubicacion     TEXT,
  resuelta      BOOLEAN DEFAULT FALSE,
  creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insercion de tableros de prueba iniciales
INSERT INTO tableros (id, ubicacion) 
VALUES ('TABLERO_01', 'Aula Taller 3 - Planta Baja')
ON CONFLICT (id) DO NOTHING;
```

### 4.3 Servicio de Contenedores (`docker-compose.yml`)

```yaml
version: "3.9"

services:
  db:
    image: postgres:15-alpine
    container_name: luminaria_postgres
    restart: always
    environment:
      POSTGRES_USER: epet20
      POSTGRES_PASSWORD: epet20password
      POSTGRES_DB: alertas_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mosquitto:
    image: eclipse-mosquitto:latest
    container_name: luminaria_broker
    restart: always
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf

volumes:
  postgres_data:
```

---

## 5. Especificaciones de la Interfaz Web (UI)

La UI fue construida sin dependencias de compilacion pesadas, garantizando una carga inmediata y facil mantenimiento.

### Estructura de Archivos del Frontend
- `index.html`: Maquetacion HTML5 semantica, accesible y modular.
- `css/styles.css`: Sistema de diseño *Dark Industrial Glassmorphism*, variables CSS adaptativas y media queries para respuesta movil.
- `js/mqtt-client.js`: Modulo encapsulado para la gestion de conexiones WebSockets Paho MQTT con reconexion y modo simulación.
- `js/app.js`: Estado global de la aplicacion, procesamiento de eventos JSON, actualizacion de medidores y sintetizador de audio.

---

## 6. Procedimiento de Verificacion y Pruebas

Para validar el sistema completo sin esperar la conexion fisica del hardware:

1. Levantar la UI abriendo `index.html` en el navegador.
2. Hacer clic en **Simulador EPET 14**.
3. Seleccionar cualquiera de los presets de prueba (`Baja Tension`, `Robo`, `Foco Quemado`, `Normal`).
4. Verificar que:
   - El medidor de tension y la grilla de focos se actualicen dinamicamente.
   - La alerta aparezca en el feed con su nivel de severidad correspondiente.
   - La consola registre la trama JSON.
   - El sintetizador WebAudio genere la señal sonora de advertencia.
