# Implementación de base de datos — Project Luminaria

Esta carpeta contiene los cambios de persistencia preparados para copiar sobre el repositorio `Luminaria-`.

## Qué implementa

- PostgreSQL con `pg` y SQL plano.
- 6 tablas: `zonas`, `tableros`, `sensores`, `lecturas`, `alertas`, `estadisticas_zona`.
- Se eliminan como entidades de esta etapa: técnico, usuario_app, reparación y luminaria/foco.
- `id_foco` queda como texto en `alertas`.
- `lecturas` llega a `tableros` únicamente mediante `sensores`.
- `alertas` mantiene `id_tablero` directo porque el evento MQTT siempre trae ese identificador.
- Sensor virtual automático si un tablero todavía no tiene sensor registrado.
- Alertas CRITICA: 6 meses. Alertas ADVERTENCIA/INFO y lecturas: 1 mes.
- Mínimo, máximo y promedio de tensión por zona y día antes de perder las lecturas crudas.
- Purga segura: primero alertas, después lecturas sin referencias de alertas.
- Endpoint mínimo `POST /api/eventos` para persistir el mismo JSON que usa MQTT.
- Scheduler diario con `setInterval`, sin añadir `node-cron`.

## Aplicación

1. Copiá el contenido de esta carpeta sobre la raíz del repo.
2. En `backend/`, ejecutá `npm install` para actualizar `package-lock.json` y descargar `pg`.
3. Copiá `backend/.env.example` a `backend/.env`.
4. Levantá PostgreSQL con la configuración de tu entorno.
5. Ejecutá `npm run db:migrate`.
6. Ejecutá `npm run db:seed`.
7. Ejecutá `npm start`.

Para ejecutar mantenimiento manual:

`npm run db:maintenance`

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
