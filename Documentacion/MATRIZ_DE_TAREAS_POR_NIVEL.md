# 📊 Matriz de Tareas por Nivel de Criticidad — Project Luminaria

> **Rol:** Scrum Master  
> **Ubicación:** `Documentacion/MATRIZ_DE_TAREAS_POR_NIVEL.md`  
> **Proyecto:** Sistema de Monitoreo y Alertas Eléctricas (EPET N.º 14 × EPET N.º 20 — Municipalidad de Neuquén)

---

## 1. 📐 Definición de Niveles de Criticidad

Para priorizar eficientemente el trabajo de los equipos (**Frontend**, **Backend**, **DBA** y **DevOps / SysAdmin**), las tareas se han clasificado en cuatro niveles de criticidad e impacto:

| Nivel | Etiqueta | Descripción e Impacto Operativo | Riesgo si se posterga |
|---|---|---|---|
| 🔴 **4. CRÍTICO** | **Bloqueante / Producción** | Requisitos fundamentales de infraestructura, ingesta telemétrica, estabilidad de UI o contrato de datos. Sin esto el sistema **no puede funcionar en producción**. | Caída del servicio, pérdida de telemetría en tiempo real o inconsistencia de datos con el hardware ESP32. |
| 🟠 **3. ALTO** | **Esencial / MVP** | Funcionalidades centrales de la arquitectura objetivo (API REST, persistencia relacional en BD, migración de cliente local a servidor). | El sistema funcionará solo como prototipo cliente sin persistencia real. |
| 🟡 **2. MODERADO** | **Funcional / Operativo** | Mejoras de experiencia de usuario, seguridad RBAC, automatizaciones de despliegue y notificaciones de escritorio. | Menor control de acceso o falta de avisos proactivos al personal técnico. |
| 🟢 **1. LEVE** | **Secundario / Optimización** | Herramientas accesorias, exportación de reportes, métricas avanzadas y refinamientos estéticos. | Ningún impacto funcional directo en la operación diaria. |

---

## 2. 🗂️ Cuadro General de Tareas Clasificadas (Matriz)

| ID Tarea | Rol Asignado | Tarea / Historia de Usuario | Nivel de Criticidad | Estimación (Story Points) | Impacto / Riesgo |
|---|---|---|---|---|---|
| **DO-01** | DevOps | Configuración y Hardening de Broker Mosquitto (TCP 1883 + WSS 9001) | 🔴 **CRÍTICO** | 5 SP | 🔴 Si el broker falla o no soporta WebSockets/TCP, se interrumpe la comunicación con los ESP32 y la Web. |
| **BE-02** | Backend | Validación del Contrato JSON de Eventos (`BAJA_TENSION`, `FOCO_QUEMADO`, etc.) | 🔴 **CRÍTICO** | 3 SP | 🔴 Renombrar campos rompe la integración con el hardware desarrollado por EPET 14. |
| **BE-01** | Backend | Servicio Ingestor Worker MQTT (Subscriber TCP 1883 -> BD) | 🔴 **CRÍTICO** | 8 SP | 🔴 Sin este worker, los eventos de hardware se pierden y no se guardan en la Base de Datos. |
| **FE-03** | Frontend | Preservar Script Anti-flash, Tema Claro/Oscuro y Anclaje de Mapa SVG | 🔴 **CRÍTICO** | 2 SP | 🔴 Mover `#mapPinsContainer` fuera de `.map-svg-wrapper` desalinea los pines en dispositivos móviles. |
| **DO-03** | DevOps | Proxy Inverso Nginx + Certificados SSL/TLS (HTTPS & WSS) | 🔴 **CRÍTICO** | 5 SP | 🔴 El navegador bloquea conexiones WebSockets no seguras (ws://) si la app corre bajo HTTPS. |
| **SEC-01** | Backend / DevOps | Seguridad en Capa de Red: CORS, Rate Limiting y Security Headers | 🔴 **CRÍTICO** | 5 SP | 🔴 Sin CORS el frontend no puede consumir la API. Sin rate limiting, un ataque DDoS o bug de hardware satura el servidor. Sin CSP/HSTS, la app es vulnerable a XSS. |
| **SEC-02** | Backend | Capa de Integridad de Datos en Ingestor MQTT (deduplicación, secuencia, límites) | 🔴 **CRÍTICO** | 3 SP | 🔴 Un ESP32 con firmware defectuoso puede enviar miles de mensajes duplicados por segundo. Sin deduplicación y límites de tamaño, la BD se satura y se pierde telemetría válida. |
| **BE-06** | Frontend | Error Boundary y Recuperación ante Fallos de MQTT/UI | 🔴 **CRÍTICO** | 3 SP | 🔴 Si `processIncomingEvent()` lanza una excepción, toda la UI deja de funcionar sin posibilidad de recuperación. En producción esto equivale a una caída del servicio. |
| **BE-03** | Backend | Endpoints API REST (`GET /api/tableros`, `GET /api/alertas`, `PATCH /api/alertas/:id`) | 🟠 **ALTO** | 8 SP | 🟠 Necesario para que el Frontend obtenga estado persistente y resuelva alertas en el servidor. |
| **DB-01** | DBA | Diseño e Implementación de Esquema Relacional ER (PostgreSQL) | 🟠 **ALTO** | 5 SP | 🟠 Define las estructuras de `tableros`, `luminarias`, `alertas` y `usuarios`. |
| **DB-02** | DBA | Configuración de Series Temporales (TimescaleDB / Particionado) | 🟠 **ALTO** | 5 SP | 🟠 Previene saturación del disco por ingesta masiva de mediciones eléctricas. |
| **FE-01** | Frontend | Integración con API REST de Backend (manteniendo Simulación fallback) | 🟠 **ALTO** | 5 SP | 🟠 Permite a la interfaz consumir datos reales del servidor en lugar de datos mock. |
| **FE-02** | Frontend | Acción de Resolución de Alertas vía API REST | 🟠 **ALTO** | 3 SP | 🟠 Garantiza que al resolver una alerta se sincronice en la base de datos municipal. |
| **DO-02** | DevOps | Contenerización Completa con `docker-compose.yml` | 🟠 **ALTO** | 5 SP | 🟠 Garantiza la replicabilidad del entorno de producción en servidores de la Municipalidad. |
| **DB-05** | DBA | Plan de Backup y Recuperación ante Desastres (`pg_dump` cron) | 🟠 **ALTO** | 3 SP | 🟠 Riesgo de pérdida de historial ante fallos eléctricos o de hardware del servidor. |
| **BE-07** | Backend / DBA | Connection Pooling y Retry Strategy para PostgreSQL | 🟠 **ALTO** | 3 SP | 🟠 Sin pooling, cada conexión MQTT cre instancia nueva a la BD. Con 50+ ESP32 conectados simultáneamente, PostgreSQL se satura y los eventos se pierden. |
| **DO-06** | DevOps | Separación de Entornos Staging / Producción con Variables de Entorno | 🟠 **ALTO** | 3 SP | 🟠 Desplegar directo a producción sin staging provoca caídas del servicio por configuración incorrecta. Variables de entorno evitan hardcodear credenciales. |
| **BE-08** | Backend | Health Check Endpoint y Patrón Circuit Breaker | 🟠 **ALTO** | 2 SP | 🟠 Sin health check, Nginx no puede detectar si el backend está caído. Sin circuit breaker, un fallo de BDPropagación en cascada al resto del sistema. |
| **BE-04** | Backend | Autenticación JWT y Control de Acceso por Roles (RBAC) | 🟡 **MODERADO** | 5 SP | 🟡 Protege los endpoints de administración para que solo personal autorizado resuelva alertas. |
| **FE-06** | Frontend | Modal de Autenticación de Operadores (UI Login) | 🟡 **MODERADO** | 3 SP | 🟡 Permite al usuario ingresar sus credenciales para obtener el token JWT. |
| **FE-05** | Frontend | Sistema de Notificaciones Push Web (`Notification API`) | 🟡 **MODERADO** | 3 SP | 🟡 Alerta al técnico de guardia aunque no tenga la pestaña del navegador activa. |
| **DO-04** | DevOps | Pipeline Integrado de CI/CD (GitHub Actions / GitLab CI) | 🟡 **MODERADO** | 5 SP | 🟡 Automatiza pruebas estáticas y despliegues sin intervención manual. |
| **DB-03** | DBA | Estrategia de Índices B-Tree en `(tablero_id, timestamp)` | 🟡 **MODERADO** | 2 SP | 🟡 Optimiza la velocidad de respuesta de las consultas del mapa y listados. |
| **DB-04** | DBA | Políticas de Retención de Datos y Aggregation Jobs | 🟡 **MODERADO** | 3 SP | 🟡 Mantiene la base de datos limpia eliminando telemetría cruda antigua. |
| **DO-05** | DevOps | Monitoreo de Infraestructura con Prometheus + Grafana | 🟡 **MODERADO** | 5 SP | 🟡 Permite auditar uso de CPU, RAM y conexiones activas al broker. |
| **FE-08** | Frontend | Accesibilidad Web WCAG 2.1 AA (ARIA, Contraste, Navegación por Teclado) | 🟡 **MODERADO** | 3 SP | 🟡 La app no tiene atributos ARIA ni soporte de navegación por teclado. Técnicos con discapacidad visual no pueden usar el dashboard. Incumplimiento de normativa de accesibilidad. |
| **FE-09** | Frontend | Internacionalización i18n (Español / Inglés) | 🟡 **MODERADO** | 3 SP | 🟡 Todos los textos están hardcodeados en español. Si la Municipalidad expande el sistema a otras regiones o si se necesita documentación técnica en inglés, no hay forma de traducir sin modificar código. |
| **SEC-03** | Backend / DBA | Audit Logging y Registro de Seguridad | 🟡 **MODERADO** | 3 SP | 🟡 Sin logs de auditoría no hay forma de saber quién resolvió una alerta, cuándo se autenticó un operador o si hubo intentos de acceso no autorizados. Requisito de cumplimiento normativo. |
| **DO-07** | DevOps | Pruebas de Carga y Stress Testing | 🟡 **MODERADO** | 3 SP | 🟡 Sin load testing no se conoce la capacidad real del sistema. Un pico de tráfico real (ej: tormenta eléctrica que genera eventos masivos) puede colapsar el servidor sin aviso. |
| **BE-09** | Backend | Logging Estructurado y Correlación de Eventos | 🟡 **MODERADO** | 2 SP | 🟡 Los logs actuales no tienen formato consistente ni correlación entre eventos. Para diagnosticar problemas en producción se necesita trazabilidad entre MQTT→Worker→BD. |
| **FE-04** | Frontend | Exportación CSV/JSON y Filtros Avanzados en Consola MQTT | 🟢 **LEVE** | 2 SP | 🟢 Herramienta de diagnóstico secundario para el desarrollador/técnico. |
| **BE-05** | Backend | API Histórica de Telemetría para Gráficas de Consumo | 🟢 **LEVE** | 5 SP | 🟢 Requerido solo para reportes estadísticos a futuro. |
| **FE-07** | Frontend | Validación Sintáctica Automática (`node -c js/app.js`) | 🟢 **LEVE** | 1 SP | 🟢 Previene errores de sintaxis antes de subir cambios al repositorio. |
| **FE-10** | Frontend | Documentación de Código JSDoc y Guía de Onboarding para Desarrolladores | 🟢 **LEVE** | 2 SP | 🟢 Sin documentación interna, nuevos desarrolladores tardan días en entender la arquitectura. El archivo CLAUDE.md es para IA, no para humanos. |
| **FE-11** | Frontend | Dashboard de Analíticas de Uso Básico (Páginas vistas, Eventos por hora) | 🟢 **LEVE** | 2 SP | 🟢 Sin métricas de uso no se puede priorizar mejoras ni justificar inversiones a la Municipalidad con datos reales. |
| **FE-12** | Frontend | PWA / Service Worker para Funcionalidad Offline Básica | 🟢 **LEVE** | 3 SP | 🟢 En zonas con conectividad intermitente (ej: parques, costaneras), una PWA podría mostrar el último estado conocido de los tableros sin conexión. |

---

## 3. 🔍 Desglose Detallado por Nivel de Criticidad

### 🔴 Nivel 4: CRÍTICO (Prioridad Máxima - Bloqueantes de Producción)

#### Tarea `DO-01`: Configuración de Mosquitto MQTT
* **Rol:** DevOps
* **Archivos involucrados:** `mosquitto.conf`, [README_MQTT_UI.md](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/README_MQTT_UI.md#L48-L64)
* **Requisito:** Habilitar port `1883` (protocolo MQTT puro para ESP32) y port `9001` (protocolo WebSockets `/mqtt` para navegadores web).
* **Criterio de Aceptación:** Probar recepción de eventos reales desde hardware o cliente Paho MQTT sin desconexiones abruptas.

#### Tarea `BE-01`: Worker Subscriber Ingestor MQTT
* **Rol:** Backend
* **Archivos involucrados:** `src/worker/mqtt_subscriber.py` / `.js`
* **Requisito:** Servicio de fondo con reconexión automática que escuche `neuquen/iluminacion/#` y persista en PostgreSQL.
* **Criterio de Aceptación:** Cada evento publicado por el ESP32 debe reflejarse en la BD en menos de 200ms.

#### Tarea `BE-02`: Validación del Contrato JSON
* **Rol:** Backend
* **Archivos involucrados:** [DOCUMENTACION_TECNICA.md](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/Documentacion/DOCUMENTACION_TECNICA.md#L193-L288)
* **Requisito:** Validar los campos `tipo_evento`, `id_tablero`, `tension_medida_v`, `id_foco`, `corriente_actual_ma`, `focos_restaurados`.
* **Criterio de Aceptación:** Rechazar payloads mal formados con log de advertencia sin tumbar el worker ingestor.

#### Tarea `FE-03`: Preservación de UI, Tema Claro/Oscuro y Anti-Flash
* **Rol:** Frontend
* **Archivos involucrados:** [index.html](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/index.html), [css/styles.css](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/css/styles.css), [js/app.js](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/js/app.js)
* **Requisito:** Mantener script anti-flash inline en `<head>`, contenedor `#mapPinsContainer` relativo a `.map-svg-wrapper` y soporte de variables CSS.
* **Criterio de Aceptación:** Sin parpadeos al cargar en tema claro y pines alineados en pantallas móviles (< 560px).

#### Tarea `SEC-01`: Seguridad en Capa de Red — CORS, Rate Limiting, Security Headers
* **Rol:** Backend / DevOps
* **Archivos involucrados:** `src/server.js` (o equivalente), `nginx.conf`, `docker-compose.yml`
* **Requisito:** Configurar política CORS que permita solo el dominio de la Municipalidad. Implementar rate limiting por IP (ej: 100 req/min por endpoint público, 1000 req/min por API autenticada). Agregar headers de seguridad: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`.
* **Criterio de Aceptación:** Requests desde dominios no autorizados reciben `403 Forbidden`. Requests que superen el límite reciben `429 Too Many Requests` con `Retry-After`. Auditoría con `curl -I` confirma headers presentes.

#### Tarea `SEC-02`: Capa de Integridad de Datos en Ingestor MQTT
* **Rol:** Backend
* **Archivos involucrados:** `src/worker/mqtt_subscriber.py` / `.js`, esquema BD
* **Requisito:** Implementar: (1) deduplicación por `id_tablero + timestamp` con ventana de 5 segundos, (2) validación de tamaño máximo de payload (4KB), (3) rate limiting por `id_tablero` (máx 10 eventos/segundo por tablero), (4) cola de mensajes con backpressure si la BD no responde.
* **Criterio de Aceptación:** Un ESP32 que envíe 100 mensajes idénticos en 1 segundo genera solo 1 inserción. Payloads > 4KB se rechazan con log de advertencia. La BD no se saturay el worker no crashea bajo carga extrema.

#### Tarea `BE-06`: Error Boundary y Recuperación ante Fallos en Frontend
* **Rol:** Frontend
* **Archivos involucrados:** `js/app.js`, `index.html`
* **Requisito:** Envolver `processIncomingEvent()` y las funciones de render en `try/catch` con logging a la consola de la app. Implementar watchdog que detecte si el DOM está en estado inconsistente y recargue automáticamente la UI (sin recargar la página completa). Mantener el estado de los tableros en `localStorage` como fallback de recuperación.
* **Criterio de Aceptación:** Un payload MQTT malicioso o corrupto no destruye la UI. La app muestra banner de warning y continúa funcionando. Al recargar la página, se recuperan los últimos tableros conocidos desde `localStorage`.

---

### 🟠 Nivel 3: ALTO (Esenciales para el MVP)

#### Tarea `BE-03` & `FE-01`: API REST y Conexión Frontend
* **Roles:** Backend & Frontend
* **Requisito:** Endpoints `GET /api/tableros` y `GET /api/alertas`. El frontend debe consumirlos al cargar la página.
* **Criterio de Aceptación:** Si la API REST está disponible, la UI muestra datos reales de la BD. Si la API falla, entra en modo simulación local.

#### Tarea `DB-01` & `DB-02`: Esquema ER & TimescaleDB
* **Rol:** DBA
* **Requisito:** Crear tablas relacionales `tableros`, `luminarias`, `alertas` e hypertable para `mediciones_telemetria`.
* **Criterio de Aceptación:** Scripts de migración SQL limpios y ejecutables desde contenedor Docker.

#### Tarea `DO-02`: Contenerización `docker-compose.yml`
* **Rol:** DevOps
* **Requisito:** Orquestar en un solo comando (`docker compose up -d`) los contenedores de Mosquitto, Backend, DB Nginx.
* **Criterio de Aceptación:** Despliegue funcional en un servidor Linux recién instalado.

#### Tarea `BE-07`: Connection Pooling y Retry Strategy para PostgreSQL
* **Rol:** Backend / DBA
* **Archivos involucrados:** Configuración del Backend (pool de conexiones), `docker-compose.yml` (healthcheck de PG)
* **Requisito:** Configurar pool de conexiones con mínimo 5, máximo 20 conexiones. Implementar retry con backoff exponencial (intentos: 3, delay inicial: 100ms, factor: 2). Agregar health check a PostgreSQL en `docker-compose.yml` para que el backend no intente conectarse a una BD que aún no está lista.
* **Criterio de Aceptación:** Si PostgreSQL se reinicia, el backend reconecta automáticamente en < 10 segundos sin perder eventos MQTT (los mensajes se acumulan en cola interna del worker).

#### Tarea `DO-06`: Separación de Entornos Staging / Producción
* **Rol:** DevOps
* **Archivos involucrados:** `.env.production`, `.env.staging`, `docker-compose.prod.yml`, `docker-compose.staging.yml`
* **Requisito:** Crear archivos `.env` separados para staging y producción con variables sensibles (credenciales BD, URLs de Mosquitto, dominios). Implementar `docker-compose.prod.yml` con restricciones de recursos (CPU/RAM limits) y `docker-compose.staging.yml` para pruebas.
* **Criterio de Aceptación:** `docker compose --env-file .env.staging up -d` levanta un entorno de pruebas aislado. Variables de producción nunca están en el código fuente ni en el historial de git.

#### Tarea `BE-08`: Health Check Endpoint y Patrón Circuit Breaker
* **Rol:** Backend
* **Archivos involucrados:** `src/server.js` (o equivalente), configuración de Nginx
* **Requisito:** Implementar endpoint `GET /api/health` que retorne estado de BD, Redis (si aplica) y servicio MQTT. Implementar circuit breaker que, tras 5 fallos consecutivos de BD, devuelva respuestas 503 con `Retry-After` durante 30 segundos antes de reintentar.
* **Criterio de Aceptación:** `curl localhost:3000/api/health` retorna `{"status":"healthy","db":"connected","mqtt":"connected"}`. Si la BD cae, el endpoint retorna `{"status":"degraded","db":"disconnected"}` y Nginxredirige al frontend al modo simulación.

---

### 🟡 Nivel 2: MODERADO (Funcional / Operativo)

#### Tarea `BE-04`, `FE-06`: Autenticación JWT / Login
* **Roles:** Backend & Frontend
* **Requisito:** Login modal en el header para que solo operadores autenticados puedan marcar alertas como resueltas.
* **Criterio de Aceptación:** El token JWT debe expirar a las 8 horas y guardarse de forma segura.

#### Tarea `FE-05`: Notificaciones Push Web
* **Rol:** Frontend
* **Requisito:** Notificación de escritorio al detectar `BAJA_TENSION` o `DESCONEXION_ABRUPTA_FOCO`.
* **Criterio de Aceptación:** Funcionar en navegadores Chrome/Firefox/Edge con solicitud de permiso explícita.

#### Tarea `DO-04` & `DO-05`: CI/CD & Monitoreo Prometheus
* **Rol:** DevOps
* **Requisito:** Automatización de pruebas y tablero Grafana para consumo de RAM, CPU y estado de conectividad MQTT.
* **Criterio de Aceptación:** Grafana mostrando métricas en tiempo real.

#### Tarea `FE-08`: Accesibilidad Web WCAG 2.1 AA
* **Rol:** Frontend
* **Archivos involucrados:** `index.html`, `css/styles.css`, `js/app.js`
* **Requisito:** Agregar atributos ARIA a todos los componentes interactivos (tabs, modales, botones, alertas). Implementar navegación completa por teclado (Tab, Enter, Escape). Verificar contraste de colores (mínimo 4.5:1 para texto normal). Agregar `aria-live="polite"` a las regiones de alertas dinámicas para que los lectores de pantalla anuncien cambios.
* **Criterio de Aceptación:** Auditoría con Lighthouse Accessibility score ≥ 90. Navegación funcional 100% por teclado sin mouse. Todos los estados de tableros announceables por screen readers.

#### Tarea `FE-09`: Internacionalización i18n (Español / Inglés)
* **Rol:** Frontend
* **Archivos involucrados:** `js/app.js`, `js/i18n.js` (nuevo), `index.html`
* **Requisito:** Extraer todos los textos hardcodeados del HTML y JS a un diccionario de traducciones (`es.json`, `en.json`). Implementar selector de idioma en el header que persista en `localStorage`. Los textos incluyen: nombres de tableros, estados de focos, severidades, KPIs, mensajes de consola.
* **Criterio de Aceptación:** Al cambiar idioma, toda la UI se actualiza sin recarga. El selector persiste entre sesiones. El modo de consola también traduce los mensajes de eventos.

#### Tarea `SEC-03`: Audit Logging y Registro de Seguridad
* **Rol:** Backend / DBA
* **Archivos involucrados:** Tabla `audit_log` (nueva), middleware de autenticación, worker MQTT
* **Requisito:** Crear tabla `audit_log` con campos: `id`, `timestamp`, `user_id`, `action`, `resource`, `ip_address`, `details_json`. Registrar: (1) cada login/logout, (2) cada resolución de alerta, (3) cada acceso a endpoints sensibles, (4) cada reinicio del worker MQTT. Retención: 1 año mínimo.
* **Criterio de Aceptación:** Query `SELECT * FROM audit_log WHERE user_id = ?` retorna historial completo de acciones de un operador. Los logs no contienen contraseñas ni tokens JWT.

#### Tarea `DO-07`: Pruebas de Carga y Stress Testing
* **Rol:** DevOps
* **Archivos involucrados:** Scripts de test (`k6`, `locust` o `artillery`), `docker-compose.test.yml`
* **Requisito:** Crear scripts de stress testing que simulen: (1) 50 ESP32 conectados simultáneamente enviando eventos cada 5 segundos, (2) 100 usuarios web accediendo al dashboard, (3) pico de 500 mensajes MQTT en 10 segundos (simulando tormenta eléctrica). Medir latencia de respuesta, uso de memoria y tiempo de recuperación.
* **Criterio de Aceptación:** El sistema soporta 50 ESP32 + 100 usuarios web sin degradación mayor a 20% en tiempos de respuesta. Documentar límites conocidos y capacity plan.

#### Tarea `BE-09`: Logging Estructurado y Correlación de Eventos
* **Rol:** Backend
* **Archivos involucrados:** Configuración de logging del Backend y Worker, `docker-compose.yml` (volumen de logs)
* **Requisito:** Implementar logging JSON estructurado con campos: `timestamp`, `level`, `service`, `correlation_id`, `event_type`, `tablero_id`, `message`. Propagar `correlation_id` desde MQTT message hasta la inserción en BD para trazabilidad completa. Configurar rotación de logs (máx 100MB por archivo, retención 30 días).
* **Criterio de Aceptación:** Un evento MQTT malformado genera un log con `correlation_id` que permite rastrear desde la recepción hasta el rechazo. `docker logs backend` muestra JSON estructurado, no texto plano.

---

### 🟢 Nivel 1: LEVE (Secundario / Optimización)

#### Tarea `FE-04`: Exportación y Filtros en Consola
* **Rol:** Frontend
* **Requisito:** Botón para descargar el historial de mensajes de la consola en formato CSV o JSON.
* **Criterio de Aceptación:** Archivo descargado correctamente desde el navegador.

#### Tarea `BE-05`: API Histórica de Telemetría
* **Rol:** Backend
* **Requisito:** Endpoint de métricas históricas agregadas por hora o día.
* **Criterio de Aceptación:** Respuesta JSON en menos de 100ms para rangos de hasta 30 días.

#### Tarea `FE-10`: Documentación de Código JSDoc y Guía de Onboarding
* **Rol:** Frontend
* **Archivos involucrados:** `js/app.js`, `js/mqtt-client.js`, `Documentacion/ONBOARDING.md` (nuevo)
* **Requisito:** Agregar comentarios JSDoc a todas las funciones públicas de `app.js` y `mqtt-client.js`. Crear guía de onboarding con: (1) requisitos previos, (2) instrucciones de setup local, (3) estructura de archivos, (4) flujo de datos, (5) guía de contribución.
* **Criterio de Aceptación:** Un desarrollador nuevo puede levantar el proyecto y entender la arquitectura en < 1 hora usando la guía. `jsdoc` genera documentación HTML sin errores.

#### Tarea `FE-11`: Dashboard de Analíticas de Uso Básico
* **Rol:** Frontend
* **Archivos involucrados:** `js/app.js`, `index.html` (nuevo tab o modal)
* **Requisito:** Implementar métricas locales de uso: (1) contador de sesiones (localStorage), (2) tiempo de permanencia en cada tab, (3) cantidad de eventos procesados por sesión, (4) distribución de severidades. Estas métricas se almacenan localmente y se pueden exportar como JSON.
* **Criterio de Aceptación:** Al cerrar y reabrir la app, se conservan las métricas de la sesión anterior. El usuario puede exportar un reporte de uso en JSON desde la UI.

#### Tarea `FE-12`: PWA / Service Worker para Funcionalidad Offline
* **Rol:** Frontend
* **Archivos involucrados:** `sw.js` (nuevo), `manifest.json` (nuevo), `index.html`
* **Requisito:** Crear Service Worker que cacheé los assets estáticos (HTML, CSS, JS, CDN de Paho). Implementar `manifest.json` con nombre, iconos y colores del tema. En modo offline, mostrar el último estado conocido de los tableros con banner "Sin conexión".
* **Criterio de Aceptación:** La app carga sin conexión a internet después de la primera visita. El banner "Conectado/Desconectado" refleja correctamente el estado. Los eventos MQTT nuevos se procesan al reconectar.

---

## 4. 📈 Distribución de Carga de Trabajo (Story Points por Nivel)

```
Nivel Crítico  (🔴): [████████████████████████████] 34 SP (26%)
Nivel Alto     (🟠): [████████████████████████████████████] 42 SP (32%)
Nivel Moderado (🟡): [████████████████████████████████] 40 SP (31%)
Nivel Leve     (🟢): [███████████] 15 SP (11%)

Total del Proyecto: 131 Story Points
```

---

## 5. 🐞 Bitácora de Bugs — Sección Backend (Reportar / Eliminar)

> **Uso:** Cada bug del backend se registra acá con un ID `BB-NN`. El estado avanza de **📌 REPORTADO → 🔧 EN PROGRESO → ✅ ELIMINADO**.
> **Enlace:** Detalle completo en `Documentacion/REPORTE_REVISION_SENIOR.md`.

| ID Bug | Estado | Nivel | Descripción del Bug | Archivos Afectados | Eliminación / Plan |
|---|---|---|---|---|---|
| **BB-01** | ✅ **ELIMINADO** | 🔴 | `errorHandler.js` exportaba un objeto `{ errorHandler }` y `app.js` hacía `app.use(errorHandler)` → TypeError al arrancar: el backend **no iniciaba**. | `backend/src/middlewares/errorHandler.js`, `backend/src/app.js` | Se exporta la función directamente (`module.exports = errorHandler`). Verificado: `node server.js` arranca. |
| **BB-02** | ✅ **ELIMINADO** | 🟠 | Sin handler de ruta 404: rutas inexistentes respondían el HTML por defecto de Express en vez de JSON consistente. | `backend/src/app.js` | Middleware 404 JSON antes del errorHandler. Verificado: `GET /api/inexistente → 404`. |
| **BB-03** | ✅ **ELIMINADO** | 🟡 | `server.js` no manejaba `SIGTERM/SIGINT` ni `uncaughtException` → cierres sucios y pérdida de conexiones/eventos. | `backend/server.js` | `shutdown(signal)` con `server.close()` + timeout de fuerza `unref()`. Verificado: SIGTERM → exit 0. |
| **BB-04** | ✅ **ELIMINADO** | 🟡 | Sin request logger: sin trazabilidad de requests (`MÉTODO URL STATUS DURACIÓN`). Complementa `BE-09`. | `backend/src/app.js` | Logger inline sin dependencias. Verificado en logs. |
| **BB-05** | ✅ **ELIMINADO** | 🟢 | Log de inicio mostraba `http://localhost:PORT/health` pero la ruta real es `/api/health`. | `backend/server.js` | Mensaje corregido. |
| **BB-06** | ✅ **ELIMINADO** | 🔴 | CORS abierto (`app.use(cors())` aceptaba cualquier origen). | `backend/src/app.js`, `backend/.env.example` | Lista blanca dinámica configurable por `CORS_ORIGIN` con orígenes locales permitidos en dev. |
| **BB-07** | ✅ **ELIMINADO** | 🔴 | Sin rate limiting por IP ni límites de payload/body. | `backend/src/app.js`, `backend/package.json` | `express-rate-limit` (100 req/min por IP) + límite de payload JSON 1MB. |
| **BB-08** | ✅ **ELIMINADO** | 🟢 | Manejo de errores sin control de entorno. | `backend/src/app.js` | Handler centralizado que oculta `stack` fuera de development y responde JSON uniforme. |

### Métricas de la Bitácora
- **Total bugs backend registrados:** 8
- **Eliminados (✅):** 8 · **Reportados abiertos (📌):** 0
- **Bloqueantes pendientes:** Ninguno (todos resueltos).
