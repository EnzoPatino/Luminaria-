# Documentacion Tecnica - Project Luminaria

**Sistema de Monitoreo y Alertas Electricas en Tiempo Real**  
**Municipalidad de Neuquen**  
**Version documentada:** Septiembre 2026

---

## 1. Alcance Actual

Project Luminaria es una plataforma integral de monitoreo inteligente de tableros electricos de alumbrado publico. La arquitectura del sistema esta compuesta por:

1. **Frontend Web (Vanilla JS + Supabase Client):** Panel de control institucional en tiempo real, consumo de telemetría por WebSockets/MQTT, mapas interactivos SVG, gráficos analíticos y persistencia en la nube mediante Supabase. Incluye modo de simulación offline como fallback de tolerancia a fallos.
2. **Backend REST & Worker MQTT (Node.js + Express):** Servicio API para gestión de tableros, alertas y health check, junto a un microservicio worker que ingesta eventos por TCP (puerto 1883) directamente a PostgreSQL.
3. **Persistencia Híbrida de Base de Datos:**
   * **Supabase Cloud (PostgreSQL 15+):** Almacenamiento administrado en la nube con Row Level Security (RLS), tiempo real y sincronización persistente de tableros y alertas (`supabase_schema.sql`).
   * **PostgreSQL Local:** Motor relacional con migraciones (`001_init_schema.sql`), ingestión de series temporales masivas de sensores y mantenimiento automático con agregaciones diarias.
4. **Infraestructura Contenerizada:** Broker Eclipse Mosquitto con perfiles de acceso (TCP 1883 + WebSockets 9001), PostgreSQL y proxy inverso Nginx.

> La documentación detallada para el equipo de base de datos se encuentra en [`Documentacion/MANUAL_BASE_DE_DATOS.md`](MANUAL_BASE_DE_DATOS.md).

## 2. Estructura del Repositorio

```text
Project_Luminaria/
|-- index.html
|-- css/
|   |-- global.css
|   |-- tableros.css
|   |-- mapa.css
|   |-- alertas.css
|   |-- consola.css
|   |-- modales.css
|   `-- telemetria.css
|-- js/
|   |-- app.js
|   |-- mqtt-client.js
|   `-- supabase-client.js
|-- backend/
|   |-- server.js
|   |-- package.json
|   `-- src/
|       |-- app.js
|       |-- config/
|       |   |-- database.js (Pool pg con queryWithRetry y backoff exponencial)
|       |   `-- index.js
|       |-- controllers/
|       |   |-- alertaController.js (Resolución con trazabilidad de usuario)
|       |   |-- authController.js (Login, registro con Zod)
|       |   |-- configController.js
|       |   |-- eventController.js
|       |   |-- tableroController.js
|       |   `-- uplinkController.js
|       |-- db/
|       |   `-- migrations/
|       |       |-- 001_init_schema.sql
|       |       `-- 002_usuarios_y_audit.sql (Usuarios, RBAC y audit_log)
|       |-- middlewares/
|       |   |-- auditMiddleware.js (Auditoría fire-and-forget)
|       |   |-- authMiddleware.js (JWT requireAuth y RBAC requireRole)
|       |   |-- correlationMiddleware.js (Generador de X-Correlation-Id)
|       |   `-- eventIngestionMiddleware.js
|       |-- models/
|       |   |-- alertasModel.js
|       |   |-- auditLogModel.js
|       |   |-- lecturasModel.js
|       |   |-- sensoresModel.js
|       |   |-- tablerosModel.js
|       |   `-- usuariosModel.js
|       |-- routes/
|       |   |-- alertaRoutes.js (Protegido con requireRole)
|       |   |-- authRoutes.js (/api/auth/login, /register, /me)
|       |   |-- configRoutes.js
|       |   |-- eventRoutes.js
|       |   |-- healthRoutes.js (Circuit Breaker y estado MQTT)
|       |   |-- index.js
|       |   |-- tableroRoutes.js
|       |   `-- uplinkRoutes.js
|       |-- scripts/
|       |   |-- migrate.js (Ejecución automática y ordenada de migraciones)
|       |   `-- seed.js
|       |-- services/
|       |   |-- authService.js (JWT HMAC-SHA256, scrypt)
|       |   |-- ingestaService.js (Deduplicación SHA-256 y rate limit)
|       |   |-- logger.js (Logger estructurado con correlation_id)
|       |   |-- mantenimientoScheduler.js
|       |   |-- persistenciaService.js
|       |   `-- retencionService.js
|       |-- validators/
|       |   `-- eventSchema.js (Validación Zod por tipo de evento)
|       `-- workers/
|           `-- mqttSubscriber.js (TCP 1883 con reconexión autónoma)
|-- deploy/
|   |-- mosquitto/
|   `-- nginx/
|-- Documentacion/
|   |-- MANUAL_BASE_DE_DATOS.md
|   |-- DOCUMENTACION_TECNICA.md
|   |-- CONTEXTO_TECNICO.md
|   |-- MATRIZ_DE_TAREAS_POR_NIVEL.md
|   `-- PLAN_DE_TRABAJO_SCRUM.md
|-- supabase_schema.sql
|-- docker-compose.yml
|-- docker-compose.db.yml
|-- MANUAL_DESARROLLADOR.md
|-- README.md
`-- README_DB.md
```

---

## 3. Arquitectura en Ejecucion

```text
               ┌──────────────────────────────────────────────┐
               │         HARDWARE ESP32 / SENSORES            │
               └──────────────────────┬───────────────────────┘
                                      │ MQTT TCP 1883
                                      ▼
               ┌──────────────────────────────────────────────┐
               │           BROKER MOSQUITTO (MQTT)            │
               └──────────────┬────────────────┬──────────────┘
                              │ WS 9001 (/mqtt)│ TCP 1883
                              ▼                ▼
         ┌─────────────────────────┐     ┌────────────────────────────┐
         │ NAVEGADOR (FRONTEND)    │     │ BACKEND WORKER INGESTOR    │
         │ • index.html + Paho     │     │ • Node.js subscriber       │
         │ • supabase-client.js    │     │ • Validación Zod           │
         │ • app.js (UI en vivo)   │     │ • REST API (/api/)         │
         └────────────┬────────────┘     └─────────────┬──────────────┘
                      │                                │
                      ▼ HTTPS / Realtime               ▼ Pool pg
         ┌─────────────────────────┐     ┌────────────────────────────┐
         │ SUPABASE CLOUD (PG)     │     │ POSTGRESQL LOCAL           │
         │ • Tableros & Alertas    │     │ • Lecturas telemétricas    │
         │ • Row Level Security    │     │ • Mantenimiento & Purga    │
         └─────────────────────────┘     └────────────────────────────┘
```

---

## 4. Interfaz Implementada

La UI se organiza en cuatro pestañas principales:

- **Tableros Electricos:** grilla de tarjetas por tablero con tension, fase, luminarias operativas y estado semaforo.
- **Mapa de Zonas:** mapa SVG representativo con pines interactivos por tablero.
- **Alertas:** historial filtrable por `ALL`, `CRITICA`, `ADVERTENCIA` e `INFO`; cada alerta puede marcarse como resuelta.
- **Consola MQTT:** registro de mensajes entrantes, salientes, simulados y errores de conexion.

La cabecera incluye:

- estado de conexion MQTT;
- acceso al simulador;
- configuracion del servidor MQTT;
- activacion o silenciamiento del sonido de alarma;
- **interruptor de tema claro/oscuro** (boton con icono `fa-moon` / `fa-sun`).

El panel superior incluye un banner general y KPIs de alertas, advertencias y cantidad de tableros monitoreados.

### 4.0 Tema Claro / Oscuro

La aplicacion soporta dos temas visuales que el usuario puede alternar desde el boton `#btnToggleTheme` en la cabecera. El modo oscuro es el predeterminado.

**Mecanismo:**

- El atributo `data-theme` se aplica sobre `<html>` (`<html data-theme="light">` o `<html data-theme="dark">`).
- `styles.css` define las variables en `:root` (modo oscuro) y las redefine en el bloque `[data-theme="light"]`.
- La preferencia se persiste en `localStorage` bajo la clave `luminaria_theme`.

**Anti-flash:** un script inline al final del `<head>` de `index.html` lee `localStorage` y aplica el atributo `data-theme` antes de que el navegador pinte la pagina, evitando el flash blanco al cargar en modo claro. **No eliminar este script.**

**Variables CSS que cambian entre temas:**

| Categoria | Variables | Notas |
|---|---|---|
| Backgrounds | `--bg-dark`, `--bg-card`, `--bg-card-hover`, `--bg-input`, `--bg-terminal` | Oscuro: slate-900. Claro: blanco / slate-100. |
| Bordes | `--border-color`, `--border-focus` | Se aclaran en modo claro. |
| Texto | `--text-main`, `--text-muted`, `--text-dim` | Oscuro: blanco. Claro: slate-900. |
| Acentos semitransparentes | `--color-*-bg`, `--color-*-border`, `--color-accent-bg` | Recalibrados para fondo blanco. |
| Colores del mapa SVG | `--map-bg`, `--map-river-bg`, `--map-path`, `--map-grid`, `--map-river` | Aplicados a los `<path>` del SVG. |
| Componentes compuestos | `--meter-track-bg`, `--mobile-nav-bg`, `--modal-overlay-bg`, `--pin-shadow`, `--pin-label-shadow`, `--modal-shadow`, `--shadow-card` | Garantizan contraste en ambos temas. |

Los **colores solidos de acento** (`--color-ok`, `--color-warning`, `--color-critical`, `--color-accent`, `--color-accent-text`) **no cambian** entre temas: ya tienen buen contraste sobre fondos claros y oscuros.

**Regla para componentes nuevos:** usar siempre variables CSS en lugar de colores hex hardcodeados. Si un componente nuevo necesita un color, agregarlo como variable en `:root` y redefinirlo en `[data-theme="light"]`.

### 4.1 Mapa de Zonas (Detalle de Implementacion)

El mapa se compone de un SVG decorativo y una capa de pines superpuesta:

```html
<div class="map-svg-wrapper">   <!-- position: relative; height: 240px (200px en movil) -->
  <svg width="100%" height="100%" viewBox="0 0 800 240" preserveAspectRatio="none">...</svg>
  <div class="map-pins-layer">  <!-- position: absolute; inset: 0 -->
    <!-- pines renderizados por renderMapPins() -->
  </div>
</div>
```

Reglas clave:

- La capa `.map-pins-layer` debe vivir **siempre dentro** de `.map-svg-wrapper` (que es `position: relative`). Si se mueve fuera, los pines se anclan al viewport y quedan desalineados del mapa; este anclaje es la causa de los bugs visuales en movil.
- Cada pin se posiciona con `left: posX%` y `top: posY%` sobre la misma area que el SVG y se centra con `transform: translate(-50%, -50%)`.
- `renderMapPins()` en `js/app.js` calcula la severidad del tablero (verde `--color-ok`, amarillo `--color-warning`, rojo `--color-critical`) y agrega un listener de click que selecciona el tablero y cambia a la pestana de tableros.

Comportamiento responsive (max-width: 560px):

- Altura del mapa: `240px -> 200px` para que el pin inferior no quede pegado al borde.
- Iconos de pin reducidos a 30px y fuente de etiqueta a 0.62rem.
- Las etiquetas limitan su ancho a `max-width: 92px`, permiten salto de linea (`white-space: normal`) y se centran para no cortarse en los bordes del mapa.
- La leyenda `.map-legend` se oculta por debajo de 768px.

---

## 5. Estado Inicial de Tableros

`js/app.js` inicializa cuatro tableros:

| ID | Nombre | Ubicacion | Fase | Focos iniciales |
|---|---|---|---|---|
| `TABLERO_01` | Centro / Palacio Municipal | Centro / Palacio Municipal | `L1` | `FOCO_A1` a `FOCO_A4`, `FOCO_B1` a `FOCO_B4` |
| `TABLERO_02` | Parque Norte | Parque Norte - Sector Canchas | `L2` | `FOCO_C1` a `FOCO_C3` |
| `TABLERO_03` | Paseo de la Costa | Paseo de la Costa - Rio Limay | `L3` | `FOCO_D1` a `FOCO_D2` |
| `TABLERO_04` | Avenida Argentina | Av. Argentina y Monolito | `L1` | `FOCO_E1` |

Si llega un evento para un `id_tablero` desconocido, la UI crea un tablero dinamico con ubicacion del evento o `Ubicacion Desconocida`.

---

## 6. Configuracion MQTT

Configuracion por defecto en `js/mqtt-client.js`:

```js
{
  host: 'localhost',
  port: 9001,
  path: '/mqtt',
  clientId: 'luminaria_web_' + Math.random().toString(16).substring(2, 8),
  topics: ['neuquen/iluminacion/#', 'api/evento'],
  qos: 1,
  keepAlive: 60,
  cleanSession: true
}
```

La configuracion modificada desde el modal de servidor se guarda en `localStorage` bajo la clave `luminaria_mqtt_config`.

Configuracion minima esperada para Mosquitto:

```ini
listener 1883
protocol mqtt
allow_anonymous true

listener 9001
protocol websockets
allow_anonymous true
```

---

## 7. Contrato de Eventos JSON

Todos los eventos deben incluir:

| Campo | Tipo | Descripcion |
|---|---|---|
| `tipo_evento` | string | Tipo de evento reconocido por la UI |
| `id_tablero` | string | Identificador del tablero afectado |
| `timestamp` | string ISO 8601 | Fecha/hora del evento |
| `datos` | object | Datos especificos del tipo de evento |
| `severidad` | string | `CRITICA`, `ADVERTENCIA` o `INFO` |
| `ubicacion` | string | Ubicacion textual del tablero o luminaria |

### 7.1 Baja Tension

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
  "ubicacion": "Centro / Palacio Municipal"
}
```

Efecto en UI: actualiza `tension_v`, fase del tablero, registra alerta critica, cambia banner/KPIs y marca tablero/mapa en rojo.

### 7.2 Desconexion Abrupta de Foco

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

Efecto en UI: marca el foco como `robado`, registra alerta critica y prioriza estado rojo.

### 7.3 Foco Quemado

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

Efecto en UI: marca el foco como `quemado`, registra advertencia y usa estado amarillo salvo que exista una condicion critica.

### 7.4 Telemetria Normal

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
  "ubicacion": "Centro / Palacio Municipal"
}
```

Efecto en UI: restaura tension y focos indicados. Si `focos_restaurados` no se envia, restaura todos los focos del tablero a `ok` con corriente nominal de 450 mA.

---

## 8. Reglas de Estado Visual

Prioridad de severidad:

1. **Critico:** `tension_v < 190.0`, foco con estado `robado` o alerta no resuelta con severidad `CRITICA`.
2. **Advertencia:** `190.0 <= tension_v < 210.0`, foco con estado `quemado` o alerta no resuelta con severidad `ADVERTENCIA`.
3. **Normal:** tension nominal y sin fallas activas.

Las alertas resueltas dejan de contarse en KPIs y en la severidad derivada del mapa, aunque el historial permanece visible.

---

## 9. Arquitectura y Módulos del Backend (Node.js + Express)

El backend opera como un servicio autónomo y resiliente, diseñado para alta concurrencia tanto en ingesta telemétrica como en servicio de API para operadores.

### 9.1 Endpoints de la API REST (`/api/`)

| Método | Ruta | Acceso / Rol | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | Público | Health check integral con **Circuit Breaker** (BD, worker MQTT, Supabase Cloud y uptime). |
| `GET` | `/api/config` | Público | Configuración pública de red y tópicos MQTT permitidos. |
| `POST` | `/api/auth/login` | Público | Autenticación con email/password. Retorna JWT con claims de usuario y rol. Registra auditoría. |
| `POST` | `/api/auth/register` | `admin` | Alta de nuevo operador (`admin`, `supervisor`, `tecnico`) con hashing seguro `scrypt`. |
| `GET` | `/api/auth/me` | Autenticado | Retorna los datos y rol del token JWT activo. |
| `POST` | `/api/eventos` | Público / Red IoT | Ingesta transaccional con validación de contrato Zod, deduplicación SHA-256 y rate limiting por tablero. |
| `POST` | `/api/uplink` | Red LoRaWAN | Receptor de tramas ChirpStack v4 decodificadas. |
| `GET` | `/api/tableros` | Público | Listado de tableros con telemetría actual y severidad derivada. |
| `GET` | `/api/alertas` | Público | Historial de alertas con filtros (`severidad`, `estado`) y paginación (`limit`, `offset`, `total`). |
| `PATCH` | `/api/alertas/:id/resolver` | `admin`, `supervisor` | Resolución transaccional de alertas. Registra `resuelto_por` (ID de usuario) y emite log en `audit_log`. |

### 9.2 Capa de Seguridad y Red

1. **Headers de Seguridad HTTP:**
   - `X-Content-Type-Options: nosniff` (previene ataques MIME-sniffing).
   - `X-Frame-Options: DENY` (inmunidad contra clickjacking).
   - `X-XSS-Protection: 0` (según los estándares modernos OWASP).
   - `Referrer-Policy: strict-origin-when-cross-origin`.
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
   - En entorno de producción (`NODE_ENV=production`): HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) y CSP (`Content-Security-Policy`).
2. **CORS con Lista Blanca:**
   - Configurable mediante la variable `CORS_ORIGIN` en `.env`.
   - Incluye orígenes locales predeterminados (`http://localhost:3000`, `http://localhost:5500`, `http://127.0.0.1:5500`).
3. **Rate Limiting y Límite de Payload:**
   - Límite global por IP (`express-rate-limit`, 100 peticiones por ventana configurable).
   - Límite estricto de body JSON a 1MB para prevenir denegación de servicio por memoria.

### 9.3 Autenticación y Autorización (RBAC)

- **Mecanismo:** JSON Web Tokens (JWT) firmados con HMAC-SHA256 utilizando el módulo nativo `crypto` de Node.js (cero dependencias externas vulnerables).
- **Almacenamiento de Contraseñas:** Hashing criptográfico mediante `scrypt` con salt aleatorio de 16 bytes y clave derivada de 64 bytes.
- **Roles Implementados:**
  - `admin`: Control total, gestión de usuarios (`/api/auth/register`), resolución de alertas y mantenimiento.
  - `supervisor`: Monitoreo y resolución de alertas críticas y advertencias.
  - `tecnico`: Monitoreo, lectura de telemetría y diagnóstico.
- **Middlewares:**
  - `requireAuth`: Valida firma y expiración del JWT en `Authorization: Bearer <token>`. Inyecta `req.user`.
  - `requireRole(...roles)`: Valida que el rol del usuario posea los privilegios requeridos.

### 9.4 Resiliencia y Conexión a Base de Datos

- **Connection Pool:** Pool `pg` con límites configurables de conexiones (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`).
- **Retry con Backoff Exponencial (`queryWithRetry`):**
  - Reintenta automáticamente ante fallos transitorios de red o reinicio del motor (`ECONNREFUSED`, `ETIMEDOUT`, `57P01`, `08006`).
  - Aplica factor exponencial `delay = baseDelay * 2^intento` y *jitter* aleatorio para evitar saturación (*thundering herd*).
- **Circuit Breaker en `/api/health`:**
  - Tres estados operativos: `closed` (normal), `open` (circuito abierto tras 3 fallos consecutivos; no satura la BD con consultas innecesarias), `half-open` (prueba de reconexión tras 30 segundos).
  - Reporta en tiempo real el estado de conexión del worker MQTT mediante `setMqttSubscriberRef`.

### 9.5 Observabilidad, Correlación y Auditoría

- **Correlation ID:** Middleware que genera o preserva un identificador único `X-Correlation-Id` en cada petición HTTP, propagado hacia la cabecera de respuesta y hacia cada entrada del log.
- **Logger Estructurado:** `src/services/logger.js` emite eventos en formato JSON en producción y texto coloreado en desarrollo, con niveles configurables (`error`, `warn`, `info`, `debug`).
- **Audit Logging (`audit_log`):** Middleware `audit()` que registra de forma asíncrona (*fire-and-forget*, sin demorar la respuesta del usuario) toda acción crítica (autenticación, cambios de roles, resolución de incidentes) asociando usuario, IP, recurso y `correlation_id`.

---

## 10. Pruebas y Verificación

1. **Pruebas de la API REST:**
   ```bash
   # Health check con circuit breaker y estado MQTT
   curl http://localhost:3000/api/health

   # Login de usuario
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@neuquen.gob.ar","password":"password123"}'

   # Consulta de tableros
   curl http://localhost:3000/api/tableros
   ```

2. **Validaciones Sintácticas:**
   ```bash
   node -c js/app.js
   node -c js/mqtt-client.js
   ```

3. **Ejecución de Migraciones de Base de Datos:**
   ```bash
   npm run db:migrate
   ```

---

## 11. Cambios Documentados en Esta Versión

- **Seguridad en Capa de Red (SEC-01 / BB-09):** Headers HTTP obligatorios (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy).
- **Autenticación JWT y RBAC (BE-04 / BB-10):** Migración `002_usuarios_y_audit.sql`, modelo `usuariosModel`, servicio `authService` con hashing `scrypt` y middleware `authMiddleware`.
- **Auditoría de Operaciones (SEC-03):** Tabla `audit_log`, middleware `auditMiddleware` para trazabilidad de logins y resoluciones técnicas (`resuelto_por`).
- **Resiliencia de Base de Datos (BE-07):** Reintentos automáticos con backoff exponencial y jitter en `database.js` (`queryWithRetry`).
- **Health Check y Circuit Breaker (BE-08):** Monitor inteligente de base de datos con estados `closed`/`open`/`half-open`, reporte en vivo de suscriptor MQTT y cliente Supabase.
- **Logging Estructurado y Correlación (BE-09):** Módulo `logger.js` y middleware `X-Correlation-Id` para rastreo unificado de eventos.
- **Migraciones Secuenciales:** Runner `migrate.js` actualizado para ejecutar dinámicamente todos los archivos `.sql` en orden alfabético.
- **Optimizaciones Frontend Previas:** Corrección del menú hamburguesa en móviles, sanitización XSS, singleton de AudioContext y soporte completo para modo oscuro anti-flash.
