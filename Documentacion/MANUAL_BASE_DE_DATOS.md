# 🗄️ Manual de Arquitectura y Operación de Base de Datos
## Proyecto Luminaria — Municipalidad de Neuquén

> **Destinatarios:** Administradores de Base de Datos (DBA / Data Base Team)  
> **Ubicación:** `Documentacion/MANUAL_BASE_DE_DATOS.md`  
> **Versión:** 2.0 (Híbrida: Local PostgreSQL + Supabase Cloud)  
> **Fecha de actualización:** Septiembre 2026  

---

## 1. 🌐 Visión General de la Arquitectura de Datos

El sistema de datos de **Project Luminaria** opera bajo un modelo de persistencia híbrido diseñado para alta disponibilidad, tolerancia a fallos y auditoría continua:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                    HARDWARE ESP32                      │
                  └───────────────────────────┬────────────────────────────┘
                                              │ MQTT TCP 1883
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                 BROKER MOSQUITTO (MQTT)                │
                  └─────────────┬────────────────────────────┬─────────────┘
                                │ WebSockets 9001            │ TCP 1883
                                ▼                            ▼
       ┌──────────────────────────────────┐      ┌───────────────────────────┐
       │     CLIENTE WEB (FRONTEND)       │      │   BACKEND WORKER NODE.JS  │
       │  (Vanilla JS + Supabase Client)  │      │  (Subscriber + REST API)  │
       └────────────────┬─────────────────┘      └─────────────┬─────────────┘
                        │ HTTPS / WSS                          │ Pool pg
                        ▼                                      ▼
       ┌──────────────────────────────────┐      ┌───────────────────────────┐
       │      SUPABASE CLOUD (POSTGRES)   │      │    POSTGRESQL LOCAL       │
       │    • Tableros & Alertas en vivo  │      │  • Ingesta histórica      │
       │    • Realtime Replication        │      │  • Series temporales raw  │
       │    • Row Level Security (RLS)    │      │  • Mantenimiento y purga  │
       └──────────────────────────────────┘      └───────────────────────────┘
```

1. **Supabase Cloud (PostgreSQL 15+ Administrado):**
   * Persistencia en la nube para el frontend y los operadores.
   * Tablas `tableros` y `alertas` con soporte de **Supabase Realtime** y **Row Level Security (RLS)**.
   * Garantiza que las alertas y resoluciones técnicas persistan tras recargas de página (`F5`) y se sincronicen entre múltiples terminales de guardia.
2. **PostgreSQL Local (Motor de Ingesta y Series Temporales):**
   * Conexión TCP directa mediante pool `pg` en `backend/src/config/database.js`.
   * Almacenamiento masivo de lecturas de telemetría de sensores (`lecturas`, `sensores`, `estadisticas_zona`).
   * Tareas programadas de agregación y retención de datos (`retencionService.js`, `mantenimientoScheduler.js`).

---

## 2. 📋 Diccionario de Datos: Supabase Cloud (`supabase_schema.sql`)

El script DDL de producción se encuentra versionado en [`supabase_schema.sql`](../supabase_schema.sql).

### Tabla: `public.tableros`
Almacena el estado de los tableros de control eléctrico de la ciudad de Neuquén.

| Columna | Tipo de Dato | Nulo | Default | Restricciones / Descripción |
|---|---|---|---|---|
| `id_tablero` | `TEXT` | NO | — | **Primary Key** (ej: `TABLERO_01`, `TABLERO_02`). |
| `nombre_tablero` | `TEXT` | NO | — | Nombre identificatorio institucional. |
| `ubicacion` | `TEXT` | NO | — | Descripción física o barrio. |
| `pos_x` | `REAL` | NO | `50` | Coordenada X porcentual para el mapa SVG. |
| `pos_y` | `REAL` | NO | `50` | Coordenada Y porcentual para el mapa SVG. |
| `fase` | `TEXT` | SÍ | — | `CHECK (fase IN ('L1', 'L2', 'L3'))`. |
| `tension_nominal` | `NUMERIC(6,2)` | NO | `220.00` | Voltaje esperado de la red. |
| `tension_medida_v` | `NUMERIC(6,2)` | NO | `220.00` | Última lectura de tensión recibida. |
| `estado` | `TEXT` | NO | `'ok'` | `CHECK (estado IN ('ok', 'advertencia', 'critico'))`. |
| `focos` | `JSONB` | NO | `'{}'::jsonb` | Mapa JSON desnormalizado con corriente y estado por foco. |
| `ultima_actualizacion` | `TIMESTAMPTZ` | NO | `now()` | Timestamp de la última sincronización. |

#### Estructura del JSONB `focos`:
```json
{
  "FOCO_A1": { "id": "FOCO_A1", "corriente_ma": 450.0, "estado": "ok" },
  "FOCO_A2": { "id": "FOCO_A2", "corriente_ma": 450.0, "estado": "ok" },
  "FOCO_A3": { "id": "FOCO_A3", "corriente_ma": 0.0, "estado": "robado" }
}
```

---

### Tabla: `public.alertas`
Registro auditable de eventos críticos, advertencias y resoluciones técnicas.

| Columna | Tipo de Dato | Nulo | Default | Restricciones / Descripción |
|---|---|---|---|---|
| `id_alerta` | `BIGINT` | NO | `GENERATED ALWAYS AS IDENTITY` | **Primary Key** auto-incremental. |
| `id_tablero` | `TEXT` | NO | — | **Foreign Key** → `tableros(id_tablero)` `ON DELETE CASCADE`. |
| `tipo_evento` | `TEXT` | NO | — | `BAJA_TENSION`, `DESCONEXION_ABRUPTA_FOCO`, `FOCO_QUEMADO`, etc. |
| `prioridad` | `TEXT` | NO | — | `CHECK (prioridad IN ('CRITICA', 'ADVERTENCIA', 'INFO'))`. |
| `titulo` | `TEXT` | NO | — | Resumen de la alerta mostrado en la UI. |
| `ubicacion` | `TEXT` | SÍ | — | Ubicación geográfica o zona reportada. |
| `datos_json` | `JSONB` | NO | `'{}'::jsonb` | Payload del evento recibido (amperaje, caída, duración). |
| `estado_alerta` | `TEXT` | NO | `'activa'` | `CHECK (estado_alerta IN ('activa', 'resuelta'))`. |
| `fecha_hora_generada` | `TIMESTAMPTZ` | NO | `now()` | Fecha y hora de origen del evento telemétrico. |
| `fecha_resolucion` | `TIMESTAMPTZ` | SÍ | — | Fecha y hora en que fue atendida la alerta. |
| `tecnico_resolucion` | `TEXT` | SÍ | — | Rol o nombre del operador/técnico que la marcó como resuelta. |

---

## 3. ⚡ Índices y Rendimiento

Para garantizar tiempos de respuesta `< 10ms` en los dashboards municipales:

1. **`idx_alertas_estado_fecha` (B-Tree Compuesto):**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_alertas_estado_fecha 
     ON public.alertas (estado_alerta, fecha_hora_generada DESC);
   ```
   Optimiza la consulta principal de la UI: obtener las últimas alertas activas ordenadas cronológicamente.

2. **`idx_alertas_tablero` (B-Tree):**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_alertas_tablero 
     ON public.alertas (id_tablero);
   ```
   Acelera el filtrado de historial de fallas por tablero específico en inspecciones de campo.

3. **`idx_alertas_datos_gin` (Índice GIN sobre JSONB):**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_alertas_datos_gin 
     ON public.alertas USING gin (datos_json);
   ```
   Permite consultas analíticas complejas sobre parámetros internos del hardware (ej: buscar eventos con `corriente_medida_ma < 50` o caídas menores a `100ms`).

---

## 4. 🔒 Seguridad a Nivel de Filas (Row Level Security - RLS)

Supabase tiene RLS habilitado en todas las tablas del esquema público:

```sql
ALTER TABLE public.tableros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
```

### Políticas configuradas:
1. **`Lectura publica tableros` (`SELECT`):** Permitida para roles `anon` y `authenticated`.
2. **`Actualizacion publica tableros` (`UPDATE`):** Permite actualizar tensiones medidas y estados de focos.
3. **`Lectura publica alertas` (`SELECT`):** Consulta del historial general y avisos activos.
4. **`Insercion publica alertas` (`INSERT`):** Admite la entrada de nuevos eventos detectados por simulación o gateway.
5. **`Actualizacion publica alertas` (`UPDATE`):** Permite cambiar el estado a `resuelta` agregando `fecha_resolucion` y `tecnico_resolucion`.

---

## 5. 📡 Replicación en Tiempo Real (Supabase Realtime)

Ambas tablas se encuentran agregadas a la publicación oficial de replicación lógica de PostgreSQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.tableros;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas;
```

Esto habilita el listener WebSocket en `js/supabase-client.js`:
```javascript
supabaseClient
  .channel("luminaria-live-sync")
  .on("postgres_changes", { event: "*", schema: "public", table: "alertas" }, handler)
  .subscribe();
```

---

## 6. 🛠️ Diccionario del Esquema Local PostgreSQL (`001_init_schema.sql`)

En entornos locales o servidores on-premise de la Municipalidad, la base de datos `luminaria` incluye además las tablas de telemetría masiva:

* **`zonas`**: Áreas urbanas de Neuquén (`Centro / Palacio Municipal`, `Parque Norte`, etc.).
* **`sensores`**: Vínculo entre tableros y hardware telemétrico (ESP32 MAC, módulos LoRa).
* **`lecturas`**: Almacén masivo de lecturas telemétricas brutas (tensión, corriente, RSSI LoRa, timestamp).
* **`estadisticas_zona`**: Agregaciones diarias calculadas (tensión mínima, máxima y promedio) para análisis a largo plazo.

### Ciclo de Mantenimiento y Purga:
* **Alertas CRÍTICAS**: Retención de 6 meses.
* **Alertas ADVERTENCIA / INFO y lecturas raw**: Retención de 30 días.
* **Job Diario**: Implementado en `backend/src/services/mantenimientoScheduler.js` ejecutando agregación en `estadisticas_zona` antes de la eliminación de registros obsoletos.

---

## 7. 🚀 Procedimientos Operativos para el Administrador de BD

### Despliegue de Esquema en Supabase
1. Ingresar al **Supabase Dashboard** > Proyecto `rhnglkhvqfmapwdbcktm`.
2. Navegar a **SQL Editor**.
3. Cargar el script [`supabase_schema.sql`](../supabase_schema.sql) y presionar **Run**.

### Verificación de Salud de BD desde Terminal
```bash
# Comprobar estado de Supabase Cloud
curl -s -H "apikey: <SUPABASE_PUBLISHABLE_KEY>" \
  https://rhnglkhvqfmapwdbcktm.supabase.co/rest/v1/tableros

# Health check unificado de la API
curl -s http://localhost:3000/api/health
```

### Ejecutar Migración y Seeds Locales
```bash
cd backend
npm run db:migrate       # Ejecuta 001_init_schema.sql
npm run db:seed          # Ejecuta 001_zonas_tableros.sql
npm run db:maintenance   # Ejecuta purga y agregación diaria
```

### Plan de Backup Recomendado (PostgreSQL)
```bash
# Backup lógico completo
pg_dump -h localhost -U luminaria -d luminaria -F c -b -v -f "/backup/luminaria_$(date +%Y%m%d).dump"

# Restauración
pg_restore -h localhost -U luminaria -d luminaria -v "/backup/luminaria_YYYYMMDD.dump"
```
