# 📋 Plan de Trabajo y Backlog de Tareas — Project Luminaria

> **Rol:** Scrum Master  
> **Ubicación:** `Documentacion/PLAN_DE_TRABAJO_SCRUM.md`  
> **Proyecto:** Sistema de Monitoreo y Alertas Eléctricas (EPET N.º 14 × EPET N.º 20 — Municipalidad de Neuquén)  
> **Estado Actual del Repositorio:** Aplicación Web Frontend Estática (HTML + CSS + JS Vanilla) con integración MQTT WebSockets y modo simulación.

---

## 1. 🔍 Diagnóstico de Arquitectura y Visión General

El proyecto **Luminaria** cuenta actualmente con un prototipo frontend estático 100% funcional en el cliente ([index.html](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/index.html), [js/app.js](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/js/app.js) y [js/mqtt-client.js](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/js/mqtt-client.js)).

Para llevar la plataforma a un entorno de **producción industrial** desplegable en la Municipalidad de Neuquén, debemos evolucionar la arquitectura hacia una solución multicapa:

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

A continuación, se presenta la **división formal del backlog de tareas por especialidad**, estructurada con criterios de aceptación, dependencias y reglas de negocio del contrato JSON existente.

---

## 2. 🎨 Backlog: Equipo Frontend

El equipo de Frontend mantendrá la aplicación ligera e interactiva, adaptándola para consumir datos persistentes de la API REST manteniendo la reactividad MQTT en tiempo real.

| ID | Historia de Usuario / Tarea | Descripción y Criterios de Aceptación | Archivos / Referencias | Prioridad |
|---|---|---|---|---|
| **FE-01** | **Integración con API REST de Backend** | Conectar la app para inicializar los tableros y cargar el historial de alertas desde la API REST (`GET /api/tableros` y `GET /api/alertas`) al arrancar la página, en lugar de inicializar únicamente con mock data local. Preservar el **modo simulación** como fallback. | [js/app.js](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/js/app.js) | **Alta** |
| **FE-02** | **Acción de Resolución de Alertas vía API** | Al hacer clic en "Marcar como resuelta", enviar una petición `PATCH /api/alertas/:id/resolver` al backend. Actualizar el contador de KPIs y banner tras la confirmación exitosa. | [js/app.js](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/js/app.js) | **Alta** |
| **FE-03** | **Preservar Reglas Críticas de UI y Anti-Flash** | Mantenimiento obligatorio del script anti-flash en `<head>` de [index.html](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/index.html#L18-L29), anclaje de pines en `.map-svg-wrapper` ([styles.css](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/css/styles.css)) y variables CSS para el soporte de tema claro/oscuro. | [index.html](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/index.html), [css/styles.css](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/css/styles.css) | **Alta** |
| **FE-04** | **Exportación y Filtros en Consola Telemétrica** | Agregar botones en la pestaña Consola para pausar/reanudar el auto-scroll, filtrar mensajes por topic (`neuquen/iluminacion/#` vs `api/evento`) y exportar logs a CSV/JSON. | [js/app.js](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/js/app.js) | **Media** |
| **FE-05** | **Sistema de Notificaciones Push Web** | Implementar `Notification API` del navegador para emitir notificaciones de escritorio cuando ocurra una alerta `CRITICA` (`BAJA_TENSION` o `DESCONEXION_ABRUPTA_FOCO`), solicitando permisos al usuario. | [js/app.js](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/js/app.js) | **Media** |
| **FE-06** | **Modal de Autenticación de Operadores** | Implementar la interfaz visual de inicio de sesión (Login) para técnicos y administradores de la Municipalidad, almacenando el token JWT en `sessionStorage` / cookie segura. | [index.html](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/index.html) | **Media** |
| **FE-07** | **Validación Sintáctica Preventiva** | Ejecutar validación de código antes de cada entrega mediante `node -c js/app.js` y `node -c js/mqtt-client.js`. | [CLAUDE.md](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/CLAUDE.md#L30-L36) | **Alta** |
| **BE-06** | **Error Boundary y Recuperación ante Fallos de MQTT/UI** | Envolver `processIncomingEvent()` y funciones de render en `try/catch` con logging. Implementar watchdog que detecte DOM inconsistente y recargue la UI. Mantener estado de tableros en `localStorage` como fallback de recuperación. Un payload corrupto no debe destruir la UI. | `js/app.js`, `index.html` | **Crítica** |
| **FE-08** | **Accesibilidad Web WCAG 2.1 AA** | Agregar atributos ARIA a todos los componentes interactivos (tabs, modales, botones, alertas). Implementar navegación completa por teclado. Verificar contraste de colores (mínimo 4.5:1). Agregar `aria-live="polite"` a regiones de alertas dinámicas. | `index.html`, `css/styles.css`, `js/app.js` | **Media** |
| **FE-09** | **Internacionalización i18n (Español / Inglés)** | Extraer textos hardcodeados a diccionario de traducciones. Implementar selector de idioma en header persistente en `localStorage`. Incluir textos de tableros, estados, severidades, KPIs y mensajes de consola. | `js/app.js`, `js/i18n.js` (nuevo) | **Media** |
| **FE-10** | **Documentación de Código JSDoc y Guía de Onboarding** | Agregar JSDoc a todas las funciones públicas. Crear guía de onboarding con requisitos, setup, estructura, flujo de datos y guía de contribución. Un desarrollador nuevo debe poder entender la arquitectura en < 1 hora. | `js/app.js`, `js/mqtt-client.js`, `Documentacion/ONBOARDING.md` | **Baja** |
| **FE-11** | **Dashboard de Analíticas de Uso Básico** | Implementar métricas locales: contador de sesiones, tiempo por tab, eventos procesados, distribución de severidades. Almacenar en localStorage y exportar como JSON desde la UI. | `js/app.js`, `index.html` | **Baja** |
| **FE-12** | **PWA / Service Worker para Funcionalidad Offline** | Service Worker que cacheé assets estáticos. `manifest.json` con nombre/iconos/colores. En modo offline, mostrar último estado de tableros con banner "Sin conexión". Reconectar automáticamente al restaurar conectividad. | `sw.js`, `manifest.json` (nuevos), `index.html` | **Baja** |

---

## 3. ⚙️ Backlog: Equipo Backend

El equipo de Backend desarrollará la API REST y el servicio Ingestor MQTT encargado de escuchar los eventos del hardware de la EPET 14 y persistirlos en la Base de Datos.

| ID | Historia de Usuario / Tarea | Descripción y Criterios de Aceptación | Especificación de Referencia | Prioridad |
|---|---|---|---|---|
| **BE-01** | **Servicio Ingestor MQTT (Worker Subscriber)** | Crear un microservicio (Node.js/FastAPI/Go) que se conecte al broker Mosquitto en TCP `1883`, se suscriba a `neuquen/iluminacion/#` y `api/evento`, valide los payloads y los inserte en la base de datos. | [DOCUMENTACION_TECNICA.md](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/Documentacion/DOCUMENTACION_TECNICA.md#L193-L288) | **Alta** |
| **BE-02** | **Validación del Contrato JSON de Eventos** | Implementar validadores (Schema Zod / Pydantic) estrictos para los 4 tipos de evento coordinados con EPET 14: `BAJA_TENSION`, `DESCONEXION_ABRUPTA_FOCO`, `FOCO_QUEMADO` y `TELEMETRIA_NORMAL`. **No renombrar campos**. | [CONTEXTO_IA.md](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/Documentacion/CONTEXTO_IA.md#L143-L220) | **Alta** |
| **BE-03** | **Endpoints REST de Tableros y Alertas** | Desarrollar la API REST: <br>• `GET /api/tableros` (obtener estados actuales de tableros y focos)<br>• `GET /api/alertas` (historial de alertas con paginado y filtro por severidad)<br>• `PATCH /api/alertas/:id/resolver` (cambiar estado a resuelta). | [DOCUMENTACION_TECNICA_DRAFT(1).md](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/Documentacion/DOCUMENTACION_TECNICA_DRAFT%281%29.md#L125-L130) | **Alta** |
| **BE-04** | **Autenticación JWT y Control de Acceso (RBAC)** | Crear endpoints `POST /api/auth/login` y middleware de autenticación con roles (`Operador`, `Técnico`, `Administrador`). | Espec. Seguridad | **Media** |
| **BE-05** | **API Histórica de Telemetría y Métricas** | Endpoint `GET /api/telemetria/historico?tablero_id=TABLERO_01&desde=...&hasta=...` para alimentar futuras gráficas de tensión y consumo eléctrico. | Espec. Métricas | **Baja** |
| **SEC-01** | **Seguridad en Capa de Red: CORS, Rate Limiting, Security Headers** | Configurar política CORS para dominio de la Municipalidad. Rate limiting por IP (100 req/min público, 1000 req/min autenticado). Headers: `CSP`, `X-Content-Type-Options`, `HSTS`. Requests no autorizados → `403`. Exceso → `429 Retry-After`. | `src/server.js`, `nginx.conf` | **Crítica** |
| **SEC-02** | **Capa de Integridad de Datos en Ingestor MQTT** | Deduplicación por `id_tablero + timestamp` (ventana 5s). Validación tamaño máximo payload (4KB). Rate limiting por tablero (máx 10 evt/s). Cola de mensajes con backpressure si BD no responde. | `src/worker/mqtt_subscriber.py/.js` | **Crítica** |
| **BE-07** | **Connection Pooling y Retry Strategy para PostgreSQL** | Pool de conexiones (min 5, max 20). Retry con backoff exponencial (3 intentos, delay 100ms, factor 2). Health check a PostgreSQL en docker-compose para evitar intentos de conexión prematuros. | Config Backend, `docker-compose.yml` | **Alta** |
| **BE-08** | **Health Check Endpoint y Circuit Breaker** | Endpoint `GET /api/health` con estado de BD, MQTT. Circuit breaker: tras 5 fallos consecutivos de BD, retorna `503 Retry-After` por 30s antes de reintentar. Nginx usa este endpoint para detectar backend caído. | `src/server.js`, `nginx.conf` | **Alta** |
| **BE-09** | **Logging Estructurado y Correlación de Eventos** | Logging JSON con `timestamp`, `level`, `service`, `correlation_id`, `event_type`, `tablero_id`. Propagar correlation_id desde MQTT hasta BD. Rotación de logs (100MB/archivo, 30 días retención). | Config logging Backend/Worker | **Media** |
| **SEC-03** | **Audit Logging y Registro de Seguridad** | Tabla `audit_log` con `user_id`, `action`, `resource`, `ip_address`, `details_json`. Registrar: login/logout, resolución de alertas, accesos a endpoints sensibles, reinicios del worker. Retención 1 año mínimo. | Tabla `audit_log`, middleware auth | **Media** |

---

## 4. 🗄️ Backlog: Administradores de la Base de Datos (DBA)

El equipo DBA diseñará la estructura relacional, optimizaciones de series temporales y políticas de respaldo para almacenar mediciones y eventos del sistema.

| ID | Historia de Usuario / Tarea | Descripción y Criterios de Aceptación | Componentes / Tablas | Prioridad |
|---|---|---|---|---|
| **DB-01** | **Diseño e Implementación de Esquema ER** | Crear la estructura de tablas relacionales en PostgreSQL:<br>• `tableros` (id, nombre, ubicacion, fase, pos_x, pos_y, tension_v, etc.)<br>• `luminarias` (id, tablero_id, estado, corriente_ma, ubicacion)<br>• `alertas` (id, tablero_id, tipo_evento, severidad, timestamp, datos_json, resuelta, resuelta_por, fecha_resolucion)<br>• `usuarios` (id, username, password_hash, rol). | `tableros`, `luminarias`, `alertas`, `usuarios` | **Alta** |
| **DB-02** | **Configuración de Series Temporales (TimescaleDB)** | Configurar la tabla `mediciones_telemetria` como una **Hypertable** en TimescaleDB o particionado por rango de fecha para soportar ingesta masiva de tensión/corriente sin degradación de lectura. | `mediciones_telemetria` | **Alta** |
| **DB-03** | **Estrategia de Índices y Optimización de Queries** | Crear índices compuestos B-Tree en `(tablero_id, timestamp)` y `(severidad, resuelta)` para garantizar respuestas en < 50ms para las vistas del dashboard y mapa. | Indexing Strategy | **Media** |
| **DB-04** | **Políticas de Retención y Purga de Datos (Data Lifecycle)** | Configurar job de agregación diaria/mensual y purga automática de mediciones de telemetría de grano fino mayores a 6 meses para optimizar espacio en disco. | Data Retention Policy | **Media** |
| **DB-05** | **Plan de Backup y Recuperación ante Desastres** | Implementar tareas cron automáticas de respaldos (`pg_dump` diferencial diario + completo semanal) con almacenamiento en volumen seguro. | Backup & Disaster Recovery | **Alta** |

---

## 5. ☁️ Backlog: Administrador de Servidores / DevOps

El SysAdmin / DevOps será responsable de empaquetar, asegurar y desplegar los servicios en los servidores de la Municipalidad de Neuquén.

| ID | Historia de Usuario / Tarea | Descripción y Criterios de Aceptación | Archivos / Componentes | Prioridad |
|---|---|---|---|---|
| **DO-01** | **Configuración y Hardening del Broker Mosquitto** | Configurar Mosquitto en producción con:<br>• Listener TCP `1883` para ESP32.<br>• Listener WebSockets `9001` (`/mqtt`) para el navegador.<br>• Habilitar autenticación por credenciales/certificados para los dispositivos hardware de EPET 14. | [README_MQTT_UI.md](file:///home/pachorra/PROYECTOS/Proyecto%20Luminaria/Luminaria-/README_MQTT_UI.md#L48-L64), `mosquitto.conf` | **Alta** |
| **DO-02** | **Contenerización Completa (`docker-compose.yml`)** | Crear `Dockerfile` para Backend y `docker-compose.yml` integrando: Broker Mosquitto, Backend REST, PostgreSQL/TimescaleDB y Nginx Reverse Proxy. | `Dockerfile`, `docker-compose.yml` | **Alta** |
| **DO-03** | **Servidor Web y Proxy Inverso Nginx (HTTPS & WSS)** | Configurar Nginx para servir los archivos estáticos de la UI web, enrutar la API REST (`/api/`) y realizar proxy passthrough seguro de WebSockets para MQTT (`/mqtt`). Instalar certificados SSL/TLS (Let's Encrypt / Certbot). | `nginx.conf`, Certbot | **Alta** |
| **DO-04** | **Pipeline Integrado de CI/CD** | Implementar GitHub Actions / GitLab CI que ejecute validaciones estáticas (`node -c`), builds de contenedores Docker y despliegue automático al servidor de staging/producción. | `.github/workflows/ci.yml` | **Media** |
| **DO-05** | **Monitoreo de Infraestructura y Logs** | Implementar métricas con Prometheus + Grafana para supervisar estado de salud de contenedores, uso de memoria/CPU y conexiones activas en Mosquitto. | Prometheus, Grafana | **Media** |
| **DO-06** | **Separación de Entornos Staging / Producción** | Archivos `.env` separados para staging y producción. `docker-compose.prod.yml` con restricciones de recursos (CPU/RAM limits). Variables sensibles nunca en código fuente ni en historial de git. | `.env.production`, `.env.staging`, `docker-compose.prod.yml` | **Alta** |
| **DO-07** | **Pruebas de Carga y Stress Testing** | Scripts con `k6`/`locust`/`artillery` que simulen: 50 ESP32 simultáneos, 100 usuarios web, pico de 500 msgs MQTT en 10s. Medir latencia, memoria y tiempo de recuperación. Documentar capacity plan. | Scripts test, `docker-compose.test.yml` | **Media** |

---

## 6. ✅ Criterios de Aceptación Transversales (Definition of Done)

1. **Contrato JSON Intacto:** Ninguna tarea de Backend o Frontend debe modificar los nombres de las claves JSON del hardware (`tipo_evento`, `id_tablero`, `tension_medida_v`, `id_foco`, etc.).
2. **Respeto de Reglas de UI:** Las modificaciones en Frontend deben mantener el soporte de **Tema Claro / Oscuro**, la respuesta **Responsive** en dispositivos móviles y el anclaje del **Mapa de Zonas**.
3. **Validación Sin Errores:** Todos los cambios en archivos JavaScript deben pasar la verificación `node -c <archivo.js>` antes de incorporarse a la rama principal.
4. **Variables CSS para Colores:** Cualquier componente nuevo debe usar las variables CSS existentes (`var(--bg-card)`, `var(--text-primary)`, etc.) en lugar de colores hardcodeados, para que el tema claro los respete automáticamente.
5. **Sanitización de Datos Dinámicos:** Todo dato proveniente de MQTT o la API debe pasar por `escapeHtml()` antes de insertarse en `innerHTML`. Nunca usar `innerHTML` con strings no sanitizados.
6. **Logging Estructurado en Backend:** Todo endpoint REST y el worker MQTT deben generar logs JSON estructurados con `correlation_id` para trazabilidad.
7. **Rate Limiting en Endpoints Públicos:** Los endpoints de la API REST deben incluir rate limiting antes de ser expuestos a producción.
