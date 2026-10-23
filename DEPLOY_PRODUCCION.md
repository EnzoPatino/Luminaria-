# Despliegue seguro en producción

## Antes de iniciar

1. Configurá el registro DNS indicado por `DOMAIN` para que apunte al servidor. Abrí los puertos 80 y 443 para que Caddy emita y renueve automáticamente el certificado TLS. No expongas el inicio de sesión únicamente por HTTP.
2. En el servidor, dentro del directorio del proyecto, creá el archivo de secretos a partir del ejemplo:

```bash
cp .env.production.example .env
chmod 600 .env
```

Si `cp` responde que no encuentra `.env.production.example`, ejecutá `git pull --ff-only` para traer la revisión que publica este ejemplo. No hace falta crear ningún directorio.

3. Editá `.env`. Definí valores únicos para todas las claves y contraseñas. Generá un valor distinto para cada secreto con:

```bash
openssl rand -hex 48
```

`CORS_ORIGIN` debe ser la URL HTTPS final del frontend. Para Luminaria en Neuquén:
`https://luminarias.neuquencapital.gob.ar`. Si se sirven desde más de un origen,
separalos con comas, sin espacios adicionales.

`CHIRPSTACK_WEBHOOK_TOKEN` protege `/api/uplink`. Copiá el mismo valor en un
header `X-ChirpStack-Token` de la integración HTTP en ChirpStack antes de
habilitar el webhook. El backend rechaza solicitudes sin el header correcto.

Compose crea hashes bcrypt para tres cuentas MQTT desde sus secretos: `backend_worker`,
`web_dashboard` y `esp32_writer`. El panel solo recibe permisos de lectura. En el
formulario **Servidor**, ingresá `web_dashboard` y su contraseña; esa contraseña
se conserva solo en memoria del navegador, no en `localStorage`. Actualizá las
credenciales de cada dispositivo con `MQTT_DEVICE_PASSWORD` si se usa MQTT directo.
Compose no publica los listeners MQTT fuera de la red Docker.

## Primer despliegue

```bash
git pull --ff-only
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend
```

El inicio genera las credenciales MQTT, ejecuta las migraciones y crea el administrador definido por `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_ADMIN_EMAIL`. Ingresá con ese usuario y contraseña, no con las antiguas cuentas `admin` o `tecnico`.

El proceso desactiva automáticamente las cuentas históricas `admin` y `tecnico` si estaban presentes. Las credenciales quedan solamente en `.env`, que está ignorado por Git.

## Actualizaciones posteriores

```bash
git pull --ff-only
docker compose up -d --build
docker compose logs --tail=100 backend
```

Conservá el mismo `.env`: el administrador inicial no se modifica si ya existe. Para crear más personas, ingresá con el administrador y usá **Crear usuario** dentro del panel.

## Despliegue manual de `main`

El workflow `.github/workflows/deploy-main.yml` se ejecuta desde **Actions → Deploy main to production → Run workflow**, seleccionando `main`. El push no despliega automáticamente: primero se deben agregar los secretos nuevos al `.env` del servidor y configurar el header de ChirpStack. El workflow hace `git pull --ff-only origin main` en `~/luminaria` y actualiza todos los servicios.

En **GitHub → Settings → Secrets and variables → Actions**, agregá estos repository secrets:

- `DEPLOY_HOST`: IP o nombre DNS del servidor accesible por SSH.
- `DEPLOY_USER`: usuario del servidor que puede leer el repositorio y ejecutar Docker; por ejemplo `epet20`.
- `DEPLOY_PORT`: puerto SSH, normalmente `22`.
- `DEPLOY_SSH_KEY`: clave privada de una clave dedicada. Instalá la clave pública correspondiente en `~/.ssh/authorized_keys` de ese usuario.
- `DEPLOY_KNOWN_HOSTS`: línea de `known_hosts` para el servidor. Obtenela con `ssh-keyscan -H -p <puerto> <host>` y verificá su huella con quien administra el servidor antes de guardarla.

El workflow solo despliega si la referencia es `main`. Protegé esa rama para que solo cambios revisados puedan disparar un despliegue. El workflow conserva el volumen de PostgreSQL; no ejecuta `docker compose down -v`.

## Verificación

1. Abrí `https://tu-dominio/`.
2. Confirmá que el acceso exige credenciales.
3. Ingresá con el administrador configurado en `.env`.
4. Creá una cuenta de prueba y verificá que puede iniciar sesión.
5. Verificá que `http://tu-dominio/` redirige a HTTPS y que MQTT solo conecta por WSS con credenciales.

No subas el archivo `.env` ni compartas las claves por canales no seguros.
