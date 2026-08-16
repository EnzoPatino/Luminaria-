# Documentacion Tecnica Draft - Project Luminaria

**Estado:** borrador historico actualizado  
**Version:** 0.3  
**Actualizado:** Agosto 2026

---

## 1. Proposito del Draft

Este documento conserva la idea inicial del sistema completo y la alinea con el estado actual del repositorio. La implementacion disponible hoy es el panel web estatico con MQTT por WebSockets y simulacion local.

La API REST, PostgreSQL y Docker siguen siendo una arquitectura posible para una etapa posterior, pero no forman parte de la version implementada en este arbol.

---

## 2. Flujo Implementado Hoy

```text
[Sensores / ESP32 / Gateway]
          |
          | MQTT TCP 1883
          v
[Mosquitto]
          |
          | MQTT WebSocket 9001 /mqtt
          v
[Panel Web Luminaria]
```

Cuando no hay broker disponible:

```text
[Botones del Simulador]
          |
          v
[window.luminariaMQTT.publish()]
          |
          v
[processIncomingEvent()]
```

---

## 3. Casos de Uso Actuales

### UC-01 - Baja Tension

1. Llega un evento `BAJA_TENSION`.
2. `processIncomingEvent()` actualiza la tension del tablero.
3. Se crea una alerta `CRITICA`.
4. Banner, KPIs, tarjeta del tablero y pin del mapa pasan a estado rojo.

### UC-02 - Desconexion Abrupta / Posible Robo

1. Llega un evento `DESCONEXION_ABRUPTA_FOCO`.
2. La UI toma `datos.id_foco`.
3. El foco queda con `estado: "robado"` y corriente actual de 0 mA.
4. El tablero queda en estado critico.

### UC-03 - Foco Quemado

1. Llega un evento `FOCO_QUEMADO`.
2. La UI toma `datos.id_foco`.
3. El foco queda con `estado: "quemado"`.
4. El tablero queda en advertencia si no existe una condicion critica.

### UC-04 - Restablecimiento Normal

1. Llega un evento `TELEMETRIA_NORMAL`.
2. Se restaura la tension del tablero.
3. Se restauran los focos indicados por `datos.focos_restaurados`.
4. Si no se informa ese arreglo, se restauran todos los focos del tablero.

---

## 4. Eventos JSON

Los contratos activos son los mismos documentados en `DOCUMENTACION_TECNICA.md`:

- `BAJA_TENSION`
- `DESCONEXION_ABRUPTA_FOCO`
- `FOCO_QUEMADO`
- `TELEMETRIA_NORMAL`

No cambiar claves como `tension_medida_v`, `id_foco`, `corriente_actual_ma`, `tiempo_caida_ms`, `duracion_anomalia_s` o `focos_restaurados` sin coordinar con hardware y documentacion.

---

## 5. UI Actual

El panel actual incluye:

- cabecera institucional;
- estado de conexion MQTT;
- banner general;
- KPIs;
- tabs de Tableros, Mapa, Alertas y Consola;
- modal de configuracion MQTT;
- modal de simulacion;
- filtro de alertas por severidad;
- accion para marcar alertas como resueltas;
- mapa de zonas responsive con pines anclados al contenedor del SVG y etiquetas que no se recortan en movil.

---

## 6. Arquitectura Futura Sugerida

Si se incorpora backend, una opcion compatible seria:

```text
[ESP32 / Gateway]
      | MQTT TCP 1883
      v
[Mosquitto]
      |                    \
      | MQTT WS 9001        \ Subscriber backend
      v                      v
[Panel Web]              [API / Worker]
                             |
                             v
                         [PostgreSQL]
```

Endpoints posibles:

- `POST /api/evento`: registrar evento.
- `GET /api/alertas`: listar ultimas alertas.
- `PATCH /api/alertas/:id`: marcar alerta como resuelta.

Tablas posibles:

- `tableros`
- `luminarias`
- `alertas`
- `mediciones`

Estos componentes no deben mencionarse como implementados hasta que existan archivos reales en el repositorio.

---

## 7. Validacion

Comandos minimos para verificar la version actual:

```bash
node -c js/app.js
node -c js/mqtt-client.js
```

Prueba manual:

1. Abrir `index.html`.
2. Esperar conexion MQTT o modo simulacion.
3. Ejecutar cada preset del simulador.
4. Revisar tarjetas, mapa, historial, consola, banner y KPIs.
