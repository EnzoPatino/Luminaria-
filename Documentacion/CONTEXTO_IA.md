# Contexto Tecnico para Asistentes de IA

**Project Luminaria - Sistema de Monitoreo y Alertas Electricas**  
**Directorio:** `Documentacion/CONTEXTO_IA.md`  
**Actualizado:** Agosto 2026

---

## 1. Estado Real del Proyecto

El repositorio contiene una aplicacion web estatica hecha con HTML, CSS y JavaScript vanilla. No hay backend, base de datos, Docker Compose ni API REST implementados actualmente.

La UI consume eventos MQTT mediante Paho MQTT por WebSockets. Si no puede conectarse a Mosquitto o no esta disponible la libreria Paho, activa modo simulacion y procesa eventos localmente.

---

## 2. Mapa de Archivos

```text
Project_Luminaria/
|-- index.html
|-- css/
|   `-- styles.css
|-- js/
|   |-- app.js
|   `-- mqtt-client.js
|-- Documentacion/
|   |-- DOCUMENTACION_TECNICA.md
|   |-- CONTEXTO_IA.md
|   |-- DOCUMENTACION_TECNICA_DRAFT(1).md
|   `-- Reporte_MQTT_Pasantias_EPET20_corregido.docx
|-- README.md
`-- README_MQTT_UI.md
```

No introducir frameworks ni toolchains de build sin pedido explicito. El estilo actual es app estatica navegable directamente desde `index.html`.

---

## 3. Arquitectura Frontend

### `index.html`

Define:

- header institucional;
- estado de conexion MQTT;
- botones **Simulador**, **Servidor** y sonido;
- banner general de estado;
- barra de KPIs;
- tabs `tableros`, `mapa`, `alertas`, `consola`;
- modal de configuracion MQTT;
- modal de simulacion.

### `css/styles.css`

Usa variables CSS en `:root`, tema oscuro, estados semaforo y media queries responsive. Mantener el enfoque de CSS vanilla.

### `js/mqtt-client.js`

Expone `window.luminariaMQTT`, instancia de `LuminariaMQTTClient`.

Responsabilidades:

- cargar y guardar configuracion en `localStorage` con clave `luminaria_mqtt_config`;
- conectar con Paho MQTT por WebSockets;
- suscribirse a topics configurados;
- publicar eventos reales o simulados;
- notificar estado, logs y mensajes mediante callbacks.

Configuracion por defecto:

```js
{
  host: 'localhost',
  port: 9001,
  path: '/mqtt',
  topics: ['neuquen/iluminacion/#', 'api/evento'],
  qos: 1
}
```

### `js/app.js`

Mantiene `appState` dentro de `DOMContentLoaded`.

Campos principales:

- `selectedTableroId`
- `tableros`
- `alerts`
- `activeFilter`
- `soundEnabled`

Funciones relevantes:

- `setupTabNavigation()`
- `setupEventListeners()`
- `setupSimulationPresets()`
- `setupMqttCallbacks()`
- `processIncomingEvent(event)`
- `renderTablerosGrid()`
- `renderAlerts()`
- `renderMapPins()`
- `updateKPIs()`
- `playAlertAudioSound(type)`
- `escapeHtml(str)`

### Mapa de Zonas (estructura a respetar)

```html
<div class="map-svg-wrapper">   <!-- position: relative; height: 240px (200px en movil) -->
  <svg width="100%" height="100%" viewBox="0 0 800 240" preserveAspectRatio="none">...</svg>
  <div class="map-pins-layer" id="mapPinsContainer">...</div>
</div>
```

- `#mapPinsContainer` (.map-pins-layer) usa `position: absolute` y **debe permanecer dentro** de `.map-svg-wrapper`, unico ancestro con `position: relative`. Moverlo fuera desancla los pines del mapa (bug visual en movil).
- Los pines se generan en `renderMapPins()` con `left/top` porcentuales (`posX`/`posY` del tablero) y se centran con `translate(-50%, -50%)`.
- En movil (max-width: 560px) las etiquetas limitan a `max-width: 92px` y permiten salto de linea; no reintroducir `white-space: nowrap` sin garantizar que no se recorten en los bordes.

---

## 4. Tableros Iniciales

La UI inicia con:

- `TABLERO_01`: EPET 14 / EPET 20, Aula Taller 3 - Planta Baja, fase `L1`.
- `TABLERO_02`: Parque Norte, Parque Norte - Sector Canchas, fase `L2`.
- `TABLERO_03`: Paseo de la Costa, Paseo de la Costa - Rio Limay, fase `L3`.
- `TABLERO_04`: Avenida Argentina, Av. Argentina y Monolito, fase `L1`.

Los focos usan ids como `FOCO_A1`, `FOCO_B1`, `FOCO_C1`, etc. El estado de foco reconocido por la UI es `ok`, `robado` o `quemado`.

---

## 5. Contrato JSON que No Debe Romperse

### `BAJA_TENSION`

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

### `DESCONEXION_ABRUPTA_FOCO`

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

### `FOCO_QUEMADO`

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

### `TELEMETRIA_NORMAL`

```json
{
  "tipo_evento": "TELEMETRIA_NORMAL",
  "id_tablero": "TABLERO_01",
  "timestamp": "2026-08-14T12:00:00Z",
  "datos": {
    "tension_medida_v": 220.0,
    "tension_nominal_v": 220.0,
    "fase": "L1",
    "focos_restaurados": ["FOCO_A3", "FOCO_B1"]
  },
  "severidad": "INFO",
  "ubicacion": "Aula Taller 3 - Planta Baja"
}
```

---

## 6. Reglas de Diagnostico Visual

- `BAJA_TENSION`: tablero critico si `tension_medida_v < 190.0`.
- `DESCONEXION_ABRUPTA_FOCO`: foco queda en estado `robado`; tablero critico.
- `FOCO_QUEMADO`: foco queda en estado `quemado`; tablero en advertencia salvo que exista estado critico.
- `TELEMETRIA_NORMAL`: restaura tension y focos indicados, o todos los focos si no se envia `focos_restaurados`.
- Las alertas no resueltas tambien influyen en KPIs, banner y mapa.

---

## 7. Reglas para Modificaciones Futuras

1. Mantener JavaScript y CSS vanilla salvo instruccion explicita.
2. No cambiar nombres de claves JSON ya coordinadas con hardware.
3. Preservar el modo simulacion.
4. Preservar `escapeHtml()` o una sanitizacion equivalente al renderizar datos recibidos.
5. Validar sintaxis antes de entregar:

```bash
node -c js/app.js
node -c js/mqtt-client.js
```

6. Si se agrega backend, documentarlo como implementado solo despues de crear sus archivos reales.
7. No mover `#mapPinsContainer` fuera de `.map-svg-wrapper`; el anclaje de los pines depende de ese contenedor relativo.
