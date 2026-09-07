# Arquitectura del Backend - Luminaria Monitoring System

¡Hola! Como tu compañero de desarrollo backend, te explico cómo funcionará nuestro servidor basado **exclusivamente en el protocolo MQTT**.

En este proyecto **NO utilizaremos HTTP ni APIs REST tradicionales**. Toda la comunicación entre los dispositivos de hardware (ESP32 / tableros de las escuelas técnicas), el backend y la interfaz de usuario se realiza de forma bidireccional y en tiempo real a través de un **Broker MQTT (Eclipse Mosquitto)**.

---

## 📡 ¿Por qué es 100% MQTT?

1. **Modelo Publicación / Suscripción (Pub/Sub)**:
   - Los dispositivos y el frontend no hacen peticiones de consulta continua (polling) por HTTP; simplemente se suscriben a *topics*.
   - Cuando ocurre un evento (alarma de robo, foco quemado, baja tensión o telemetría periódica), el emisor publica un mensaje JSON y todos los suscriptores interesados lo reciben instantáneamente.
2. **Eficiencia y Tiempo Real**:
   - MQTT tiene una sobrecarga de red mínima (ideal para microcontroladores y conexiones móviles/IoT).
   - Latencia prácticamente nula para alertas críticas de seguridad eléctrica.

---

## 🏗️ Arquitectura del Backend con MQTT

El backend actuará como un **servicio consumidor y procesador MQTT (Node.js + librería `mqtt`)**, conectándose directamente al broker Mosquitto:

```
[ Hardware IoT / ESP32 ] 
          │ (Publica telemetría y alarmas por TCP 1883)
          ▼
   [ Broker Mosquitto ] ◄──► [ Frontend Web (WebSockets 9001) ]
          ▲
          │ (Suscribe y Publica eventos procesados)
[ Backend Node.js (Servicio MQTT) ]
          │
          ▼
 [ Base de Datos (Persistencia / Historial) ]
```

### Estructura de carpetas propuesta para el backend MQTT:

- **`config/`**:
  - `mqtt.js`: Configuración de conexión al Broker (host, puerto, credenciales, `clientId`, opciones de reconexión).
  - `database.js`: Conexión a la base de datos (MongoDB / PostgreSQL / SQLite).
- **`services/`**:
  - `mqttClient.js`: Inicialización del cliente MQTT, manejo de reconexiones automáticas y suscripción a topics (`neuquen/iluminacion/#`, `api/evento`).
  - `eventProcessorService.js`: Lógica de negocio para procesar cada tipo de evento recibido (`BAJA_TENSION`, `DESCONEXION_ABRUPTA_FOCO`, `FOCO_QUEMADO`, `TELEMETRIA_NORMAL`).
  - `alertService.js`: Lógica para clasificar severidades, registrar incidencias y, si corresponde, publicar topics de notificación/mando.
- **`models/`**:
  - Modelos de datos para persistencia: `Tablero.js`, `Foco.js`, `Alerta.js`, `Medicion.js`.
- **`subscribers/` (o `handlers/`)**:
  - Manejadores específicos para cada patrón de topic recibido.
- **`server.js`**:
  - Punto de entrada que levanta la conexión a la base de datos y activa el cliente MQTT para comenzar a escuchar mensajes.

---

## 📋 Contrato de Eventos MQTT

El backend escuchará y validará los payloads JSON definidos para el proyecto:

| `tipo_evento` | Severidad | Acción del Backend |
|---|---|---|
| `BAJA_TENSION` | `CRITICA` | Registra alerta si `tension_medida_v < 190.0` y actualiza estado del tablero a crítico. |
| `DESCONEXION_ABRUPTA_FOCO` | `CRITICA` | Marca el foco como `robado`, genera registro de incidente de seguridad. |
| `FOCO_QUEMADO` | `ADVERTENCIA` | Marca el foco como `quemado` y registra orden de mantenimiento preventivo. |
| `TELEMETRIA_NORMAL` | `INFO` | Actualiza lecturas de tensión, restaura estados de focos y guarda histórico de telemetría. |

---

## 🤝 Próximos pasos y División de Tareas (2 Desarrolladores)

### 🧑‍💻 Desarrollador 1 (Modelos, Base de Datos y Lógica de Negocio)
- **Base de Datos y Esquemas**: Configurar la conexión a la BD y crear los esquemas para `Tableros`, `Focos`, `Alertas` e `Historial`.
- **Validadores de Contrato JSON**: Crear esquemas de validación (usando librerías como Joi o Zod) para asegurar que los mensajes recibidos por MQTT cumplan exactamente con el formato requerido antes de guardarlos.
- **Servicio de Persistencia**: Implementar las funciones de base de datos que guardan las mediciones y actualizan el estado de cada tablero/foco en tiempo real.

### 🧑‍💻 Desarrollador 2 (Infraestructura MQTT, Suscripciones y Pipeline de Eventos)
- **Conexión MQTT (`mqttClient.js`)**: Instalar la librería `mqtt` en Node.js, configurar la conexión robusta con Mosquitto, manejo de eventos de conexión (`connect`, `reconnect`, `error`, `offline`) y suscripción a los topics.
- **Router / Dispatcher de Mensajes**: Implementar el enrutador que recibe el mensaje binario/string del broker, lo parsea a JSON y lo deriva al manejador correspondiente según el `topic` o `tipo_evento`.
- **Simulador / Publicador de Pruebas**: Crear un script en Node.js que publique eventos de prueba a Mosquitto para probar todo el pipeline sin depender del hardware real.

---

¡Con esta arquitectura 100% MQTT el backend queda totalmente enfocado en el procesamiento de eventos en tiempo real!
