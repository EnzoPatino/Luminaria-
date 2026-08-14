# Contexto Tecnico para Asistentes de Inteligencia Artificial

**Project Luminaria — Sistema de Monitoreo y Alertas Eléctricas**
*Documento de Contexto y Reglas de Desarrollo para Modelos de Lenguaje (LLM) y Agentes IA*
*Directorio de Referencia: `/Documentacion/CONTEXTO_IA.md`*

---

## 1. Identidad y Dominio del Proyecto

Este documento establece el contexto tecnico, la arquitectura de archivos y los contratos de datos de **Project Luminaria**, un proyecto interescolar desarrollado entre **EPET N.º 14** (hardware/sensores) y **EPET N.º 20** (software/backend/UI) para la **Municipalidad de Neuquén**.

### Objetivo
Monitorear en tiempo real tableros de alumbrado publico y detectar tres tipos de anomalias:
1. `BAJA_TENSION`: Caida de tension de la red por debajo de 190.0 V.
2. `DESCONEXION_ABRUPTA_FOCO`: Caida instantanea de corriente a 0.0 mA (< 200 ms) por posible robo o desconexion.
3. `FOCO_QUEMADO`: Consumo anomalo sostenido (< 20% del valor esperado durante mas de 10 segundos).

---

## 2. Mapa de Archivos del Repositorio

Cualquier modificacion o asistencia generada por la IA debe respetar la siguiente estructura:

```
Project_Luminaria/
├── index.html                    # UI principal (HTML5 estatico semantico)
├── css/
│   └── styles.css                # Sistema de diseño Vanilla CSS (Dark Industrial Glassmorphism)
├── js/
│   ├── mqtt-client.js            # Cliente WebSocket Paho MQTT y gestor de modo simulación
│   └── app.js                    # Estado global de UI, renderizado de medidores y audio WebAudio
├── Documentacion/
│   ├── DOCUMENTACION_TECNICA.md    # Documentacion tecnica detallada para humanos
│   ├── CONTEXTO_IA.md            # Este archivo (Instrucciones y contexto para IA)
│   └── DOCUMENTACION_TECNICA_DRAFT(1).md # Borrador de arquitectura inicial
├── README.md                     # README principal sin emojis
└── README_MQTT_UI.md             # Manual de integracion MQTT sin emojis
```

---

## 3. Contratos de Datos y Esquemas JSON Estrictos

Al generar scripts de prueba, funciones de validacion o endpoints de backend, la IA debe utilizar **exactamente** las siguientes claves y tipos de datos:

### 3.1 Evento: Baja Tension (`BAJA_TENSION`)
```json
{
  "tipo_evento": "BAJA_TENSION",
  "id_tablero": "string (ej: TABLERO_01)",
  "timestamp": "string ISO 8601 (ej: 2025-06-10T14:32:05Z)",
  "datos": {
    "tension_medida_v": "float (ej: 185.3)",
    "tension_nominal_v": "float (ej: 220.0)",
    "umbral_minimo_v": "float (ej: 190.0)",
    "fase": "string (L1 | L2 | L3 | MONOFASICA)"
  },
  "severidad": "string (CRITICA | ADVERTENCIA | INFO)",
  "ubicacion": "string"
}
```

### 3.2 Evento: Desconexion Abrupta / Robo (`DESCONEXION_ABRUPTA_FOCO`)
```json
{
  "tipo_evento": "DESCONEXION_ABRUPTA_FOCO",
  "id_tablero": "string",
  "timestamp": "string ISO 8601",
  "datos": {
    "id_foco": "string (ej: FOCO_A3)",
    "corriente_previa_ma": "float (ej: 450.0)",
    "corriente_actual_ma": "float (ej: 0.0)",
    "tiempo_caida_ms": "integer (ej: 85)",
    "estado_circuito": "string (ACTIVO | INACTIVO)"
  },
  "severidad": "CRITICA",
  "ubicacion": "string"
}
```

### 3.3 Evento: Foco Quemado (`FOCO_QUEMADO`)
```json
{
  "tipo_evento": "FOCO_QUEMADO",
  "id_tablero": "string",
  "timestamp": "string ISO 8601",
  "datos": {
    "id_foco": "string (ej: FOCO_B1)",
    "corriente_esperada_ma": "float (ej: 450.0)",
    "corriente_medida_ma": "float (ej: 12.5)",
    "duracion_anomalia_s": "integer (ej: 30)",
    "estado_circuito": "string (ACTIVO | INACTIVO)"
  },
  "severidad": "ADVERTENCIA",
  "ubicacion": "string"
}
```

---

## 4. Reglas de Negocio y Logica de Diagnostico

Al modificar la logica de analisis en el backend o frontend, aplique rigurosamente estas condiciones:

1. **Criterio de Baja Tension**:
   - `tension_medida_v < 190.0` → Evento `BAJA_TENSION`, Severidad `CRITICA`.
2. **Criterio de Desconexion Abrupta / Robo**:
   - `tiempo_caida_ms < 200` Y `estado_circuito == "ACTIVO"` Y `corriente_actual_ma == 0.0` → Evento `DESCONEXION_ABRUPTA_FOCO`, Severidad `CRITICA`.
3. **Criterio de Foco Quemado**:
   - `corriente_medida_ma < (corriente_esperada_ma * 0.2)` Y `duracion_anomalia_s >= 10` Y `estado_circuito == "ACTIVO"` → Evento `FOCO_QUEMADO`, Severidad `ADVERTENCIA`.

---

## 5. Arquitectura del Frontend y Estado Global

La interfaz esta construida en **Vanilla JS** sin dependencias de frameworks React/Vue/Angular.

### Variables de Estado en `js/app.js`
- `appState.selectedTableroId`: Almacena el ID del tablero visible (ej: `'TABLERO_01'`).
- `appState.tableros`: Objeto dinamico indexado por ID de tablero que contiene ubicacion, tension y la lista de focos con sus lecturas en mA.
- `appState.alerts`: Array que almacena el historial de eventos recibidos.
- `window.luminariaMQTT`: Singleton de la clase `LuminariaMQTTClient` (definida en `js/mqtt-client.js`).

### Manejo de Conexiones en `js/mqtt-client.js`
- El cliente intenta conectarse vía WebSockets al host configurado (por defecto `localhost`, puerto `9001`, path `/mqtt`).
- Si la libreria Paho MQTT no se puede conectar o falla el socket, el cliente conmuta de forma transparente al **Modo Simulación** (`isSimulationMode = true`), permitiendo la emision local de eventos desde los botones del modal de prueba.

---

## 6. Especificacion del Backend API y Base de Datos PostgreSQL

Si se solicitan modificaciones al backend (Python FastAPI o Node.js Express):

### Tabla PostgreSQL: `alertas`
```sql
CREATE TABLE alertas (
  id            SERIAL PRIMARY KEY,
  id_tablero    VARCHAR(20) REFERENCES tableros(id),
  tipo_evento   VARCHAR(50)  NOT NULL,
  severidad     VARCHAR(20)  NOT NULL,
  payload_raw   JSONB        NOT NULL,
  ubicacion     TEXT,
  resuelta      BOOLEAN DEFAULT FALSE,
  creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Endpoints REST Estandar
- `POST /api/evento`: Recibe el JSON del evento, lo guarda en la tabla `alertas` y responde `{"status": "ok", "id_alerta": "ALR-xxx"}`.
- `GET /api/alertas`: Retorna las ultimas 50 alertas ordenadas por fecha de creacion descendente.

---

## 7. Instrucciones Directas para Agentes de IA

Cualquier modelo de IA que trabaje sobre este proyecto **debe cumplir las siguientes normas**:

1. **Sin Emojis en Documentacion y Codigo**: No incluir emoticones o emojis en comentarios de codigo, commits o archivos Markdown (`.md`). Toda la documentacion debe mantenerse tecnica, sobria y profesional.
2. **Preservar Vanilla JavaScript y CSS**: No introducir librerias externas pesadas (como React, Vue, Tailwind, Bootstrap) a menos que el usuario lo solicite explicitamente.
3. **Mantenimiento del Modo Simulación**: No eliminar el fallback de simulación local en `mqtt-client.js`. La UI siempre debe ser capaz de funcionar fuera de linea sin un broker Mosquitto activo.
4. **Verificacion Sintactica**: Antes de concluir un cambio, validar el HTML y JS utilizando scripts de prueba o comandos de terminal (`node -c js/app.js`).
5. **Respetar Nombres de Claves en JSON**: Nunca cambiar nombres de propiedades como `tension_medida_v`, `corriente_previa_ma` o `tiempo_caida_ms`, ya que romperia el contrato de datos con el hardware del ESP32 diseñado por la EPET N.º 14.
