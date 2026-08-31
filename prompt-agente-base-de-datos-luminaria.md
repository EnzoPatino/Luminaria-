# Prompt para el agente — Base de datos de Project Luminaria (versión reducida)

## Cómo usar esto

1. Abrí una sesión de Claude Code (o Cursor) parado en la raíz del repo `Luminaria-`.
2. Pegale todo el bloque que empieza en **"INSTRUCCIONES PARA EL AGENTE"** de una sola vez.
3. Dejalo leer los archivos que le pido antes de escribir código — es clave para que no invente cosas que ya están decididas en el proyecto.
4. Al final del documento hay una lista de "cómo probar que funciona": pedile que la corra antes de darlo por terminado.

Antes de armar este prompt cloné el repo y leí `CLAUDE.md`, `Documentacion/CONTEXTO_IA.md`, `Documentacion/DOCUMENTACION_TECNICA.md`, `Documentacion/MATRIZ_DE_TAREAS_POR_NIVEL.md`, `Documentacion/PLAN_DE_TRABAJO_SCRUM.md`, `backend/EXPLICACION_BACKEND.md`, el código de `js/app.js` y `index.html`, y el historial de commits. Todo lo que sigue está pensado en base a eso, no solo en base al JPEG.

---

## INSTRUCCIONES PARA EL AGENTE

Estás trabajando en el repositorio **Project Luminaria** (`https://github.com/EnzoPatino/Luminaria-`), sistema de monitoreo de tableros de alumbrado público para la Municipalidad de Neuquén.

**Antes de escribir una sola línea**, leé estos archivos para no romper decisiones ya tomadas:
- `CLAUDE.md`
- `Documentacion/CONTEXTO_IA.md`
- `Documentacion/DOCUMENTACION_TECNICA.md`
- `backend/EXPLICACION_BACKEND.md`
- `Documentacion/MATRIZ_DE_TAREAS_POR_NIVEL.md` (tareas `DB-01` y `DB-04`, que es básicamente lo que esta tarea implementa en versión reducida)

### Estado actual del repo (para que no lo redescubras)

- El **frontend** (`index.html`, `js/app.js`, `js/mqtt-client.js`, `css/styles.css`) es 100% estático, vanilla, y ya funciona con modo simulación + tema claro/oscuro. **No lo toques** en esta tarea salvo que algo de abajo lo pida explícitamente.
- El **backend** (`backend/`) es un esqueleto de Node.js + Express con `cors`, `dotenv` y una sola ruta de health check. **No tiene base de datos, no tiene modelos, no tiene ORM instalado.** Es tu punto de partida.
- El backend **no está conectado al frontend todavía** (no hay integración MQTT→backend implementada). Esta tarea es solo la capa de persistencia: esquema, guardado y limpieza de datos. No hace falta que conectes el worker MQTT real ni la API REST completa.

---

## 1. Objetivo de esta tarea

Diseñar e implementar, dentro de `backend/`, el esquema de base de datos y la lógica de retención/limpieza para **guardar telemetría y alertas**, en una versión reducida del diagrama entity-relationship que te paso abajo (`BASE DE DATOS 1.jpeg`, descripto en texto). Esto **no es el producto final** del proyecto — es la base de persistencia mínima y funcional. Quedan afuera, a propósito, las partes de gestión de técnicos, usuarios y reparaciones.

---

## 2. Qué se saca del diagrama original y por qué

El diagrama original tenía 9 entidades: `ZONA`, `TABLERO`, `SENSOR`, `LUMINARIA/FOCO`, `LECTURA`, `ALERTA`, `TECNICO`, `USUARIO_APP`, `REPARACION`.

| Tabla del diagrama | Qué pasa acá | Por qué |
|---|---|---|
| `TECNICO` | ❌ Se elimina | Gestión de personal técnico, fuera de alcance por ahora |
| `USUARIO_APP` | ❌ Se elimina | Login y roles, fuera de alcance por ahora (no hay auth en el backend todavía) |
| `REPARACION` | ❌ Se elimina | Seguimiento de arreglos/mantenimiento, fuera de alcance por ahora |
| `LUMINARIA / FOCO` | ❌ Se elimina como tabla propia | Ver punto 4 más abajo — el dato que hace falta se guarda como un campo simple, no como entidad completa |
| `ZONA` | ✅ Se mantiene | |
| `TABLERO` | ✅ Se mantiene (con ajustes, ver punto 4) | |
| `SENSOR` | ✅ Se mantiene (con ajustes, ver punto 4) | |
| `LECTURA` | ✅ Se mantiene | Es el dato "no crítico" con vida corta |
| `ALERTA` | ✅ Se mantiene (con ajustes, ver punto 4) | Es el dato importante, con retención larga si es persistente |
| — | ➕ Se agrega `estadisticas_zona` | No estaba en el diagrama, hace falta para guardar mínimo/máximo/promedio por zona (pedido explícito) |

Quedan **6 tablas**: `zonas`, `tableros`, `sensores`, `lecturas`, `alertas`, `estadisticas_zona`.

---

## 3. Hallazgo importante en el código actual (leelo antes de diseñar nada)

El commit más reciente del repo (`feat: Nueva seccion de graficos`) agregó una pestaña **"Sensores (Telemetría)"** que muestra Temperatura y Humedad (`Tem`, `Hum`) de un sensor de prueba, publicado por MQTT al tópico `sensores/ambiente` con formato `{ApiKey, Tem, Hum}` (ver `js/app.js`, función `processSensorTelemetry`, y `index.html` línea ~267).

El propio texto de la interfaz lo aclara: *"Demostración de Telemetría [...] En la versión productiva futura, esta sección se adaptará a la medición de tensión eléctrica y parámetros de red."*

**Conclusión: no diseñes una tabla aparte para temperatura/humedad.** Esa pestaña es un placeholder de demostración que el propio equipo va a reemplazar por telemetría real de tensión/corriente — exactamente lo que ya cubren `sensores` y `lecturas` de este esquema. No hace falta persistir Tem/Hum en esta etapa; cuando esa sección se adapte a datos eléctricos reales, va a encajar directamente en las tablas que estás por crear, sin cambiar el esquema. Si tenés dudas sobre esto, preguntale al usuario antes de agregar columnas para Tem/Hum.

---

## 4. Esquema final

**Motor de base de datos: PostgreSQL.** Es el motor que ya está definido en el roadmap del proyecto (tareas `DB-01`, `DB-02`, `DB-05`, `BE-07` de `MATRIZ_DE_TAREAS_POR_NIVEL.md` lo dan por decidido). No instales TimescaleDB, no armes connection pooling avanzado ni Docker completo — eso son tareas `DB-02`, `DO-02`, `BE-07`, para más adelante. Acá alcanza con una conexión simple vía `pg` (node-postgres).

Usá SQL plano (sin ORM pesado tipo Sequelize/Prisma), en línea con el estilo "vanilla" que ya tiene el resto del proyecto.

### 4.1 `zonas`

| Campo | Tipo | Notas |
|---|---|---|
| `id_zona` | `SERIAL PK` | |
| `nombre_zona` | `TEXT NOT NULL` | ej. `'Parque Norte'` |
| `tipo_espacio` | `TEXT` | `'plaza'`, `'parque'`, `'via_publica'`, `'costanera'`, etc. |
| `descripcion` | `TEXT` | opcional |

Sembrá las 4 zonas que ya existen hoy en `js/app.js` (`CONTEXTO_IA.md` sección 4): Centro / Palacio Municipal, Parque Norte, Paseo de la Costa, Avenida Argentina.

### 4.2 `tableros`

| Campo | Tipo | Notas |
|---|---|---|
| `id_tablero` | `TEXT PK` | **Ver decisión de diseño abajo** — usa el código natural (`'TABLERO_01'`), no un ID numérico separado |
| `id_zona` | `INTEGER FK -> zonas`, **nullable** | nullable a propósito, ver abajo |
| `nombre_tablero` | `TEXT` | |
| `ubicacion` | `TEXT` | texto libre, viene del campo `ubicacion` del contrato MQTT |
| `ubicacion_gps` | `TEXT` | `'lat,lon'` o `NULL` |
| `pos_x`, `pos_y` | `REAL` | % para el pin del mapa — ya estaba previsto en `DB-01` del propio backlog |
| `fase` | `TEXT` | `'L1'` / `'L2'` / `'L3'` |
| `tension_nominal` | `NUMERIC(6,2) DEFAULT 220.0` | |
| `estado` | `TEXT DEFAULT 'ok'` | `'ok'` / `'advertencia'` / `'critico'` — **es un caché derivado**, no la fuente de verdad (ver abajo) |
| `fecha_instalacion` | `DATE` | |

Sembrá los 4 tableros iniciales documentados (`TABLERO_01` a `TABLERO_04`, con su fase y zona correspondiente).

### 4.3 `sensores`

| Campo | Tipo | Notas |
|---|---|---|
| `id_sensor` | `SERIAL PK` | |
| `id_tablero` | `TEXT FK -> tableros`, `NOT NULL` | |
| `mac_esp32` | `TEXT UNIQUE`, nullable | hardware todavía no lo manda en el contrato actual |
| `modulo_lora_id` | `TEXT`, nullable | |
| `topico_mqtt` | `TEXT`, nullable | |
| `umbral_tension_min` | `NUMERIC(6,2) DEFAULT 190.0` | |
| `umbral_tension_max` | `NUMERIC(6,2)`, nullable | |
| `estado_sensor` | `TEXT DEFAULT 'activo'` | |
| `fecha_instalacion` | `DATE DEFAULT now()` | |

**Importante — "sensor virtual":** el contrato MQTT actual (`BAJA_TENSION`, `TELEMETRIA_NORMAL`, etc.) identifica el evento por `id_tablero`, **no** por sensor ni por MAC. Hasta que el hardware mande esos datos, la lógica de guardado tiene que resolver así: *"buscá el sensor de este tablero; si no existe ninguno, creá uno con `mac_esp32 = NULL`"*. Así cada tablero siempre tiene al menos un sensor asociado y `lecturas` nunca se queda sin dónde colgar.

### 4.4 `lecturas` — dato "no crítico", vive 1 mes

| Campo | Tipo | Notas |
|---|---|---|
| `id_lectura` | `BIGSERIAL PK` | |
| `id_sensor` | `INTEGER FK -> sensores`, `NOT NULL` | |
| `timestamp` | `TIMESTAMPTZ DEFAULT now()` | |
| `valor_tension` | `NUMERIC(6,2)`, nullable | de `datos.tension_medida_v` |
| `valor_corriente` | `NUMERIC(8,2)`, nullable | de `datos.corriente_actual_ma` / `corriente_medida_ma` |
| `fase` | `TEXT`, nullable | viene en `datos.fase` del contrato; se agrega acá porque el diagrama original no la tenía y se perdería |
| `rssi_lora` | `NUMERIC(5,1)`, nullable | no viene en el contrato actual, preparado para LoRa a futuro |
| `estado_conexion` | `TEXT`, nullable | |

**No le agregues `id_tablero` a esta tabla.** Ya se llega al tablero vía `sensor.id_tablero`. Agregar el mismo dato dos veces (una en `sensores`, otra en `lecturas`) es exactamente el tipo de redundancia que hay que evitar.

Índices: `(id_sensor, timestamp)` y `(timestamp)` solo — los vas a necesitar para el filtro de purga y para consultas por rango de fechas.

### 4.5 `alertas` — dato importante, retención 1 o 6 meses según persistencia

| Campo | Tipo | Notas |
|---|---|---|
| `id_alerta` | `BIGSERIAL PK` | |
| `id_tablero` | `TEXT FK -> tableros`, `NOT NULL` | **anclaje principal** — todo evento MQTT trae `id_tablero`, así que la alerta siempre se puede crear aunque falle la resolución de sensor/lectura |
| `id_lectura` | `BIGINT FK -> lecturas`, nullable | trazabilidad opcional a la lectura puntual que disparó la alerta |
| `tipo_alerta` | `TEXT NOT NULL` | `'BAJA_TENSION'`, `'DESCONEXION_ABRUPTA_FOCO'`, `'FOCO_QUEMADO'`, etc. — mismos valores que `tipo_evento` del contrato, no los renombres |
| `id_foco_afectado` | `TEXT`, nullable | ver punto siguiente |
| `ubicacion` | `TEXT`, nullable | copia del campo `ubicacion` del evento (puede ser más específico que la ubicación general del tablero) |
| `fecha_hora_generada` | `TIMESTAMPTZ DEFAULT now()` | |
| `prioridad` | `TEXT NOT NULL` | `'CRITICA'` / `'ADVERTENCIA'` / `'INFO'` — igual que `severidad` del contrato |
| `estado_alerta` | `TEXT DEFAULT 'activa'` | `'activa'` / `'resuelta'` |
| `fecha_resolucion` | `TIMESTAMPTZ`, nullable | |
| `es_persistente` | `BOOLEAN NOT NULL DEFAULT FALSE` | **define la retención**, ver sección 5 |
| `datos_json` | `JSONB`, nullable | el objeto `datos` completo del evento crudo, tal cual llegó — así no se pierde nada aunque el evento tenga campos que las columnas de arriba no cubren |

Sí, `alertas.id_tablero` y `alertas.id_lectura → sensor → tablero` son dos caminos al mismo tablero. Acá **sí es una redundancia intencional** (a diferencia de la de `lecturas`): sirve para que la alerta sea consultable por tablero sin depender de que la resolución de sensor/lectura haya funcionado, y para no perder ninguna alerta si en algún momento la lectura asociada se elimina. Es un trade-off deliberado, no un descuido — dejalo así.

### 4.6 `estadisticas_zona` — nueva, no estaba en el diagrama

Resuelve el pedido de "mínimo, máximo y promedio de tensión por zona" una vez que las `lecturas` crudas se empiezan a borrar al mes.

| Campo | Tipo | Notas |
|---|---|---|
| `id_estadistica` | `BIGSERIAL PK` | |
| `id_zona` | `INTEGER FK -> zonas`, `NOT NULL` | |
| `periodo_dia` | `DATE NOT NULL` | una fila por zona por día |
| `tension_minima` | `NUMERIC(6,2)` | |
| `tension_maxima` | `NUMERIC(6,2)` | |
| `tension_promedio` | `NUMERIC(6,2)` | |
| `cantidad_lecturas` | `INTEGER DEFAULT 0` | |
| `fecha_calculo` | `TIMESTAMPTZ DEFAULT now()` | |
| — | `UNIQUE (id_zona, periodo_dia)` | |

Con 4 zonas esto genera ~4 filas nuevas por día (~1460 por año): no hace falta purgarla en esta etapa. Si más adelante quieren limitarla, alcanza con sumarle la misma condición de fecha al job de purga.

---

## 5. Decisiones de diseño (por qué el esquema no es un calco 1:1 del JPEG)

Explicá estas decisiones en el código/comentarios para que el próximo dev entienda el porqué:

1. **`id_tablero` como texto, sin `codigo_tablero` aparte.** El diagrama original tenía un ID numérico interno *más* un `codigo_tablero` de texto — dos columnas para el mismo concepto. Como todo el sistema (frontend, contrato MQTT, documentación) ya usa `'TABLERO_01'` como identificador único en todos lados, usarlo directo como Primary Key evita esa duplicación.
2. **`tableros.estado` es un caché, no la fuente de verdad.** El estado real siempre se puede recalcular a partir de la última lectura + alertas activas de ese tablero. Guardarlo aparte es una optimización de lectura (para no hacer ese cálculo en cada consulta al listado de tableros), así que actualizalo cada vez que llegue una lectura o alerta nueva para ese tablero — no lo dejes como un dato independiente que se puede desincronizar.
3. **`tableros.id_zona` es nullable.** El frontend ya tiene lógica para dar de alta un tablero "desconocido" cuando llega un evento con un `id_tablero` que nunca vio (`js/app.js`, `processIncomingEvent`). El backend tiene que poder hacer lo mismo sin fallar por no tener una zona asignada todavía.
4. **No hay tabla `LUMINARIA/FOCO`.** El hardware sigue mandando `id_foco` en `DESCONEXION_ABRUPTA_FOCO` y `FOCO_QUEMADO`. Como no hay ni técnicos ni reparaciones que lo necesiten como entidad relacional completa, ese dato se guarda como texto simple en `alertas.id_foco_afectado` — informativo, sin tabla ni relación propia.
5. **`sensores`/`lecturas` separados de `alertas` vía `id_tablero` directo.** Ver el punto de redundancia intencional en 4.5.

---

## 6. Política de retención y purga

Regla pedida por el usuario:

- **Alertas persistentes** (`es_persistente = true`): se conservan **6 meses**.
- **Todo lo demás** (alertas no persistentes + lecturas): se conserva **1 mes**.
- El **voltaje/info no crítica** se pierde en detalle después de 1 mes, pero el resumen (mínimo/máximo/promedio por zona) queda en `estadisticas_zona` sin ese límite.

### 6.1 ¿Qué hace que una alerta sea "persistente"?

El usuario no definió la regla exacta, así que usá este default razonable (documentalo como ajustable, es una sola condición en un solo lugar del código):

- `prioridad = 'CRITICA'` → `es_persistente = true` (baja tensión crítica, robo/desconexión abrupta: son incidentes que conviene poder auditar más tiempo).
- `prioridad = 'ADVERTENCIA'` o `'INFO'` → `es_persistente = false`.

Esto es independiente de `estado_alerta` (`activa`/`resuelta`) — una alerta resuelta puede seguir siendo persistente a efectos de retención; son dos cosas distintas.

### 6.2 Orden de purga (importante, evita romper la relación `alertas.id_lectura`)

Corré la purga en este orden exacto:

```sql
-- 1) Alertas vencidas según su propia regla de persistencia
DELETE FROM alertas
WHERE (es_persistente = FALSE AND fecha_hora_generada < now() - INTERVAL '1 month')
   OR (es_persistente = TRUE  AND fecha_hora_generada < now() - INTERVAL '6 months');

-- 2) Lecturas de más de un mes que YA NO tienen ninguna alerta viva apuntándolas
DELETE FROM lecturas
WHERE timestamp < now() - INTERVAL '1 month'
  AND id_lectura NOT IN (
    SELECT id_lectura FROM alertas WHERE id_lectura IS NOT NULL
  );
```

Si purgás lecturas antes que alertas, te podés encontrar borrando una lectura que una alerta persistente todavía necesita. Por eso el orden importa.

### 6.3 Cómo programarlo

Agregá `node-cron` (dependencia liviana) o un `setInterval` simple en el arranque del backend para correr esto una vez por día. Además, armá un script standalone ejecutable a mano (`backend/src/scripts/mantenimiento.js`) que corra lo mismo, por si en producción prefieren dispararlo con un cron del sistema operativo en vez de depender de que el proceso de Node quede siempre corriendo.

---

## 7. Agregación diaria por zona

Job separado (puede ir en el mismo scheduler que la purga, corriendo antes), que calcula el resumen del día anterior:

```sql
INSERT INTO estadisticas_zona (id_zona, periodo_dia, tension_minima, tension_maxima, tension_promedio, cantidad_lecturas)
SELECT
  t.id_zona,
  date_trunc('day', l.timestamp)::date AS periodo_dia,
  MIN(l.valor_tension),
  MAX(l.valor_tension),
  AVG(l.valor_tension),
  COUNT(*)
FROM lecturas l
JOIN sensores s  ON s.id_sensor = l.id_sensor
JOIN tableros t  ON t.id_tablero = s.id_tablero
WHERE l.valor_tension IS NOT NULL
  AND t.id_zona IS NOT NULL
  AND date_trunc('day', l.timestamp)::date = CURRENT_DATE - INTERVAL '1 day'
GROUP BY t.id_zona, date_trunc('day', l.timestamp)::date
ON CONFLICT (id_zona, periodo_dia) DO UPDATE SET
  tension_minima   = EXCLUDED.tension_minima,
  tension_maxima   = EXCLUDED.tension_maxima,
  tension_promedio = EXCLUDED.tension_promedio,
  cantidad_lecturas = EXCLUDED.cantidad_lecturas,
  fecha_calculo    = now();
```

Corré este job **antes** de la purga del día (aunque la purga es a 1 mes y esto es diario, así que en la práctica el orden entre ambos no es crítico — pero mantenelo así por prolijidad).

---

## 8. Archivos a crear/modificar

Respetá la estructura de carpetas que ya sugiere `backend/EXPLICACION_BACKEND.md` (`config/`, `services/`, `models/` o `db/`).

```
backend/
├── package.json                        (MODIFICAR: agregar "pg" y "node-cron")
├── .env.example                        (NUEVO: variables de conexión a Postgres)
└── src/
    ├── config/
    │   └── database.js                 (NUEVO: pool de conexión pg, simple, sin retry avanzado)
    ├── db/
    │   ├── migrations/
    │   │   └── 001_init_schema.sql     (NUEVO: los 6 CREATE TABLE + índices de este documento)
    │   └── seeds/
    │       └── 001_zonas_tableros.sql  (NUEVO: 4 zonas + 4 tableros iniciales)
    ├── models/  (o queries/, elegí uno y sé consistente)
    │   ├── tablerosModel.js
    │   ├── lecturasModel.js
    │   └── alertasModel.js
    ├── services/
    │   ├── retencionService.js         (NUEVO: las dos queries de purga, en orden)
    │   └── agregacionService.js        (NUEVO: el job de estadisticas_zona)
    └── scripts/
        └── mantenimiento.js            (NUEVO: corre agregación + purga a mano)

docker-compose.db.yml                   (NUEVO, en la raíz del repo — SOLO Postgres, para desarrollo local)
```

`docker-compose.db.yml` sugerido (liviano, no es el `docker-compose.yml` completo de la tarea `DO-02`, que es para más adelante):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: luminaria_db
    restart: always
    environment:
      POSTGRES_DB: luminaria
      POSTGRES_USER: luminaria
      POSTGRES_PASSWORD: luminaria_dev
    ports:
      - "5432:5432"
    volumes:
      - luminaria_pgdata:/var/lib/postgresql/data
volumes:
  luminaria_pgdata:
```

Documentación a actualizar **solo después de crear los archivos reales** (regla ya existente en `CLAUDE.md` punto 7.8 y `CONTEXTO_IA.md` punto 6): `backend/EXPLICACION_BACKEND.md` y `Documentacion/DOCUMENTACION_TECNICA.md`, agregando una sección de base de datos con el esquema real implementado.

---

## 9. Reglas que NO se deben romper

Estas ya rigen para todo el proyecto, no son nuevas, pero recordátelas:

1. No toques `index.html`, `js/app.js`, `js/mqtt-client.js` ni `css/styles.css` en esta tarea.
2. No cambies nombres de claves del contrato JSON de eventos (`tipo_evento`, `id_tablero`, `datos`, `severidad`, `ubicacion`, etc.) — están coordinados con el hardware.
3. No instales frameworks ni ORMs pesados. `pg` + SQL plano alcanza.
4. No implementes todavía TimescaleDB, pooling avanzado, Docker completo, ni autenticación (tareas `DB-02`, `BE-07`, `DO-02`, `BE-04` — quedan para después).
5. Documentá recién después de tener los archivos reales creados, no antes.
6. Validá sintaxis de cualquier `.js` nuevo con `node -c`, siguiendo la convención ya usada en el resto del repo.

---

## 10. Cómo probar que funciona

1. Levantá Postgres (`docker compose -f docker-compose.db.yml up -d`, o una instalación local) y corré la migración + el seed.
2. Confirmá que quedaron cargadas las 4 zonas y los 4 tableros iniciales.
3. Insertá (a mano o con un script de prueba) una lectura con tensión baja y una alerta `BAJA_TENSION` / `CRITICA` vinculada a esa lectura y a su tablero. Confirmá que `es_persistente` quedó en `true` por la regla del punto 6.1.
4. Insertá una alerta no persistente y su lectura con fecha de hace 40 días. Corré `retencionService`. Confirmá que la alerta se borró y que su lectura también (porque ya no tiene ninguna alerta viva apuntándola).
5. Insertá una alerta persistente con fecha de hace 40 días y su lectura asociada. Corré `retencionService` de nuevo. Confirmá que **esa alerta sigue existiendo** (no llegó a los 6 meses) y que su lectura **tampoco se borró** (sigue referenciada).
6. Corré `agregacionService` y confirmá que aparece una fila nueva en `estadisticas_zona` con mínimo/máximo/promedio coherentes con las lecturas cargadas.
7. Corré `node -c` sobre cada archivo `.js` nuevo.

Si algo de esto no da como se espera, no lo des por terminado — avisale al usuario qué falló antes de seguir.
