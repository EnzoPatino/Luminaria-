# Base de datos — Project Luminaria

La aplicación usa PostgreSQL local como única base persistente. Docker Compose administra el servicio `postgres`; el backend se conecta mediante `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`.

## Esquema y despliegue

- Migraciones: `backend/src/db/migrations/`.
- Seeds iniciales: `backend/src/db/seeds/`.
- Mantenimiento manual: `cd backend && npm run db:maintenance`.
- Ingesta de telemetría: `POST /api/uplink` (ChirpStack) y `POST /api/eventos`.
- El dashboard consulta los tableros y alertas a través de la API del backend; los cambios se guardan en PostgreSQL.

Para producción, seguí los pasos de [DEPLOY_PRODUCCION.md](DEPLOY_PRODUCCION.md). No se requieren cuentas, claves ni servicios de base de datos externos.
