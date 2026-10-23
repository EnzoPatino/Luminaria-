# Despliegue seguro en producción

## Antes de iniciar

1. El ReverseProxy institucional termina TLS y administra el certificado público. Configuralo para redirigir HTTP público a HTTPS y reenviar el tráfico HTTPS por HTTP al servidor Luminaria en el puerto 80. Caddy sirve solo el origen HTTP y no obtiene certificados. No publiques el puerto 443 de este servidor; limitá el acceso al puerto 80 a la red del ReverseProxy siempre que sea posible.
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

Los tableros cuyos IDs empiezan con `DEMO_` y sus lecturas, sensores y alertas se
eliminan automáticamente tras cinco minutos sin lecturas. El proceso revisa
cada minuto; estos intervalos se pueden ajustar con `DEMO_DATA_TTL_MS` y
`DEMO_DATA_CLEANUP_INTERVAL_MS`.

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

El servidor de producción se administra por VPN. El runner hospedado por GitHub no puede alcanzar su IP privada, y no se debe exponer SSH a Internet para habilitar despliegues directos. La automatización queda pendiente de aprobación de infraestructura; se puede evaluar un job en Jenkins con un agente dentro de la red. Mientras tanto, actualizá `main` manualmente desde una sesión VPN:

```bash
cd ~/luminaria
git pull --ff-only origin main
docker compose config --quiet
docker compose up -d --build
```

No agregues secretos de despliegue ni habilites un workflow de GitHub Actions mientras no exista una ruta de red aprobada hacia el servidor.

## Verificación

1. Abrí `https://tu-dominio/`.
2. Confirmá que el acceso exige credenciales.
3. Ingresá con el administrador configurado en `.env`.
4. Creá una cuenta de prueba y verificá que puede iniciar sesión.
5. Verificá que el ReverseProxy redirige el tráfico público HTTP a HTTPS, que el dominio presenta el certificado administrado allí y que MQTT solo conecta por WSS con credenciales.

No subas el archivo `.env` ni compartas las claves por canales no seguros.
