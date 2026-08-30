# Documentacion Tecnica - Project Luminaria

**Sistema de Monitoreo y Alertas Electricas en Tiempo Real**  
**Municipalidad de Neuquen**
**Version documentada:** Agosto 2026

---

## 1. Alcance Actual

Project Luminaria es una interfaz web estatica para monitoreo de tableros electricos de alumbrado publico. La version actual del repositorio implementa el panel de control en navegador, la integracion MQTT por WebSockets y un modo de simulacion local para pruebas sin hardware ni broker activo.

El backend REST, PostgreSQL y los contenedores Docker siguen siendo parte de la arquitectura objetivo del proyecto, pero no estan implementados en el arbol actual. Cualquier documentacion de API o base de datos debe tratarse como especificacion futura hasta que esos modulos existan en el repositorio.

## 2. Estructura del Repositorio

```text
Project_Luminaria/
|-- index.html
|-- css/
|   `-- styles.css
|-- js/
|   |-- app.js
|   `-- mqtt-client.js
|-- Documentacion/
|   |-- DOCUMENTACION_TECNICA.md
|   |-- CONTEXTO_IA.md
|   |-- DOCUMENTACION_TECNICA_DRAFT(1).md
|   `-- Reporte_MQTT_Pasantias_corregido.docx
|-- README.md
`-- README_MQTT_UI.md
```

### Archivos principales

- `index.html`: estructura de la aplicacion, cabecera, KPIs, tabs, mapa, historial, consola y modales. Incluye un script anti-flash inline en el `<head>` que aplica el tema guardado antes de pintar la pagina.
- `css/styles.css`: sistema visual responsive con tema oscuro por defecto y tema claro (`[data-theme="light"]`). Variables CSS centralizadas en `:root` para todos los colores. Estados semaforo y ajustes moviles.
- `js/app.js`: estado de tableros, renderizado de UI, procesamiento de eventos, filtros, sonidos y toggle de tema claro/oscuro con persistencia en `localStorage`.
- `js/mqtt-client.js`: cliente Paho MQTT sobre WebSockets, persistencia de configuracion y fallback a simulacion.

---

## 3. Arquitectura en Ejecucion

```text
[ESP32 / Gateway]
          |
          | MQTT TCP 1883
          v
[Broker Mosquitto]
          |
          | MQTT WebSocket 9001 /mqtt
          v
[Navegador: index.html + Paho MQTT]
          |
          v
[app.js: estado local, alertas, mapa, KPIs y consola]
```

Si la libreria Paho no esta disponible o la conexion al broker falla, `mqtt-client.js` activa el modo simulacion. En ese modo, las publicaciones se procesan internamente mediante el mismo callback que usa MQTT real.

---

## 4. Interfaz Implementada

La UI se organiza en cuatro pestañas principales:

- **Tableros Electricos:** grilla de tarjetas por tablero con tension, fase, luminarias operativas y estado semaforo.
- **Mapa de Zonas:** mapa SVG representativo con pines interactivos por tablero.
- **Alertas:** historial filtrable por `ALL`, `CRITICA`, `ADVERTENCIA` e `INFO`; cada alerta puede marcarse como resuelta.
- **Consola MQTT:** registro de mensajes entrantes, salientes, simulados y errores de conexion.

La cabecera incluye:

- estado de conexion MQTT;
- acceso al simulador;
- configuracion del servidor MQTT;
- activacion o silenciamiento del sonido de alarma;
- **interruptor de tema claro/oscuro** (boton con icono `fa-moon` / `fa-sun`).

El panel superior incluye un banner general y KPIs de alertas, advertencias y cantidad de tableros monitoreados.

### 4.0 Tema Claro / Oscuro

La aplicacion soporta dos temas visuales que el usuario puede alternar desde el boton `#btnToggleTheme` en la cabecera. El modo oscuro es el predeterminado.

**Mecanismo:**

- El atributo `data-theme` se aplica sobre `<html>` (`<html data-theme="light">` o `<html data-theme="dark">`).
- `styles.css` define las variables en `:root` (modo oscuro) y las redefine en el bloque `[data-theme="light"]`.
- La preferencia se persiste en `localStorage` bajo la clave `luminaria_theme`.

**Anti-flash:** un script inline al final del `<head>` de `index.html` lee `localStorage` y aplica el atributo `data-theme` antes de que el navegador pinte la pagina, evitando el flash blanco al cargar en modo claro. **No eliminar este script.**

**Variables CSS que cambian entre temas:**

| Categoria | Variables | Notas |
|---|---|---|
| Backgrounds | `--bg-dark`, `--bg-card`, `--bg-card-hover`, `--bg-input`, `--bg-terminal` | Oscuro: slate-900. Claro: blanco / slate-100. |
| Bordes | `--border-color`, `--border-focus` | Se aclaran en modo claro. |
| Texto | `--text-main`, `--text-muted`, `--text-dim` | Oscuro: blanco. Claro: slate-900. |
| Acentos semitransparentes | `--color-*-bg`, `--color-*-border`, `--color-accent-bg` | Recalibrados para fondo blanco. |
| Colores del mapa SVG | `--map-bg`, `--map-river-bg`, `--map-path`, `--map-grid`, `--map-river` | Aplicados a los `<path>` del SVG. |
| Componentes compuestos | `--meter-track-bg`, `--mobile-nav-bg`, `--modal-overlay-bg`, `--pin-shadow`, `--pin-label-shadow`, `--modal-shadow`, `--shadow-card` | Garantizan contraste en ambos temas. |

Los **colores solidos de acento** (`--color-ok`, `--color-warning`, `--color-critical`, `--color-accent`, `--color-accent-text`) **no cambian** entre temas: ya tienen buen contraste sobre fondos claros y oscuros.

**Regla para componentes nuevos:** usar siempre variables CSS en lugar de colores hex hardcodeados. Si un componente nuevo necesita un color, agregarlo como variable en `:root` y redefinirlo en `[data-theme="light"]`.

### 4.1 Mapa de Zonas (Detalle de Implementacion)

El mapa se compone de un SVG decorativo y una capa de pines superpuesta:

```html
<div class="map-svg-wrapper">   <!-- position: relative; height: 240px (200px en movil) -->
  <svg width="100%" height="100%" viewBox="0 0 800 240" preserveAspectRatio="none">...</svg>
  <div class="map-pins-layer">  <!-- position: absolute; inset: 0 -->
    <!-- pines renderizados por renderMapPins() -->
  </div>
</div>
```

Reglas clave:

- La capa `.map-pins-layer` debe vivir **siempre dentro** de `.map-svg-wrapper` (que es `position: relative`). Si se mueve fuera, los pines se anclan al viewport y quedan desalineados del mapa; este anclaje es la causa de los bugs visuales en movil.
- Cada pin se posiciona con `left: posX%` y `top: posY%` sobre la misma area que el SVG y se centra con `transform: translate(-50%, -50%)`.
- `renderMapPins()` en `js/app.js` calcula la severidad del tablero (verde `--color-ok`, amarillo `--color-warning`, rojo `--color-critical`) y agrega un listener de click que selecciona el tablero y cambia a la pestana de tableros.

Comportamiento responsive (max-width: 560px):

- Altura del mapa: `240px -> 200px` para que el pin inferior no quede pegado al borde.
- Iconos de pin reducidos a 30px y fuente de etiqueta a 0.62rem.
- Las etiquetas limitan su ancho a `max-width: 92px`, permiten salto de linea (`white-space: normal`) y se centran para no cortarse en los bordes del mapa.
- La leyenda `.map-legend` se oculta por debajo de 768px.

---

## 5. Estado Inicial de Tableros

`js/app.js` inicializa cuatro tableros:

| ID | Nombre | Ubicacion | Fase | Focos iniciales |
|---|---|---|---|---|
| `TABLERO_01` | Centro / Palacio Municipal | Centro / Palacio Municipal | `L1` | `FOCO_A1` a `FOCO_A4`, `FOCO_B1` a `FOCO_B4` |
| `TABLERO_02` | Parque Norte | Parque Norte - Sector Canchas | `L2` | `FOCO_C1` a `FOCO_C3` |
| `TABLERO_03` | Paseo de la Costa | Paseo de la Costa - Rio Limay | `L3` | `FOCO_D1` a `FOCO_D2` |
| `TABLERO_04` | Avenida Argentina | Av. Argentina y Monolito | `L1` | `FOCO_E1` |

Si llega un evento para un `id_tablero` desconocido, la UI crea un tablero dinamico con ubicacion del evento o `Ubicacion Desconocida`.

---

## 6. Configuracion MQTT

Configuracion por defecto en `js/mqtt-client.js`:

```js
{
  host: 'localhost',
  port: 9001,
  path: '/mqtt',
  clientId: 'luminaria_web_' + Math.random().toString(16).substring(2, 8),
  topics: ['neuquen/iluminacion/#', 'api/evento'],
  qos: 1,
  keepAlive: 60,
  cleanSession: true
}
```

La configuracion modificada desde el modal de servidor se guarda en `localStorage` bajo la clave `luminaria_mqtt_config`.

Configuracion minima esperada para Mosquitto:

```ini
listener 1883
protocol mqtt
allow_anonymous true

listener 9001
protocol websockets
allow_anonymous true
```

---

## 7. Contrato de Eventos JSON

Todos los eventos deben incluir:

| Campo | Tipo | Descripcion |
|---|---|---|
| `tipo_evento` | string | Tipo de evento reconocido por la UI |
| `id_tablero` | string | Identificador del tablero afectado |
| `timestamp` | string ISO 8601 | Fecha/hora del evento |
| `datos` | object | Datos especificos del tipo de evento |
| `severidad` | string | `CRITICA`, `ADVERTENCIA` o `INFO` |
| `ubicacion` | string | Ubicacion textual del tablero o luminaria |

### 7.1 Baja Tension

```json
{
  "tipo_evento": "BAJA_TENSION",
  "id_tablero": "TABLERO_01",
  "timestamp": "2025-06-10T14:32:05Z",
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

Efecto en UI: actualiza `tension_v`, fase del tablero, registra alerta critica, cambia banner/KPIs y marca tablero/mapa en rojo.

### 7.2 Desconexion Abrupta de Foco

```json
{
  "tipo_evento": "DESCONEXION_ABRUPTA_FOCO",
  "id_tablero": "TABLERO_01",
  "timestamp": "2025-06-10T15:10:22Z",
  "datos": {
    "id_foco": "FOCO_A3",
    "corriente_previa_ma": 450.0,
    "corriente_actual_ma": 0.0,
    "tiempo_caida_ms": 85,
    "estado_circuito": "ACTIVO"
  },
  "severidad": "CRITICA",
  "ubicacion": "Pasillo Principal - Luminaria 3"
}
```

Efecto en UI: marca el foco como `robado`, registra alerta critica y prioriza estado rojo.

### 7.3 Foco Quemado

```json
{
  "tipo_evento": "FOCO_QUEMADO",
  "id_tablero": "TABLERO_01",
  "timestamp": "2025-06-10T16:45:00Z",
  "datos": {
    "id_foco": "FOCO_B1",
    "corriente_esperada_ma": 450.0,
    "corriente_medida_ma": 12.5,
    "duracion_anomalia_s": 30,
    "estado_circuito": "ACTIVO"
  },
  "severidad": "ADVERTENCIA",
  "ubicacion": "Laboratorio de Electronica - Luminaria 1"
}
```

Efecto en UI: marca el foco como `quemado`, registra advertencia y usa estado amarillo salvo que exista una condicion critica.

### 7.4 Telemetria Normal

```json
{
  "tipo_evento": "TELEMETRIA_NORMAL",
  "id_tablero": "TABLERO_01",
  "timestamp": "2026-08-14T12:00:00Z",
  "datos": {
    "tension_medida_v": 220.0,
    "tension_nominal_v": 220.0,
    "fase": "L1",
    "focos_restaurados": ["FOCO_A3", "FOCO_B1"]
  },
  "severidad": "INFO",
  "ubicacion": "Centro / Palacio Municipal"
}
```

Efecto en UI: restaura tension y focos indicados. Si `focos_restaurados` no se envia, restaura todos los focos del tablero a `ok` con corriente nominal de 450 mA.

---

## 8. Reglas de Estado Visual

Prioridad de severidad:

1. **Critico:** `tension_v < 190.0`, foco con estado `robado` o alerta no resuelta con severidad `CRITICA`.
2. **Advertencia:** `190.0 <= tension_v < 210.0`, foco con estado `quemado` o alerta no resuelta con severidad `ADVERTENCIA`.
3. **Normal:** tension nominal y sin fallas activas.

Las alertas resueltas dejan de contarse en KPIs y en la severidad derivada del mapa, aunque el historial permanece visible.

---

## 9. Pruebas Manuales

1. Abrir `index.html` directamente o servir el directorio con `python3 -m http.server 8080`.
2. Verificar que la app intente conectar a `localhost:9001/mqtt`.
3. Si no hay broker, confirmar que pasa a `Modo Simulacion Activo`.
4. Abrir **Simulador** y ejecutar los cuatro presets: baja tension, desconexion abrupta, foco quemado y telemetria normal.
5. Revisar que cambien las tarjetas, el mapa, el banner, los KPIs, el feed de alertas y la consola.
6. Marcar alertas como resueltas y verificar que los contadores se actualicen.
7. Probar el interruptor de tema claro/oscuro: el icono debe alternar entre `fa-moon` y `fa-sun`, todos los componentes (incluido el mapa SVG) deben mantener contraste legible, y la eleccion debe persistir al recargar.
8. Limpiar `localStorage` y recargar para confirmar que la aplicacion arranca en modo oscuro por defecto sin flash.

Validaciones sintacticas recomendadas:

```bash
node -c js/app.js
node -c js/mqtt-client.js
```

---

## 10. Cambios Documentados en Esta Version

- Rediseño responsive de la interfaz, especialmente navegacion y layout movil.
- Simplificacion de pantalla principal en pestañas.
- Incorporacion de grilla de tableros como vista principal.
- Persistencia de configuracion MQTT en `localStorage`.
- Simulador con evento adicional `TELEMETRIA_NORMAL`.
- Registro de alertas resolubles y filtros por severidad.
- Correccion del anclaje de los pines del mapa: `#mapPinsContainer` (`.map-pins-layer`) se movio dentro de `.map-svg-wrapper` para que los pines queden fijados al mapa en todos los tamaños de pantalla.
- Ajuste responsive del mapa en movil: etiquetas con `max-width` y salto de linea para evitar recortes en los bordes, iconos reducidos y altura de mapa ampliada.
- Aclaracion de que backend/API/PostgreSQL no estan presentes actualmente en el repositorio.
- **Interruptor de tema claro/oscuro** en la cabecera del header. Atributo `data-theme` aplicado sobre `<html>`, redefinicion de variables CSS en `[data-theme="light"]`, persistencia en `localStorage` clave `luminaria_theme` y script anti-flash en el `<head>` de `index.html` para evitar parpadeo al cargar. Colores hardcodeados del mapa SVG y de varios componentes migrados a variables CSS para soportar ambos temas.
