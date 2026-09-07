# Manual del Desarrollador — Guía Operativa

# Proyecto Luminaria — Sistema de Monitoreo y Alertas Eléctricas

**Municipalidad de Neuquén**

Aplicación web para monitoreo en tiempo real de tableros de iluminación pública. El frontend es una aplicación estática (HTML + CSS + JavaScript vanilla) que consume eventos MQTT desde un broker Mosquitto (vía WebSockets) o funciona en **modo simulación**. El backend está implementado en Node.js + Express para gestión de datos y persistencia.

> La documentación detallada de arquitectura se encuentra en `Documentacion/CONTEXTO_TECNICO.md` y `Documentacion/DOCUMENTACION_TECNICA.md`. Este documento resume las guías operativas de desarrollo.

---

## 1. Comandos Comunes

### Ejecutar el Frontend localmente

```bash
# Opción A: abrir index.html directamente en el navegador
# Opción B: servidor HTTP local
python3 -m http.server 8080
# Luego ir a http://localhost:8080
```

### Ejecutar el Backend (Node.js)

```bash
cd backend
npm install
npm start    # Modo producción
npm run dev   # Modo desarrollo (con --watch)
```

### Validar sintaxis JavaScript (si tenés Node)

```bash
node -c js/app.js
node -c js/mqtt-client.js
```

### Levantar Mosquitto (opcional, solo si se quiere probar MQTT real)

```bash
docker compose up -d mosquitto
# WebSocket listener: 9001 — TCP listener: 1883
# Ver README_MQTT_UI.md para mosquitto.conf completo
```

---

## 2. Arquitectura (Big Picture)

### Frontend (Static App)

```
index.html ──► carga css/styles.css + lib Paho MQTT (CDN)
            ──► script anti-flash inline (lee localStorage y aplica data-theme en <html>)
            ──► carga js/mqtt-client.js (define window.luminariaMQTT)
            ──► carga js/app.js (lógica de UI, todo dentro de DOMContentLoaded)
```

**Responsabilidades por archivo:**

- **`index.html`** — Estructura DOM: header institucional, banner de estado, barra de KPIs, 4 tabs (`tableros`, `mapa`, `alertas`, `consola`), modal de config MQTT, modal de simulación. El header incluye un botón `#btnToggleTheme` (icono luna/sol) que alterna el tema. Algunos IDs hidden existen solo por retrocompatibilidad (`#selectTablero`, `#voltageGaugeNum`, etc.).
- **`js/mqtt-client.js`** — Clase `LuminariaMQTTClient` instanciada como `window.luminariaMQTT`. Maneja conexión Paho, suscripción a topics, persistencia en `localStorage` bajo la clave `luminaria_mqtt_config`, y notifica vía 3 callbacks: `onStatusChangeCallback`, `onMessageCallback`, `onLogCallback`. Si Paho no está disponible o la conexión falla, activa **modo simulación** y los `publish()` se procesan internamente como mensajes recibidos.
- **`js/app.js`** — Toda la lógica de UI. Mantiene un objeto `appState` (no global, vive dentro del `DOMContentLoaded`) con `tableros`, `alerts`, `activeFilter`, `soundEnabled`, `selectedTableroId`. Renderiza grilla de tableros, mapa de pines SVG, lista de alertas, KPIs, banner y consola. Procesa eventos MQTT entrantes con `processIncomingEvent()`. Maneja el toggle de tema claro/oscuro con persistencia en `localStorage` clave `luminaria_theme`.
- **`css/styles.css`** — Tema oscuro industrial por defecto (`:root`) y tema claro (`[data-theme="light"]`). Variables CSS en `:root` para todos los colores. Estados semáforo (`ok`, `warning`, `critical`). Responsive con media queries (menú flotante en móvil, mapa de 200px en `max-width: 560px`).

### Backend (Node.js + Express)

```
server.js ──► app.js ──► routes/index.js ──► [healthRoutes, etc.] ──► controllers/ [healthController, etc.]
```

**Responsabilidades por directorio:**

- **`backend/server.js`** — Punto de entrada y bootstrapping del servidor.
- **`backend/src/app.js`** — Configuración de Express, middlewares globales y montaje de rutas (`/api`).
- **`backend/src/config/`** — Gestión de variables de entorno y configuración global.
- **`backend/src/routes/`** — Definición de endpoints y enrutamiento.
- **`backend/src/controllers/`** — Lógica de control de peticiones y respuestas HTTP.
- **`backend/src/services/`** — Lógica de negocio y acceso a datos (capa de servicio).
- **`backend/src/middlewares/`** — Middlewares transversales (ej. `errorHandler`).
- **`backend/src/models/`** — Definición de modelos de datos.

---

## 3. Contrato JSON (no romper)

El hardware publica estos 4 tipos de evento. Los nombres de campo están coordinados con el firmware — **no renombrar**.

| `tipo_evento` | Severidad | Efecto en UI |
|---|---|---|
| `BAJA_TENSION` | `CRITICA` | Marca tablero como crítico si `tension_medida_v < 190.0` |
| `DESCONEXION_ABRUPTA_FOCO` | `CRITICA` | Foco pasa a `estado: 'robado'` |
| `FOCO_QUEMADO` | `ADVERTENCIA` | Foco pasa a `estado: 'quemado'` (advertencia salvo crítico existente) |
| `TELEMETRIA_NORMAL` | `INFO` | Restaura tensión y los `focos_restaurados[]`, o todos los focos si el array viene vacío |

Estados válidos de foco: `ok`, `robado`, `quemado`. Tensión nominal siempre `220.0V`, umbral mínimo `190.0V`.

Payloads completos de ejemplo en `Documentacion/CONTEXTO_TECNICO.md` (sección 5) y `README_MQTT_UI.md` (sección 4). Replicarlos exactamente al añadir un nuevo tipo de evento.

---

## 4. Estructura de un tablero

```js
{
  id: 'TABLERO_01',
  nombre: 'Centro / Palacio Municipal',
  ubicacion: 'Centro / Palacio Municipal',
  posX: 20,            // % horizontal para el pin en el mapa
  posY: 45,            // % vertical para el pin en el mapa
  tension_v: 220.0,
  tension_nominal_v: 220.0,
  fase: 'L1',
  focos: {
    'FOCO_A1': { id: 'FOCO_A1', corriente_ma: 450.0, estado: 'ok' },
    // ...
  }
}
```

Tableros iniciales hardcodeados: `TABLERO_01` (Centro / Palacio Municipal, fase L1), `TABLERO_02` (Parque Norte, L2), `TABLERO_03` (Paseo de la Costa, L3), `TABLERO_04` (Av. Argentina, L1). Si un evento llega con un `id_tablero` desconocido, `processIncomingEvent()` lo crea automáticamente con `posX: 50, posY: 50`.

---

## 5. Reglas de UI que NO deben romperse

### Mapa de zonas — bug histórico crítico

```html
<div class="map-svg-wrapper">           <!-- position: relative; height: 240px -->
  <svg viewBox="0 0 800 240" ...>...</svg>
  <div class="map-pins-layer" id="mapPinsContainer">...</div>  <!-- position: absolute -->
</div>
```

`#mapPinsContainer` usa `position: absolute` y **debe permanecer dentro** de `.map-svg-wrapper`, que es el único ancestro con `position: relative`. Moverlo fuera desancla los pines del mapa (bug visual especialmente en móvil).

Los pines se posicionan con `left/top` porcentuales desde `posX/posY` y se centran con `translate(-50%, -50%)`. En móvil (`max-width: 560px`) las etiquetas limitan a `max-width: 92px` y permiten salto de línea. **No reintroducir `white-space: nowrap`** en etiquetas sin antes verificar que no se recorten en los bordes.

### Tema claro/oscuro

Hay un botón en el header (`#btnToggleTheme`) que alterna entre los temas. La persistencia se hace en `localStorage` con la clave `luminaria_theme`. El atributo se aplica sobre `<html>` como `data-theme="light"` o `data-theme="dark"`. El modo oscuro es el default; el modo claro redefine las variables CSS en el bloque `[data-theme="light"]` dentro de `styles.css`.

- **Script anti-flash**: en `index.html` (al final del `<head>`) hay un script inline que lee `localStorage` y aplica `data-theme` antes de que renderice la página. **No eliminarlo** — sin él hay un flash blanco/oscuro al cargar.
- **Colores del mapa SVG**: los `stroke` del SVG en `index.html` usan `var(--map-path)`, `var(--map-grid)`, `var(--map-river)`. Si agregás un `<path>` o cambiás colores, usá variables CSS, no colores hardcodeados.
- Si agregás componentes nuevos, **siempre usá las variables CSS existentes** en lugar de colores hardcodeados para que el modo claro los respete automáticamente.
- Las variables en `[data-theme="light"]` que ya están definidas para cubrir: backgrounds (`--bg-dark`, `--bg-card`, `--bg-input`, `--bg-terminal`), texto, bordes, acentos semitransparentes (`--color-*-bg`/`-border`), sombras, colores del mapa SVG, fondo del menú flotante móvil y del modal.

### Sanitización

- `escapeHtml()` en `app.js` debe seguir aplicándose a todo dato dinámico antes de insertarse en `innerHTML`. Si se introduce un nuevo render de strings externos, sanitizar.
- El id de alerta usa `Math.random()` (suficiente para demo local; no usar como identificador de seguridad).

### Modo simulación

Preservar siempre. Es el modo por defecto al cargar y el que permite validar la UI sin hardware ni broker.

---

## 6. Configuración MQTT

Default (en `mqtt-client.js`):

```js
{
  host: 'localhost',
  port: 9001,        // WebSocket
  path: '/mqtt',
  topics: ['neuquen/iluminacion/#', 'api/evento'],
  qos: 1
}
```

El usuario puede sobreescribir vía modal (botón "Servidor"). La config se guarda en `localStorage['luminaria_mqtt_config']`. Si no hay Paho en window, o falla el `connect()`, entra en simulación automáticamente.

---

## 7. Reglas de modificación

1. **No introducir frameworks ni toolchains de build en el frontend** (sin React/Vue/Tailwind/npm) salvo pedido explícito. El estilo actual es vanilla ejecutable desde `index.html`.
2. **No cambiar nombres de claves JSON** del contrato de eventos — ya coordinados con hardware.
3. **Preservar modo simulación.**
4. **Preservar `escapeHtml()`** (o equivalente) al renderizar datos externos.
5. **No mover `#mapPinsContainer` fuera de `.map-svg-wrapper`.**
6. **No eliminar el script anti-flash** del `<head>` de `index.html`.
7. **Usar variables CSS** en lugar de colores hardcodeados cuando agregues componentes nuevos, para que el tema claro funcione automáticamente.
8. Si se agrega un backend real, documentarlo en `Documentacion/` **solo después de crear sus archivos** — la UI hoy es 100% cliente.
9. Validar sintaxis antes de entregar: `node -c js/app.js && node -c js/mqtt-client.js`.
