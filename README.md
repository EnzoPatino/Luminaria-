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
- **Simulador de Eventos Hardware**: Herramienta integrada para simular eventos directamente desde la UI sin requerir hardware físico ni broker activo.
- **Banner y KPIs**: Estado general del sistema con alertas, advertencias y cantidad de tableros monitoreados.
- **Tema claro/oscuro**: Botón en la cabecera para alternar entre los dos temas visuales. La preferencia se persiste en `localStorage`. El modo oscuro es el predeterminado.

La interfaz es **100% responsive**: en pantallas móviles la navegación se agrupa en un menú flotante inferior y el mapa adapta sus pines y etiquetas para evitar recortes.

---

## 3. Guía de Ejecución

### Ejecución Directa
Abra el archivo `index.html` directamente en cualquier navegador web. Por defecto, si no encuentra un broker Mosquitto activo, la interfaz iniciará en **Modo Simulación**.

### Ejecución con Servidor HTTP Local
Para servir la aplicación mediante HTTP:
```bash
python3 -m http.server 8080
```
Luego ingrese a `http://localhost:8080` en su navegador.

---

## 4. Configuración de Mosquitto MQTT

Para conectar la UI a un broker Mosquitto real mediante WebSockets:

1. Asegúrese de que `mosquitto.conf` contenga un listener en puerto WebSocket (por ejemplo, 9001):
```ini
listener 1883
protocol mqtt

listener 9001
protocol websockets
allow_anonymous true
```
2. En la UI, haga clic en el botón **Broker MQTT**.
3. Ingrese el Host (`localhost` o IP del servidor) y el Puerto WebSocket (`9001`).
4. Ingrese los topics a suscribir: `neuquen/iluminacion/#, api/evento`.

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
├── Documentacion/
│   ├── DOCUMENTACION_TECNICA.md   # Documentación técnica completa para desarrolladores
│   ├── CONTEXTO_TECNICO.md        # Manual de contexto y especificaciones técnicas
│   ├── DOCUMENTACION_TECNICA_DRAFT(1).md # Borrador histórico de arquitectura
│   └── Reporte_MQTT_Pasantias_corregido.docx
├── MANUAL_DESARROLLADOR.md    # Guía operativa para desarrolladores
└── README.md                    # Guía rápida del proyecto
```

---

## 6. Documentación Detallada

Para consultar la documentación técnica completa del sistema o las especificaciones del contrato de datos, revise los archivos ubicados en el directorio `Documentacion/`:
- **Documentación Técnica para Desarrolladores**: `Documentacion/DOCUMENTACION_TECNICA.md`
- **Guía de Contexto y Especificaciones Técnicas**: `Documentacion/CONTEXTO_TECNICO.md`
- **Manual de Integración Frontend ↔ Mosquitto**: `README_MQTT_UI.md`
- **Manual Operativo del Desarrollador**: `MANUAL_DESARROLLADOR.md`
