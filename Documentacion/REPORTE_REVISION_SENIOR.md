# 🐛 Reporte de Revisión Senior — Bugs Detectados y Optimizaciones Aplicadas

> **Rol:** Desarrollador Senior (Revisión de Código)
> **Ubicación:** `Documentacion/REPORTE_REVISION_SENIOR.md`
> **Proyecto:** Sistema de Monitoreo y Alertas Eléctricas — Municipalidad de Neuquén
> **Fecha de revisión:** Agosto 2026
> **Alcance:** Frontend (`js/`, `css/`, `index.html`) y Backend (`backend/`)

---

## 1. 🔧 Fix: Botón Hamburguesa en Móvil (UI Responsive)

### Bug reportado
En pantallas móviles (`max-width: 768px`) el menú desplegable del header se veía mal: los botones quedaban **aplastados en un ancho de ~72px** (el ancho del `.header-toolbar`).

### Causa raíz
`.header-toolbar` tenía `position: relative` dentro de la media query. El menú `.header-actions` (que es `position: absolute; left:0; right:0`) anclaba **contra el toolbar y no contra el header completo**, por lo que el desplegable medía lo mismo que el pill de estado + el botón hamburguesa.

### Solución aplicada
- **Archivo:** `css/styles.css` (media query `max-width: 768px`)
- Se eliminó `position: relative` de `.header-toolbar`, por lo que `.header-actions` ahora ancla contra `.main-header` (que ya tiene `position: relative`). El menú ocupa el **ancho completo del header**.
- Se agregó `max-height: calc(100vh - 100px); overflow-y: auto;` al menú para evitar que se corte en pantallas muy bajas / landscape.

> ⚠️ **Regla preservada:** No se movió `#mapPinsContainer` ni se tocó el anclaje del mapa. Solo se corrigió el contenedor desplegable del header.

---

## 2. 🛡️ Bugs de Seguridad Frontend Corregidos (XSS)

Detectados al auditar datos externos que entraban a `innerHTML` **sin sanitizar**, violando la regla del proyecto (`escapeHtml()` obligatorio en todo dato dinámico).

| Archivo | Línea aprox. | Bug | Impacto | Estado |
|---|---|---|---|---|
| `js/app.js` | `renderAlerts()` | `alert-detail-key`/`alert-detail-val` insertaban `k` y `v` crudos provenientes del payload MQTT | **XSS**: un `id_foco`/payload con `<img onerror=...>` ejecutaría script | ✅ Corregido |
| `js/app.js` | `renderTablerosGrid()` | `.tablero-tag` insertaba `tablero.id` sin `escapeHtml()` | **XSS** vía `id_tablero` (tableros auto-creados desde MQTT) | ✅ Corregido |
| `js/app.js` | `renderTablerosGrid()` | `.info-cell-val` insertaba `tablero.fase` sin sanitizar | **XSS** vía `datos.fase` | ✅ Corregido |

**Helpers agregados** (`js/app.js`):
- `safeText(v)` — convierte objetos/números a texto seguro antes de escapar.
- `fmtVoltage(v, decimals)` — evita `NaN`/crash si `tension_v` llega como string de MQTT.

---

## 3. ⚙️ Optimizaciones de Código JS Aplicadas

### Frontend (`js/app.js`)
1. **`refreshAllViews()`** — se eliminó la secuencia repetida `updateTableroUI(); renderAlerts(); updateKPIs(); renderMapPins();` en `processIncomingEvent()` agrupándola en una sola función (DRY).
2. **Singleton de `AudioContext`** — antes se creaba un `new AudioContext()` por cada alarma. Los navegadores tienen límites de contextos de audio activos; reutilizando uno solo se evita el leak y la pérdida de sonido.
3. **Panel desplegable "Tablero Seleccionado"** — feature agregada previamente (datos del tablero + focos) con cálculo de corriente promedio sin duplicar lógica.

### Backend (`backend/`)
1. **Fix crítico `errorHandler`** — se exportaba `{ errorHandler }` y `app.js` hacía `app.use(errorHandler)` → **El server crasheaba al arrancar** (`TypeError: app.use() requires a middleware function`). Se exporta la función directo.
2. **404 JSON** — rutas inexistentes devuelven `{ status:'error', statusCode:404, message }` en vez del HTML por defecto de Express.
3. **Request logger** — middleware inline (sin dependencias) que loguea `[timestamp] MÉTODO URL status DURACIÓN`.
4. **Apagado graceful** — `server.js` ahora maneja `SIGTERM`, `SIGINT`, `uncaughtException` y `unhandledRejection`, cerrando el servidor HTTP de forma ordenada con timeout de fuerza.
5. **Log corregido** — el mensaje de inicio apuntaba a `/health`; ahora muestra `http://localhost:PORT/api/health` (ruta real).

---

## 4. 🗂️ Bugs de Backend Reportados / Eliminados

La bitácora oficial está en `Documentacion/MATRIZ_DE_TAREAS_POR_NIVEL.md` → **Sección 5: Bitácora de Bugs — Backend** (IDs `BB-01` a `BB-08`).

| ID | Estado | Descripción |
|---|---|---|
| `BB-01` | ✅ ELIMINADO | `app.use()` con objeto → crash al arrancar |
| `BB-02` | ✅ ELIMINADO | Middleware 404 JSON estandarizado para rutas no encontradas |
| `BB-03` | ✅ ELIMINADO | Apagado graceful (`SIGINT`/`SIGTERM`/`uncaughtException`) en `server.js` |
| `BB-04` | ✅ ELIMINADO | Request logger inline activo (`MÉTODO URL STATUS DURACIÓN`) |
| `BB-05` | ✅ ELIMINADO | Log de health apuntaba a `/health` (ruta corregida a `/api/health`) |
| `BB-06` | ✅ ELIMINADO | CORS restringido con lista blanca de orígenes autorizados (`CORS_ORIGIN`) |
| `BB-07` | ✅ ELIMINADO | Rate limiting por IP (`express-rate-limit`, 100 req/min) y límite de body 1MB |
| `BB-08` | ✅ ELIMINADO | Manejador de errores centralizado sin exposición de `stack` en producción |

---

## 5. 🔭 Patrones Detectados y Recomendaciones (Roadmap)

| # | Patrón / Oportunidad | Archivo | Recomendación | Nivel |
|---|---|---|---|---|
| 1 | Lógica de severidad duplicada entre `renderTablerosGrid()` y `renderMapPins()` | `js/app.js` | Unificar en `getTableroStatus(tablero)` — **ojo**: hoy difieren (el mapa suma alertas sin resolver). Refactor con cuidado para no cambiar comportamiento. | 🟡 |
| 2 | `renderTablerosGrid()` re-renderiza toda la grilla por evento | `js/app.js` | OK a escala demo; si crece el nº de tableros, evaluar render por tarjeta o `DocumentFragment`. | 🟢 |
| 3 | `updateKPIs()` re-busca elementos del banner por `getElementById` en cada evento | `js/app.js` | Cachear refs DOM en objeto `elements` (ya existe) y agregar los del banner. | 🟢 |
| 4 | `console.log` de cada mensaje MQTT en `log()` | `js/mqtt-client.js` | Guardar detrás de flag `debug` para no saturar consola en producción. | 🟢 |
| 5 | CORS abierto + sin rate limiting | `backend/src/app.js` | Restringir CORS a dominios de la Municipalidad (`.env` + `cors({ origin })`). Rate limiting por IP (tarea `SEC-01`). | 🔴 |
| 6 | Sin validación de schema en payloads MQTT entrantes | `js/app.js` `processIncomingEvent()` | Middleware/validador del contrato JSON (tarea `BE-02`) antes de tocar estado. | 🔴 |
| 7 | Alertas con `id` por `Math.random()` | `js/app.js` | Suficiente para demo local; reemplazar por `crypto.randomUUID()` cuando exista persistencia. | 🟢 |

---

## 6. ✅ Validaciones Ejecutadas

```
node -c js/app.js                     ✔ Sintaxis OK
node -c js/mqtt-client.js             ✔ Sintaxis OK
npm install (backend)                 ✔ 0 vulnerabilidades
node server.js                        ✔ Arranca sin crash
curl /api/health                      200 OK
curl /api/inexistente                 404 OK (JSON)
kill -s SIGTERM <pid>                 ✔ Cierre ordenado (exit 0)
```