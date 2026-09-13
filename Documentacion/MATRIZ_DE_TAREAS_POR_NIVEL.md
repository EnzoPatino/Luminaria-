# 📊 Matriz de Tareas por Nivel de Criticidad — Project Luminaria

> **Rol:** Scrum Master
> **Ubicación:** `Documentacion/MATRIZ_DE_TAREAS_POR_NIVEL.md`
> **Proyecto:** Sistema de Monitoreo y Alertas Eléctricas (EPET N.º 14 × EPET N.º 20 — Municipalidad de Neuquén)
> **Última actualización:** Septiembre 2026 — Análisis exhaustivo del código fuente

---

## 1. 📐 Definición de Niveles de Criticidad

| Nivel | Etiqueta | Descripción e Impacto Operativo | Riesgo si se posterga |
|---|---|---|---|
| 🔴 **CRÍTICO** | **Bloqueante / Producción** | Requisitos fundamentales de infraestructura, ingesta telemétrica, estabilidad de UI o contrato de datos. Sin esto el sistema **no puede funcionar en producción**. | Caída del servicio, pérdida de telemetría en tiempo real o inconsistencia de datos con el hardware ESP32. |
| 🟠 **ALTO** | **Esencial / MVP** | Funcionalidades centrales de la arquitectura objetivo (API REST, persistencia relacional en BD, migración de cliente local a servidor). | El sistema funcionará solo como prototipo cliente sin persistencia real. |
| 🟡 **MODERADO** | **Funcional / Operativo** | Mejoras de experiencia de usuario, seguridad RBAC, automatizaciones de despliegue y notificaciones de escritorio. | Menor control de acceso o falta de avisos proactivos al personal técnico. |
| 🟢 **LEVE** | **Secundario / Optimización** | Herramientas accesorias, exportación de reportes, métricas avanzadas y refinamientos estéticos. | Ningún impacto funcional directo en la operación diaria. |

---

## 2. 🗂️ Cuadro General de Tareas Clasificadas (Matriz Actualizada)

| ID Tarea | Rol Asignado | Tarea / Historia de Usuario | Estado Real | Nivel de Criticidad | Est. (SP) | Impacto / Riesgo |
|---|---|---|---|---|---|---|
| **DO-01** | DevOps | Configuración y Hardening de Broker Mosquitto | ✅ Implementado | 🔴 **CRÍTICO** | 5 SP | Configurado en deploy/mosquitto. |
| **BE-01** | Backend | Worker Ingestor MQTT (Subscriber TCP 1883 → BD) | ✅ Implementado | 🔴 **CRÍTICO** | 8 SP | Implementado en src/workers/mqttSubscriber.js. |
| **BE-02** | Backend | Validación del Contrato JSON de Eventos | ✅ Implementado | 🔴 **CRÍTICO** | 3 SP | Implementada validación robusta con Zod en src/validators/eventSchema.js. |
| **FE-03** | Frontend | Preservar Script Anti-flash, Tema y Anclaje Mapa SVG | ✅ Implementado | 🔴 **CRÍTICO** | 2 SP | Reglas de UI preservadas. Bug del menú hamburguesa corregido. ✔ |
| **DO-03** | DevOps | Proxy Inverso Nginx + SSL/TLS (HTTPS y WSS) | ✅ Implementado | 🔴 **CRÍTICO** | 5 SP | Configurado en deploy/nginx/nginx.conf con proxy pass y websocket upgrade. |
| **SEC-01** | Backend / DevOps | Seguridad en Capa de Red: CORS, Rate Limiting, Headers | 🟡 Parcial | 🔴 **CRÍTICO** | 5 SP | CORS y rate limiting implementados ✅. Faltan headers CSP / HSTS / X-Content-Type-Options. |
| **SEC-02** | Backend | Integridad de Datos en Ingestor MQTT (deduplicación, límites) | ✅ Implementado | 🔴 **CRÍTICO** | 3 SP | Implementado rate limiting y deduplicación en src/services/ingestaService.js. |
| **BE-06** | Frontend | Error Boundary y Recuperación ante Fallos de MQTT/UI | 🟡 Parcial | 🔴 **CRÍTICO** | 3 SP | `processIncomingEvent()` tiene validación nula básica pero sin `try/catch` envolvente. Un payload inesperado puede silenciosamente corromper el estado de UI. |
| **BE-03** | Backend | Endpoints REST (`GET /api/tableros`, `GET /api/alertas`, `PATCH /api/alertas/:id`) | 🟡 Parcial | 🟠 **ALTO** | 8 SP | Solo `POST /api/eventos` y `GET /api/health` implementados. El frontend no puede obtener estado persistente ni resolver alertas contra el servidor. |
| **DB-01** | DBA | Diseño e Implementación de Esquema Relacional ER | ✅ Implementado | 🟠 **ALTO** | 5 SP | Esquema completo con 6 tablas, constraints y 8 índices optimizados. Listo para producción. ✔ |
| **DB-02** | DBA | Series Temporales (TimescaleDB / Particionado) | ❌ Pendiente | 🟠 **ALTO** | 5 SP | La tabla `lecturas` existe pero sin particionado. Con ingesta masiva de sensores, la BD se degradará sin esta optimización. |
| **FE-01** | Frontend | Integración con API REST (manteniendo Simulación fallback) | ❌ Pendiente | 🟠 **ALTO** | 5 SP | La UI trabaja 100% con mock data. Sin integración, no hay persistencia real ni visibilidad del estado actual de la red eléctrica. |
| **FE-02** | Frontend | Resolución de Alertas vía API REST | ❌ Pendiente | 🟠 **ALTO** | 3 SP | La resolución de alertas solo existe en memoria del navegador. Se pierde al recargar la página. |
| **DO-02** | DevOps | Contenerización Completa `docker-compose.yml` | 🟡 Parcial | 🟠 **ALTO** | 5 SP | Solo PostgreSQL en Docker. Backend, Mosquitto y Nginx sin contenerizar. El despliegue en servidores de la Municipalidad es inviable sin esto. |
| **DB-05** | DBA | Plan de Backup y Recuperación (`pg_dump` cron) | ❌ Pendiente | 🟠 **ALTO** | 3 SP | Sin backups, un fallo eléctrico o de hardware del servidor pierde todo el historial de eventos de la red municipal. |
| **BE-07** | Backend / DBA | Connection Pooling y Retry Strategy para PostgreSQL | 🟡 Parcial | 🟠 **ALTO** | 3 SP | Pool `pg` con `max: 10` configurado. Falta retry con backoff y health check en docker-compose. |
| **DO-06** | DevOps | Separación de Entornos Staging / Producción | 🟡 Parcial | 🟠 **ALTO** | 3 SP | `.env.example` versionado. Faltan archivos de entorno separados para staging y producción. |
| **BE-08** | Backend | Health Check y Circuit Breaker | 🟡 Parcial | 🟠 **ALTO** | 2 SP | `GET /api/health` verifica BD con `SELECT 1`. Falta circuit breaker y estado de MQTT en el health check. |
| **BE-04** | Backend | Autenticación JWT y Control de Acceso (RBAC) | ❌ Pendiente | 🟡 **MODERADO** | 5 SP | Los endpoints de resolución de alertas son públicos. Sin RBAC, cualquier cliente puede resolver o manipular alertas. |
| **FE-06** | Frontend | Modal de Autenticación (UI Login) | ❌ Pendiente | 🟡 **MODERADO** | 3 SP | Depende de BE-04. Sin login, el switch de roles (Supervisor/Técnico) es solo decorativo. |
| **FE-05** | Frontend | Notificaciones Push Web (`Notification API`) | ❌ Pendiente | 🟡 **MODERADO** | 3 SP | El técnico de guardia no recibe alertas si no tiene la pestaña activa. |
| **DO-04** | DevOps | Pipeline CI/CD (GitHub Actions / GitLab CI) | ❌ Pendiente | 🟡 **MODERADO** | 5 SP | Sin CI/CD, cada despliegue es manual y propenso a errores humanos. |
| **DB-03** | DBA | Estrategia de Índices B-Tree Adicionales | ✅ Implementado | 🟡 **MODERADO** | 2 SP | Índices compuestos creados en la migración inicial. Consultas de dashboard y mapa con respuesta < 50ms esperada. ✔ |
| **DB-04** | DBA | Políticas de Retención de Datos y Aggregation Jobs | 🟡 Parcial | 🟡 **MODERADO** | 3 SP | `retencionService.js` y `mantenimientoScheduler.js` existen. Falta ventana de retención configurable por `.env` y job de agregación en `estadisticas_zona`. |
| **DO-05** | DevOps | Monitoreo de Infraestructura (Prometheus + Grafana) | ❌ Pendiente | 🟡 **MODERADO** | 5 SP | Sin métricas, un pico de tráfico o fallo de memoria en el broker pasa desapercibido hasta la caída del servicio. |
| **FE-08** | Frontend | Accesibilidad WCAG 2.1 AA (ARIA, Contraste, Teclado) | 🟡 Parcial | 🟡 **MODERADO** | 3 SP | Algunos botones tienen `aria-label`. Falta `aria-live` en región de alertas y navegación completa por teclado. |
| **FE-09** | Frontend | Internacionalización i18n (Español / Inglés) | ❌ Pendiente | 🟡 **MODERADO** | 3 SP | Todos los textos hardcodeados en español en `js/app.js`. |
| **SEC-03** | Backend / DBA | Audit Logging y Registro de Seguridad | ❌ Pendiente | 🟡 **MODERADO** | 3 SP | Sin tabla `audit_log`, no hay trazabilidad de quién resolvió alertas ni de accesos no autorizados. Requisito de cumplimiento normativo municipal. |
| **DO-07** | DevOps | Pruebas de Carga y Stress Testing | ❌ Pendiente | 🟡 **MODERADO** | 3 SP | Sin load testing no se conoce la capacidad real del sistema ante una tormenta eléctrica que genere eventos masivos. |
| **BE-09** | Backend | Logging Estructurado y Correlación de Eventos | 🟡 Parcial | 🟡 **MODERADO** | 2 SP | Request logger activo. Falta JSON estructurado con `correlation_id` para trazabilidad MQTT→Worker→BD. |
| **FE-04** | Frontend | Exportación CSV/JSON y Filtros en Consola MQTT | ❌ Pendiente | 🟢 **LEVE** | 2 SP | Herramienta de diagnóstico secundario para el desarrollador/técnico. |
| **BE-05** | Backend | API Histórica de Telemetría para Gráficas | ❌ Pendiente | 🟢 **LEVE** | 5 SP | La tabla `lecturas` contiene los datos pero no hay endpoint para exponerlos. Requerido solo para reportes estadísticos futuros. |
| **FE-07** | Frontend | Validación Sintáctica Automática (`node -c`) | ✅ Implementado | 🟢 **LEVE** | 1 SP | `check_syntax.py` en raíz. `node -c js/app.js` y `node -c js/mqtt-client.js` pasan sin errores. ✔ |
| **FE-10** | Frontend | Documentación JSDoc y Guía de Onboarding | 🟡 Parcial | 🟢 **LEVE** | 2 SP | Comentarios de sección en código. Sin JSDoc formal. `MANUAL_DESARROLLADOR.md` cubre setup básico pero falta ONBOARDING.md completo. |
| **FE-11** | Frontend | Dashboard de Analíticas de Uso Básico | ❌ Pendiente | 🟢 **LEVE** | 2 SP | Sin métricas de uso no se puede justificar inversiones con datos reales. |
| **FE-12** | Frontend | PWA / Service Worker para Funcionalidad Offline | ❌ Pendiente | 🟢 **LEVE** | 3 SP | Útil en zonas de conectividad intermitente (parques, costaneras de Neuquén). |

---

## 3. 🔍 Desglose por Nivel de Criticidad

### 🔴 Nivel CRÍTICO — Bloqueantes de Producción

#### `BE-01` — Worker Ingestor MQTT ⚠️ **MÁXIMA URGENCIA**
- **Estado:** ❌ **NO EXISTE en el repositorio**
- **Archivos a crear:** `backend/src/worker/mqttSubscriber.js` (o `mqttWorker.js`)
- **Dependencias listas:** `persistenciaService.js` ✅ · `database.js` ✅ · esquema DB ✅
- **Criterio de Aceptación:** Cada evento publicado por ESP32 en `neuquen/iluminacion/#` debe reflejarse en la BD en menos de 200ms. El worker debe reconectarse automáticamente con backoff exponencial.

#### `DO-01` — Mosquitto MQTT Broker
- **Archivos a crear:** `mosquitto.conf`, actualizar `docker-compose.yml`
- **Requisito:** Puerto TCP `1883` para ESP32 + WebSocket `9001` (`/mqtt`) para navegadores. Autenticación obligatoria para dispositivos hardware de EPET 14.
- **Criterio de Aceptación:** Probar recepción de eventos reales desde hardware o cliente Paho MQTT sin desconexiones abruptas.

#### `BE-02` — Validación del Contrato JSON (ampliar)
- **Estado:** 🟡 Parcial — `validateEvent()` en `persistenciaService.js` valida tipo, id y severidad.
- **Falta:** Validación por tipo de evento con campos específicos:
  - `BAJA_TENSION` → `tension_medida_v`, `tension_nominal_v`, `umbral_minimo_v`
  - `DESCONEXION_ABRUPTA_FOCO` → `id_foco`, `corriente_actual_ma`, `tiempo_caida_ms`
  - `FOCO_QUEMADO` → `id_foco`, `corriente_medida_ma`, `duracion_anomalia_s`
  - `TELEMETRIA_NORMAL` → `tension_medida_v`
- **Criterio:** Rechazar payloads malformados con log de advertencia sin tumbar el worker.

#### `FE-03` — Preservación de UI ✅ DONE
- Confirmado en código: script anti-flash activo, `#mapPinsContainer` correcto, variables CSS funcionando, menú hamburguesa corregido.

#### `DO-03` — Nginx + SSL/TLS
- **Archivos a crear:** `nginx.conf`, integrar en `docker-compose.yml`
- **Criterio:** Navegador puede acceder a `https://luminaria.neuquen.gob.ar` y conectar MQTT por `wss://`.

#### `SEC-01` — Seguridad Capa de Red (completar)
- **Estado:** CORS ✅ · Rate limiting ✅ · **Faltan headers de seguridad**
- **Acción:** Agregar en `backend/src/app.js`:
  ```js
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  ```

#### `SEC-02` — Integridad de Datos Ingestor
- **Implementar en el Worker (BE-01):** ventana de deduplicación, rate limiting por tablero, cola con backpressure.

#### `BE-06` — Error Boundary UI (ampliar)
- **Estado:** 🟡 Parcial
- **Acción:** Envolver `processIncomingEvent()` en `try/catch` completo. Guardar último estado de `appState.tableros` en `localStorage` como fallback.

---

### 🟠 Nivel ALTO — Esencial para MVP

#### `BE-03` — Endpoints REST (implementar los faltantes)
- **Existe:** `POST /api/eventos` ✅ · `GET /api/health` ✅
- **Falta implementar:**
  ```
  GET  /api/tableros                           → tablerosModel.findAll()
  GET  /api/alertas?severidad=CRITICA&page=1   → alertasModel.findAll(filters)
  PATCH /api/alertas/:id/resolver              → alertasModel.resolve(id)
  ```
- **Criterio:** Respuestas en formato `{ status, data, pagination }`. Paginación con `limit` y `offset`.

#### `DB-01` — Esquema ER ✅ DONE
- 6 tablas creadas, 8 índices, constraints y checks robustos. Seed de datos iniciales disponible.

#### `DB-05` — Backup y Recuperación
- **Acción:** Crear script cron `pg_dump --format=custom luminaria_db > backup_$(date +%Y%m%d).dump`
- **Criterio:** Backup diferencial diario + completo semanal. Prueba de restauración documentada.

#### `FE-01` — Integración API REST Frontend
- **Acción en `js/app.js`:** Agregar función `loadInitialData()` que reemplace el `init()` con llamadas a `/api/tableros` y `/api/alertas`. Mantener mock data como fallback.

#### `FE-02` — Resolución de Alertas via API
- **Acción:** En `renderAlerts()`, al hacer clic en "Marcar Resuelta", enviar `PATCH /api/alertas/{id}/resolver` y actualizar UI solo con respuesta `200`.

---

### 🟡 Nivel MODERADO — Funcional / Operativo

| ID | Acción Principal | Dependencia Previa |
|---|---|---|
| **BE-04** | Crear tabla `usuarios` (migración 002), `POST /api/auth/login` con bcrypt + JWT | DB-01 ✅ |
| **FE-06** | Modal de Login en UI, guardar JWT en sessionStorage | BE-04 |
| **FE-05** | `Notification.requestPermission()` en init, `new Notification()` en alertas críticas | Ninguna |
| **DO-04** | `.github/workflows/ci.yml` con jobs: lint, test, docker build, deploy | DO-02 |
| **DB-04** | Configurar ventana retención via `RETENTION_DAYS` en `.env`, job agregación `estadisticas_zona` | DB-01 ✅ |
| **DO-05** | Añadir Prometheus + Grafana a `docker-compose.yml` | DO-02 |
| **FE-08** | `aria-live="polite"` en `#alertsContainer`, roles ARIA en tabs y modales | Ninguna |
| **FE-09** | `js/i18n.js` con diccionario ES/EN, selector en header | Ninguna |
| **SEC-03** | Migración 003 tabla `audit_log`, middleware de auditoría en endpoints sensibles | BE-04 |
| **DO-07** | Script `k6` simulando carga real | DO-02 |
| **BE-09** | Reemplazar `console.log` inline por `winston`/`pino` con JSON estructurado | Ninguna |

---

### 🟢 Nivel LEVE — Secundario / Optimización

| ID | Acción | Valor |
|---|---|---|
| **FE-04** | Botones de pausa, filtro y exportación en pestaña Consola | Diagnóstico avanzado para técnicos |
| **BE-05** | `GET /api/telemetria/historico` para gráficas de consumo | Reportes estadísticos futuros |
| **FE-07** | Script `check_syntax.py` en raíz ✅ | Ya implementado |
| **FE-10** | JSDoc en funciones públicas de `app.js` + `ONBOARDING.md` | Onboarding de nuevos desarrolladores |
| **FE-11** | Métricas de uso en localStorage (sesiones, eventos, distribución severidades) | Justificación de inversiones |
| **FE-12** | `sw.js` + `manifest.json` para modo offline básico | Zonas de baja conectividad |

---

## 4. 🗓️ Sugerencia de Sprints

```
Sprint 1 (2 semanas) — FUNDACIÓN DE PRODUCCIÓN
  ├── DO-01: Mosquitto MQTT (TCP 1883 + WS 9001)
  ├── BE-01: Worker Ingestor MQTT  ← MÁXIMA URGENCIA
  ├── BE-02: Validación de contrato JSON (completar)
  ├── DO-02: docker-compose.yml completo
  └── DO-03: Nginx + SSL/TLS

Sprint 2 (2 semanas) — API REST Y FRONTEND CONECTADO
  ├── BE-03: GET /api/tableros, GET /api/alertas, PATCH /api/alertas/:id
  ├── FE-01: Integración API REST en frontend
  ├── FE-02: Resolución de alertas vía API
  ├── BE-08: Circuit Breaker en health check
  └── SEC-01: Headers de seguridad faltantes (completar)

Sprint 3 (2 semanas) — SEGURIDAD Y OPERACIONES
  ├── BE-04: JWT + RBAC (tabla usuarios, migración 002)
  ├── FE-06: Modal de Login
  ├── DB-05: Backup automático pg_dump
  ├── DO-06: Entornos staging / producción
  └── BE-06: Error Boundary UI completo

Sprint 4 (2 semanas) — CALIDAD Y ESCALABILIDAD
  ├── DB-02: TimescaleDB / particionado en lecturas
  ├── SEC-02: Deduplicación y rate limiting en worker
  ├── DO-04: CI/CD GitHub Actions
  ├── BE-09: Logging estructurado (winston/pino)
  └── DO-07: Load testing con k6

Sprint 5 (2 semanas) — REFINAMIENTO
  ├── FE-05: Notificaciones Push Web
  ├── FE-08: Accesibilidad WCAG 2.1 AA
  ├── DO-05: Prometheus + Grafana
  ├── SEC-03: Audit logging
  └── BE-05: API histórica de telemetría
```

---

## 5. 🐛 Bitácora de Bugs — Backend (Actualizada)

| ID | Estado | Descripción | Archivo |
|---|---|---|---|
| `BB-01` | ✅ ELIMINADO | `app.use()` con objeto en vez de función → crash al arrancar | `backend/src/app.js` |
| `BB-02` | ✅ ELIMINADO | Middleware 404 estandarizado para rutas no encontradas (JSON) | `backend/src/app.js` |
| `BB-03` | ✅ ELIMINADO | Apagado graceful (`SIGINT`/`SIGTERM`/`uncaughtException`) en `server.js` | `backend/server.js` |
| `BB-04` | ✅ ELIMINADO | Request logger inline activo (`MÉTODO URL STATUS DURACIÓN`) | `backend/src/app.js` |
| `BB-05` | ✅ ELIMINADO | Log de health apuntaba a `/health` (ruta corregida a `/api/health`) | `backend/server.js` |
| `BB-06` | ✅ ELIMINADO | CORS restringido con lista blanca de orígenes (`CORS_ORIGIN` en `.env`) | `backend/src/app.js` |
| `BB-07` | ✅ ELIMINADO | Rate limiting por IP (`express-rate-limit`, 100 req/min) y límite body 1MB | `backend/src/app.js` |
| `BB-08` | ✅ ELIMINADO | Manejador de errores centralizado sin exposición de `stack` en producción | `backend/src/app.js` |
| `BB-09` | 🔴 ABIERTO | Headers de seguridad HTTP faltantes (CSP, HSTS, X-Content-Type-Options) | `backend/src/app.js` |
| `BB-10` | 🔴 ABIERTO | Tabla `usuarios` no existe en el esquema DB (bloquea BE-04) | `001_init_schema.sql` |
| `BB-11` | 🔴 ABIERTO | Worker MQTT Ingestor no existe. Eventos de hardware ESP32 no se persisten. | Archivo a crear |
| `BB-12` | 🟡 PARCIAL | `processIncomingEvent()` en frontend sin `try/catch` global (riesgo de crash silencioso) | `js/app.js` |

---

## 6. 🐛 Bitácora de Bugs — Frontend (Actualizada)

| ID | Estado | Descripción | Archivo |
|---|---|---|---|
| `BF-01` | ✅ CORREGIDO | Menú hamburguesa aplastado en móviles (`position: relative` en `.header-toolbar`) | `css/global.css` |
| `BF-02` | ✅ CORREGIDO | XSS en `renderAlerts()`: `alert-detail-key`/`val` sin sanitizar | `js/app.js` |
| `BF-03` | ✅ CORREGIDO | XSS en `renderTablerosGrid()`: `tablero.id` y `tablero.fase` sin `escapeHtml()` | `js/app.js` |
| `BF-04` | ✅ CORREGIDO | `new AudioContext()` por cada alarma → leak de contextos de audio | `js/app.js` |
| `BF-05` | 🟡 PARCIAL | `processIncomingEvent()` sin `try/catch` global envolvente | `js/app.js` |
| `BF-06` | 🟡 ABIERTO | Alert IDs generados con `Math.random()` (no criptográficamente seguros, colisión posible) | `js/app.js:844` |
| `BF-07` | 🟡 ABIERTO | Lógica de severidad duplicada entre `renderTablerosGrid()` y `renderMapPins()` | `js/app.js` |
| `BF-08` | 🟢 MENOR | `console.log` de cada mensaje MQTT sin flag `debug` (satura consola en producción) | `js/mqtt-client.js:58` |
| `BF-09` | 🟢 MENOR | `updateKPIs()` busca elementos DOM por `getElementById` en cada evento (sin cachear) | `js/app.js:1251-1254` |
| `BF-10` | 🟢 MENOR | `renderTablerosGrid()` re-renderiza toda la grilla por evento (OK a escala demo) | `js/app.js:878` |

---

## 7. 📐 Reglas Críticas de Desarrollo (No Negociables)

> [!IMPORTANT]
> Estas reglas **NO pueden violarse** en ninguna modificación del código:

1. **Contrato JSON Intacto:** No renombrar `tipo_evento`, `id_tablero`, `tension_medida_v`, `id_foco`, `corriente_actual_ma`, `focos_restaurados`.
2. **`#mapPinsContainer` siempre dentro de `.map-svg-wrapper`:** Moverlo rompe el anclaje de pines en móviles.
3. **Script anti-flash siempre en `<head>`:** Eliminarlo causa parpadeo de tema al cargar.
4. **`escapeHtml()` obligatorio en todo dato dinámico:** Nunca insertar en `innerHTML` sin sanitizar.
5. **`node -c <archivo.js>` debe pasar** antes de hacer merge a main.
6. **Variables CSS para colores:** Usar `var(--bg-card)`, `var(--text-primary)`, etc. Nunca hardcodear colores.
