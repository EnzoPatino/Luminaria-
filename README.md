# Project Luminaria - Sistema de Monitoreo y Alertas Eléctricas

**Municipalidad de Neuquén**

---

## 1. Introducción

El proyecto **Luminaria** es un sistema de monitoreo en tiempo real para tableros de iluminación pública en la ciudad de Neuquén (Parque Norte, Paseo de la Costa, avenidas y plazas). El objetivo principal es detectar anomalias eléctricas (bajas de tensión, focos quemados y desconexiones o robos de luminarias) y notificar al personal técnico de mantenimiento de forma inmediata.

## 2. Componentes de la Interfaz Web (UI)

La interfaz web es una aplicación liviana desarrollada con **HTML5, CSS3 vanilla y JavaScript**, diseñada para ser ejecutada directamente en cualquier navegador o servidor web sin necesidad de compilación o frameworks pesados.

### Funcionalidades
- **Tableros Eléctricos**: Grilla de tarjetas por tablero con tensión, fase, luminarias operativas y estado semáforo.
- **Mapa de Zonas**: Mapa SVG representativo con pines interactivos por tablero; al hacer clic selecciona el tablero y muestra su telemetría.
- **Alertas**: Historial de eventos filtrable por severidad (`CRITICA`, `ADVERTENCIA`, `INFO`) con posibilidad de marcar alertas como resueltas.
- **Consola de Telemetría MQTT**: Inspector de mensajes JSON recibidos y transmitidos por el broker.
- **Banner y KPIs**: Estado general del sistema con alertas, advertencias y cantidad de tableros monitoreados.
- **Tema claro/oscuro**: Botón en la cabecera para alternar entre los dos temas visuales. La preferencia se persiste en `localStorage`. El modo oscuro es el predeterminado.

La interfaz es **100% responsive**: en pantallas móviles la navegación se agrupa en un menú flotante inferior y el mapa adapta sus pines y etiquetas para evitar recortes.

---

## 3. Guía de Ejecución

### Despliegue en Producción (Docker Compose)
Levanta los servicios (PostgreSQL 16, Mosquitto MQTT, Backend Node.js y Caddy):

```bash
docker compose up -d --build
```
El panel requiere DNS apuntando al servidor y los puertos 80 y 443 accesibles para que Caddy emita el certificado TLS. Abrilo en `https://<DOMINIO>/`.

Antes del primer despliegue, configurá los secretos requeridos y el administrador inicial siguiendo [DEPLOY_PRODUCCION.md](DEPLOY_PRODUCCION.md). Para producción, el panel debe publicarse detrás de HTTPS.

### Ejecución de Desarrollo Local
La interfaz requiere el backend y la base local para iniciar sesión y mostrar datos. En `js/config.js`, configurá temporalmente `apiBaseUrl: "http://localhost:3000"` para servir el frontend en otro puerto. Luego:
```bash
# Terminal 1: backend y PostgreSQL disponibles
cd backend && npm install && npm run dev

# Terminal 2: frontend (origen permitido por CORS)
python3 -m http.server 5500
```
Abrí `http://localhost:5500`. El inicio de sesión siempre se valida contra el backend. Para producción, dejá `apiBaseUrl` vacío cuando frontend y API compartan origen.

Si GitHub Pages y el backend están en dominios distintos, configurar `apiBaseUrl` en `js/config.js` con el origen público del backend (sin `/api` al final). El backend también debe permitir el origen `https://<usuario>.github.io` en `CORS_ORIGIN`. En producción el login sigue validándose contra el backend.

---

## 4. Integración con ChirpStack (LoRaWAN vía Webhook)

El backend recibe la telemetría enviada por los sensores y gateways a través de **ChirpStack** mediante un webhook HTTP:

1. **Configuración del Webhook en ChirpStack:**
   - Tipo de integración: **HTTP**
   - URL del Endpoint: `https://<DOMINIO>/api/uplink`
   - Formato de payload: **JSON**
   - Evento suscrito: **Uplink**
   - Header `X-ChirpStack-Token`: el valor de `CHIRPSTACK_WEBHOOK_TOKEN` del `.env` del servidor.
2. **Endpoint de verificación:** `GET /api/uplink` (informa si el receptor está listo).
3. **Inspección de diagnóstico:** `GET /api/uplink/last` (requiere token JWT de operador autorizado).

El adaptador (`chirpstackAdapter.js`) mapea el identificador del dispositivo (DevEUI) con el tablero asignado, clasifica los voltajes y persiste los registros en PostgreSQL local.

### Configuración autenticada de Mosquitto MQTT (opcional)

Compose mantiene los listeners MQTT dentro de la red Docker y no publica los puertos 1883 ni 9001 al host. El panel se conecta por WebSocket seguro a través de Caddy y requiere el usuario `web_dashboard`. El broker no admite clientes anónimos. Para configurar una instalación nueva, seguí [DEPLOY_PRODUCCION.md](DEPLOY_PRODUCCION.md). Los dispositivos que necesiten MQTT directo requieren exposición de red y TLS configurados específicamente; no publiques el puerto 1883 sin cifrado.

Si se desea usar MQTT como fuente de ingesta, configurar `MQTT_SUBSCRIBER_ENABLED=true` en `.env` y mantener la autenticación del `backend_worker`:
```bash
docker compose up -d mosquitto
```

---

## 5. Estructura del Proyecto

```
Project_Luminaria/
├── index.html                 # Estructura principal de la interfaz web
├── css/
│   └── styles.css             # Estilos CSS responsivos con tema oscuro y claro
├── js/
│   ├── mqtt-client.js         # Cliente WebSocket MQTT para Mosquitto
│   └── app.js                 # Lógica de UI, medidores, gestión de eventos y tema
├── backend/
│   ├── server.js              # Entrypoint del servidor backend
│   └── src/
│       ├── controllers/       # Lógica de los endpoints (incluye chirpstackController.js)
│       ├── routes/            # Definición de rutas (incluye uplinkRoutes.js)
│       └── services/          # Reglas de negocio (incluye chirpstackAdapter.js)
├── Documentacion/
│   ├── DOCUMENTACION_TECNICA.md   # Documentación técnica completa para desarrolladores
│   ├── CONTEXTO_TECNICO.md        # Manual de contexto y especificaciones técnicas
│   ├── DOCUMENTACION_TECNICA_DRAFT(1).md # Borrador histórico de arquitectura
│   └── Reporte_MQTT_Pasantias_corregido.docx
├── MANUAL_DESARROLLADOR.md    # Guía operativa para desarrolladores
└── README.md                  # Guía rápida del proyecto
```

---

## 6. Documentación Detallada

Para consultar la documentación técnica completa del sistema o las especificaciones del contrato de datos, revise los archivos ubicados en el directorio `Documentacion/`:
- **Documentación Técnica para Desarrolladores**: `Documentacion/DOCUMENTACION_TECNICA.md`
- **Guía de Contexto y Especificaciones Técnicas**: `Documentacion/CONTEXTO_TECNICO.md`
- **Manual de Integración Frontend ↔ Mosquitto**: `README_MQTT_UI.md`
- **Manual Operativo del Desarrollador**: `MANUAL_DESARROLLADOR.md`
