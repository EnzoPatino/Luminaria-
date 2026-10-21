# Diagramas de Project Luminaria

Estos diagramas describen el **código y la configuración presentes en el repositorio**. Abrí cada archivo HTML en un navegador; cada uno es autocontenido (SVG y CSS inline; Google Fonts mejora la tipografía cuando hay conexión).

## Índice

1. [Arquitectura en ejecución](01-arquitectura.html) — componentes y sus canales de comunicación.
2. [Ingreso y tratamiento de eventos](02-ingesta-eventos.html) — entradas MQTT, REST y webhook ChirpStack hasta persistencia y difusión.
3. [Despliegue Docker Compose](03-despliegue.html) — servicios, límites de red y puertos publicados en `docker-compose.yml`.
4. [Esquema PostgreSQL local](04-datos-postgres-local.html) — tablas principales de telemetría y relaciones según las migraciones.

## Lectura y discrepancias de la documentación

Los diagramas se contrastaron con `backend/src`, `js`, las migraciones SQL y `docker-compose.yml`. La documentación narrativa anterior podía diferir del estado del código; los diagramas describen los servicios y las migraciones vigentes.

En el Compose actual `MQTT_SUBSCRIBER_ENABLED` vale `false`: la entrada por MQTT del backend es condicional. El webhook ChirpStack y `POST /api/eventos` comparten el servicio de ingesta. El backend también publica eventos persistidos en Mosquitto. La UI consulta la API local; PostgreSQL es la única base persistente.
