# Implementación de base de datos — Project Luminaria

Esta carpeta contiene los cambios de persistencia preparados para copiar sobre el repositorio `Luminaria-`.

## Arquitectura de Persistencia Híbrida

Project Luminaria utiliza dos niveles de persistencia:

1. **Supabase Cloud (PostgreSQL Administrado):**
   * Tablas `tableros` y `alertas` en la nube con soporte **Row Level Security (RLS)** y **Realtime**.
   * Persistencia inmediata desde el frontend (`js/supabase-client.js`) para que las alertas y resoluciones técnicas queden registradas permanentemente tras recargas (`F5`).
   * Script DDL y semillas: [`supabase_schema.sql`](supabase_schema.sql).
   * Manual técnico completo para DBAs: [`Documentacion/MANUAL_BASE_DE_DATOS.md`](Documentacion/MANUAL_BASE_DE_DATOS.md).

2. **PostgreSQL Local (Motor de Ingesta y Series Temporales):**
   * 6 tablas: `zonas`, `tableros`, `sensores`, `lecturas`, `alertas`, `estadisticas_zona`.
   * Ingestión de telemetría de sensores por TCP (1883) y REST (`POST /api/eventos`).
   * Migración: `backend/src/db/migrations/001_init_schema.sql`.
   * Scheduler de agregaciones diarias y purga periódica segura.

## Aplicación y Despliegue

### A. Supabase Cloud (Producción / Frontend)
1. Abrir **Supabase Dashboard** > **SQL Editor**.
2. Pegar el contenido de [`supabase_schema.sql`](supabase_schema.sql) y presionar **Run**.
3. Las variables de entorno se configuran en `.env` y `backend/.env`.

### B. PostgreSQL Local (Backend / Ingestor)
1. En `backend/`, ejecutá `npm install`.
2. Asegurar que las variables de conexión estén en `backend/.env`.
3. Ejecutá las migraciones y seeds:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
4. Para ejecutar mantenimiento manual: `npm run db:maintenance`.

## Prueba de ingestión

POST `http://localhost:3000/api/eventos`

Ejemplo:

```json
{
  "tipo_evento": "BAJA_TENSION",
  "id_tablero": "TABLERO_01",
  "timestamp": "2026-08-31T04:00:00.000Z",
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
