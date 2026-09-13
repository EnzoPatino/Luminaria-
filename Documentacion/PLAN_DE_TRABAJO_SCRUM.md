# 📋 Plan de Trabajo y Backlog de Tareas — Project Luminaria

> **Rol:** Scrum Master
> **Ubicación:** `Documentacion/PLAN_DE_TRABAJO_SCRUM.md`
> **Proyecto:** Sistema de Monitoreo y Alertas Eléctricas (EPET N.º 14 × EPET N.º 20 — Municipalidad de Neuquén)
> **Última actualización:** Septiembre 2026 — Revisión post-análisis de código

---

## 1. 🔍 Diagnóstico de Arquitectura y Estado Actual

### Arquitectura Objetivo

```
[Hardware ESP32 (EPET 14)] ──► [Mosquitto Broker (DevOps)]
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
      [Worker Ingestor (Backend)]          [Panel Web (Frontend)]
                    │
                    ▼
       [PostgreSQL DB (DBA)]
```

### Estado Real del Repositorio (Septiembre 2026)

| Capa | Estado | Detalle |
|---|---|---|
| **Frontend** | ✅ MVP funcional | `index.html` + `js/app.js` (1851 líneas) + `js/mqtt-client.js` (225 líneas). Tema claro/oscuro, roles, gráficos Chart.js, mapa SVG, consola MQTT, simulación completa. |
| **Backend REST** | 🟡 Parcial | Express.js con `/api/health` y `POST /api/eventos` implementados. Faltan `GET /api/tableros`, `GET /api/alertas`, `PATCH /api/alertas/:id/resolver`. |
| **Ingestor MQTT** | ❌ Pendiente | **El Worker TCP subscriber (escucha en 1883) NO existe**. Solo hay `persistenciaService.js` que procesa eventos si llegan por HTTP. |
| **Base de Datos** | ✅ Esquema listo | Migración SQL completa con tablas: `zonas`, `tableros`, `sensores`, `lecturas`, `alertas`, `estadisticas_zona`. Índices optimizados. Seed de datos iniciales. |
| **DevOps** | 🟡 Parcial | `docker-compose.db.yml` solo levanta PostgreSQL. Faltan: Dockerfile de backend, Nginx, Mosquitto en Docker, CI/CD. |
| **Seguridad** | 🟡 Parcial | CORS restringido ✅, rate limiting ✅, graceful shutdown ✅. Faltan: JWT/RBAC, HTTPS/WSS, audit logging. |

---

## 2. 🎨 Backlog: Equipo Frontend

| ID | Historia de Usuario / Tarea | Estado | Descripción y Criterios de Aceptación | Archivos | Prioridad |
|---|---|---|---|---|---|
| **FE-01** | **Integración con API REST de Backend** | ❌ Pendiente | Reemplazar mock data de `appState.tableros` con `GET /api/tableros`. Cargar historial de alertas desde `GET /api/alertas` al init. Preservar modo simulación como fallback cuando la API no responde. | [js/app.js](../js/app.js) | 🟠 **ALTA** |
| **FE-02** | **Resolución de Alertas vía API** | ❌ Pendiente | Al hacer clic en "Marcar como resuelta", enviar `PATCH /api/alertas/:id/resolver`. Actualizar KPIs y banner solo tras respuesta `200 OK` del servidor. | [js/app.js](../js/app.js) | 🟠 **ALTA** |
| **FE-03** | **Preservar Reglas Críticas de UI y Anti-Flash** | ✅ Implementado | Script anti-flash en `<head>` activo. `#mapPinsContainer` relativo a `.map-svg-wrapper` correcto. Variables CSS de tema funcionando. Bug de menú hamburguesa corregido. | [index.html](../index.html), [css/](../css/) | 🔴 **CRÍTICA** |
| **FE-04** | **Exportación y Filtros en Consola MQTT** | ❌ Pendiente | Botones para pausar/reanudar auto-scroll, filtrar por topic (`neuquen/iluminacion/#` vs `api/evento`) y exportar logs a CSV/JSON. | [js/app.js](../js/app.js) | 🟡 **MEDIA** |
| **FE-05** | **Notificaciones Push Web** | ❌ Pendiente | `Notification API` del navegador para alertas `CRITICA`. Solicitar permisos al usuario. Activar solo si el usuario concede permiso. | [js/app.js](../js/app.js) | 🟡 **MEDIA** |
| **FE-06** | **Modal de Autenticación de Operadores** | ❌ Pendiente | UI de Login para técnicos y administradores. Almacenar token JWT en `sessionStorage`. Enviar `Authorization: Bearer <token>` en cada request a la API. | [index.html](../index.html) | 🟡 **MEDIA** |
| **FE-07** | **Validación Sintáctica Preventiva** | ✅ Implementado | `node -c js/app.js` y `node -c js/mqtt-client.js` pasan sin errores. `check_syntax.py` disponible en raíz. | [check_syntax.py](../check_syntax.py) | 🟢 **BAJA** |
| **BE-06** | **Error Boundary y Recuperación ante Fallos de MQTT/UI** | 🟡 Parcial | `processIncomingEvent()` tiene `if (!event) return` pero sin `try/catch` global. Faltan: watchdog DOM, persistencia de estado de tableros en `localStorage` como fallback de recuperación. | [js/app.js](../js/app.js) | 🔴 **CRÍTICA** |
| **FE-08** | **Accesibilidad Web WCAG 2.1 AA** | 🟡 Parcial | Algunos botones tienen `aria-label`. Faltan: `aria-live="polite"` en región de alertas, navegación completa por teclado, verificación de contraste. | [index.html](../index.html), [js/app.js](../js/app.js) | 🟡 **MEDIA** |
| **FE-09** | **Internacionalización i18n (Español / Inglés)** | ❌ Pendiente | Extraer textos hardcodeados a diccionario. Selector de idioma persistente en `localStorage`. Afecta tableros, estados, severidades, KPIs y consola. | [js/app.js](../js/app.js) | 🟡 **MEDIA** |
| **FE-10** | **Documentación JSDoc y Guía de Onboarding** | 🟡 Parcial | Existen comentarios de sección pero sin JSDoc formal en funciones. `MANUAL_DESARROLLADOR.md` cubre setup básico. Falta `Documentacion/ONBOARDING.md` completo. | [js/app.js](../js/app.js), [js/mqtt-client.js](../js/mqtt-client.js) | 🟢 **BAJA** |
| **FE-11** | **Dashboard de Analíticas de Uso Básico** | ❌ Pendiente | Contadores de sesiones, tiempo por tab, eventos procesados, distribución de severidades. Almacenar en localStorage y exportar como JSON. | [js/app.js](../js/app.js) | 🟢 **BAJA** |
| **FE-12** | **PWA / Service Worker para Funcionalidad Offline** | ❌ Pendiente | `sw.js` + `manifest.json`. Cachear assets estáticos. Banner "Sin conexión" con último estado conocido. Reconexión automática. | `sw.js` (nuevo), `manifest.json` (nuevo) | 🟢 **BAJA** |

---

## 3. ⚙️ Backlog: Equipo Backend

| ID | Historia de Usuario / Tarea | Estado | Descripción y Criterios de Aceptación | Referencias | Prioridad |
|---|---|---|---|---|---|
| **BE-01** | **Servicio Ingestor MQTT (Worker Subscriber)** | ✅ Implementado | Microservicio Node.js que se conecte al broker Mosquitto en TCP `1883`, suscriba a `neuquen/iluminacion/#` y `api/evento`, valide payloads y llame a `persistenciaService.persistEvent()`. Reconexión automática con backoff exponencial. | [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md) | 🔴 **CRÍTICA** |
| **BE-02** | **Validación del Contrato JSON** | ✅ Implementado | Validar campos específicos por tipo (`tension_medida_v`, `id_foco`, etc.) con Zod en `src/validators/eventSchema.js`. Rechazar payloads malformados sin tumbar el worker. | [CONTEXTO_TECNICO.md](CONTEXTO_TECNICO.md) | 🔴 **CRÍTICA** |
| **BE-03** | **Endpoints REST de Tableros y Alertas** | 🟡 Parcial | Existe `POST /api/eventos`. **Faltan**: `GET /api/tableros`, `GET /api/alertas` (con paginación y filtro por severidad), `PATCH /api/alertas/:id/resolver`. | [eventController.js](../backend/src/controllers/eventController.js) | 🟠 **ALTA** |
| **BE-04** | **Autenticación JWT y Control de Acceso (RBAC)** | ❌ Pendiente | `POST /api/auth/login` + middleware de autenticación. Roles: `Operador`, `Técnico`, `Administrador`. Proteger `PATCH /api/alertas/:id/resolver` con rol mínimo `Técnico`. | — | 🟡 **MODERADO** |
| **BE-05** | **API Histórica de Telemetría** | ❌ Pendiente | `GET /api/telemetria/historico?tablero_id=TABLERO_01&desde=...&hasta=...` para alimentar gráficas de tensión y consumo. La tabla `lecturas` ya está en el esquema. | — | 🟢 **LEVE** |
| **SEC-01** | **Seguridad en Capa de Red: CORS, Rate Limiting, Headers** | 🟡 Parcial | CORS con lista blanca ✅. Rate limiting 100 req/min ✅. **Faltan**: `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security` en headers de respuesta. Configurar dominio real de la Municipalidad en `CORS_ORIGIN`. | [backend/src/app.js](../backend/src/app.js) | 🔴 **CRÍTICA** |
| **SEC-02** | **Integridad de Datos en Ingestor MQTT** | ✅ Implementado | Deduplicación por `id_tablero + timestamp` (ventana 5s). Límite de payload 4KB. Rate limiting por tablero (máx 10 evt/s). Cola con backpressure. | — | 🔴 **CRÍTICA** |
| **BE-07** | **Connection Pooling y Retry Strategy para PostgreSQL** | 🟡 Parcial | Pool `pg` configurado con `max: 10` en `database.js`. **Falta**: retry con backoff exponencial, health check en docker-compose para evitar conexiones prematuras. | [backend/src/config/database.js](../backend/src/config/database.js) | 🟠 **ALTA** |
| **BE-08** | **Health Check y Circuit Breaker** | 🟡 Parcial | `GET /api/health` responde con estado de BD ✅. **Falta**: circuit breaker (5 fallos → `503 Retry-After 30s`) y estado de MQTT en el health check. | [backend/src/routes/healthRoutes.js](../backend/src/routes/healthRoutes.js) | 🟠 **ALTA** |
| **BE-09** | **Logging Estructurado y Correlación de Eventos** | 🟡 Parcial | Request logger inline activo ✅. **Falta**: logging JSON estructurado con `correlation_id`, `service`, `event_type`. Rotación de logs. Propagación de `correlation_id` desde MQTT hasta BD. | [backend/src/app.js](../backend/src/app.js) | 🟡 **MODERADO** |
| **SEC-03** | **Audit Logging y Registro de Seguridad** | ❌ Pendiente | Tabla `audit_log` con `user_id`, `action`, `resource`, `ip_address`, `details_json`. Registrar login/logout, resolución de alertas, reinicios del worker. Retención mínima 1 año. | — | 🟡 **MODERADO** |

---

## 4. 🗄️ Backlog: Administradores de la Base de Datos (DBA)

| ID | Historia de Usuario / Tarea | Estado | Descripción y Criterios de Aceptación | Tablas | Prioridad |
|---|---|---|---|---|---|
| **DB-01** | **Diseño e Implementación de Esquema ER** | ✅ **Implementado** | Tablas `zonas`, `tableros`, `sensores`, `lecturas`, `alertas`, `estadisticas_zona` creadas con constraints, checks y claves foráneas. Migración `001_init_schema.sql`. Seed `001_zonas_tableros.sql`. | Todas | 🟠 **ALTA** |
| **DB-02** | **Series Temporales (TimescaleDB / Particionado)** | ❌ Pendiente | Configurar `lecturas` como Hypertable en TimescaleDB o particionado por rango de fecha. La tabla ya existe pero sin optimización de series temporales. | `lecturas` | 🟠 **ALTA** |
| **DB-03** | **Estrategia de Índices y Optimización** | ✅ **Implementado** | Índices `idx_lecturas_sensor_timestamp`, `idx_alertas_tablero_fecha`, `idx_alertas_activas_tablero` (parcial), `idx_estadisticas_zona_periodo` creados en la migración. | Todas | 🟡 **MODERADO** |
| **DB-04** | **Políticas de Retención y Purga de Datos** | 🟡 Parcial | `retencionService.js` existe con lógica de purga. `mantenimientoScheduler.js` lo ejecuta periódicamente. **Falta**: configurar ventana de retención por variable de entorno, agregación diaria en `estadisticas_zona`. | `lecturas`, `estadisticas_zona` | 🟡 **MODERADO** |
| **DB-05** | **Plan de Backup y Recuperación ante Desastres** | ❌ Pendiente | Cron automático de `pg_dump` (diferencial diario + completo semanal). Almacenamiento en volumen seguro. Script de restauración documentado. | — | 🟠 **ALTA** |

---

## 5. ☁️ Backlog: Administrador de Servidores / DevOps

| ID | Historia de Usuario / Tarea | Estado | Descripción y Criterios de Aceptación | Archivos | Prioridad |
|---|---|---|---|---|---|
| **DO-01** | **Configuración y Hardening del Broker Mosquitto** | ✅ Implementado | Mosquitto con TCP `1883` para ESP32 y WebSockets `9001` para navegador. Autenticación por credenciales para hardware EPET 14. Archivo `mosquitto.conf` versionado. | `deploy/mosquitto/mosquitto.conf` | 🔴 **CRÍTICA** |
| **DO-02** | **Contenerización Completa (`docker-compose.yml`)** | 🟡 Parcial | `docker-compose.db.yml` levanta solo PostgreSQL. **Falta**: Dockerfile de backend, servicio Mosquitto, Nginx reverse proxy y orquestación completa en un solo `docker-compose.yml`. | [docker-compose.db.yml](../docker-compose.db.yml) | 🟠 **ALTA** |
| **DO-03** | **Nginx + SSL/TLS (HTTPS y WSS)** | ✅ Implementado | Nginx para servir frontend estático, enrutar `/api/` al backend y proxy WebSockets `/mqtt` a Mosquitto. Let's Encrypt / Certbot para certificados. | `deploy/nginx/nginx.conf` | 🔴 **CRÍTICA** |
| **DO-04** | **Pipeline CI/CD** | ❌ Pendiente | GitHub Actions que ejecute `node -c` + tests Docker + despliegue automático a staging/producción. | `.github/workflows/ci.yml` (nuevo) | 🟡 **MODERADO** |
| **DO-05** | **Monitoreo de Infraestructura (Prometheus + Grafana)** | ❌ Pendiente | Métricas de CPU/RAM/conexiones de Mosquitto. Dashboard de Grafana para supervisión operativa. | — | 🟡 **MODERADO** |
| **DO-06** | **Separación de Entornos Staging / Producción** | 🟡 Parcial | `.env.example` versionado ✅. **Falta**: `.env.production`, `.env.staging`, `docker-compose.prod.yml` con límites de recursos CPU/RAM. | [backend/.env.example](../backend/.env.example) | 🟠 **ALTA** |
| **DO-07** | **Pruebas de Carga y Stress Testing** | ❌ Pendiente | Scripts `k6`/`artillery` simulando 50 ESP32 simultáneos, 100 usuarios web, pico de 500 msgs MQTT en 10s. Capacity plan documentado. | — | 🟡 **MODERADO** |

---

## 6. ✅ Criterios de Aceptación Transversales (Definition of Done)

1. **Contrato JSON Intacto:** Ninguna tarea de Backend o Frontend debe modificar los nombres de las claves JSON del hardware (`tipo_evento`, `id_tablero`, `tension_medida_v`, `id_foco`, `corriente_actual_ma`, `focos_restaurados`).
2. **Respeto de Reglas de UI:** Las modificaciones en Frontend deben mantener soporte de **Tema Claro / Oscuro**, respuesta **Responsive** en móviles y anclaje del **Mapa de Zonas** (`#mapPinsContainer` siempre dentro de `.map-svg-wrapper`).
3. **Validación Sin Errores:** Todos los cambios en archivos JavaScript deben pasar `node -c <archivo.js>` antes de incorporarse a la rama principal.
4. **Variables CSS para Colores:** Cualquier componente nuevo debe usar variables CSS existentes (`var(--bg-card)`, `var(--text-primary)`, etc.).
5. **Sanitización de Datos Dinámicos:** Todo dato de MQTT o API debe pasar por `escapeHtml()` antes de insertar en `innerHTML`. Nunca usar `innerHTML` con strings no sanitizados.
6. **Logging Estructurado en Backend:** Todo endpoint REST y el worker MQTT deben generar logs JSON estructurados con `correlation_id` para trazabilidad.
7. **Rate Limiting en Endpoints Públicos:** Los endpoints de la API REST deben incluir rate limiting antes de ser expuestos a producción.
8. **Sin Exposición de Stack Traces:** El manejador de errores de Express no debe exponer `stack` en entorno `production`.

---

## 7. 📊 Resumen de Estado del Sprint

| Categoría | Total Tareas | Implementado | Parcial | Pendiente |
|---|---|---|---|---|
| **Frontend** | 13 | 3 (FE-03, FE-07, BE-06 parcial) | 3 | 7 |
| **Backend** | 10 | 0 | 6 | 4 |
| **DBA** | 5 | 2 (DB-01, DB-03) | 1 | 2 |
| **DevOps** | 7 | 0 | 2 | 5 |
| **TOTAL** | **35** | **5** | **12** | **18** |

> [!IMPORTANT]
> El **Ingestor MQTT (BE-01)** es el bloqueante más crítico de todo el sistema. Sin él, ningún evento del hardware ESP32 se persistirá en la base de datos, aunque el esquema y el servicio de persistencia ya estén listos.

> [!WARNING]
> La tabla `usuarios` **NO existe** en el esquema actual (`001_init_schema.sql`). Antes de implementar RBAC (BE-04), se debe crear esta tabla en una nueva migración.
