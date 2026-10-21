# Manual de base de datos — Project Luminaria

La aplicación utiliza PostgreSQL local como única base de datos. En producción corre en el servicio `postgres` de Docker Compose y el backend accede por la red interna del proyecto. No se requiere configurar servicios de base de datos externos.

## Operación

- Esquema y migraciones: `backend/src/db/migrations/`.
- Datos iniciales: `backend/src/db/seeds/`.
- Migrar: `cd backend && npm run db:migrate`.
- Cargar seeds: `cd backend && npm run db:seed`.
- Mantenimiento: `cd backend && npm run db:maintenance`.
- Respaldo: `docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > luminaria-backup.sql`.
- Restauración: `cat luminaria-backup.sql | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"`.

Las credenciales de conexión se definen en el `.env` del servidor. El volumen `luminaria_pgdata` conserva los datos al recrear contenedores; no lo elimines al desplegar actualizaciones.
