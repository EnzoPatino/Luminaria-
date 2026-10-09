# Despliegue seguro en producción

## Antes de iniciar

1. Configurá un registro DNS para el dominio que usará el panel y activá HTTPS mediante un proxy o certificado válido. No expongas el inicio de sesión únicamente por HTTP.
2. En el servidor, dentro del directorio del proyecto, creá el archivo de secretos a partir del ejemplo:

```bash
cp .env.production.example .env
chmod 600 .env
```

3. Editá `.env`. Definí valores únicos para `POSTGRES_PASSWORD`, `JWT_SECRET` y `BOOTSTRAP_ADMIN_PASSWORD`. Podés generar secretos con:

```bash
openssl rand -hex 48
```

`CORS_ORIGIN` debe ser la URL HTTPS final, por ejemplo `https://panel.midominio.gob.ar`.

## Primer despliegue

```bash
git pull --ff-only
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend
```

El inicio ejecuta las migraciones y crea el administrador definido por `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_ADMIN_EMAIL`. Ingresá con ese usuario y contraseña, no con las antiguas cuentas `admin` o `tecnico`.

El proceso desactiva automáticamente las cuentas históricas `admin` y `tecnico` si estaban presentes. Las credenciales quedan solamente en `.env`, que está ignorado por Git.

## Actualizaciones posteriores

```bash
git pull --ff-only
docker compose up -d --build
docker compose logs --tail=100 backend
```

Conservá el mismo `.env`: el administrador inicial no se modifica si ya existe. Para crear más personas, ingresá con el administrador y usá **Crear usuario** dentro del panel.

## Verificación

1. Abrí `https://tu-dominio/`.
2. Confirmá que el acceso exige credenciales.
3. Ingresá con el administrador configurado en `.env`.
4. Creá una cuenta de prueba y verificá que puede iniciar sesión.
5. Verificá que `http://tu-dominio/` redirige a HTTPS desde la infraestructura de TLS elegida.

No subas el archivo `.env` ni compartas las claves por canales no seguros.
