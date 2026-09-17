# Gestión del Mapa de Zonas: Ubicación de Tableros

Este documento explica cómo cambiar de posición, agregar o eliminar manualmente los puntos (tableros) en el "Mapa de Zonas" interactivo del proyecto Luminaria.

## 🗺️ 1. Entendiendo el Sistema de Coordenadas
Para facilitar la administración y mantener compatibilidad con la estructura original, la aplicación **no utiliza Latitud y Longitud directas** en la base de datos. En su lugar, utiliza un sistema de **porcentajes relativos** (`posX` y `posY`) que van del `0` al `100`.

- `posX (0 a 100)`: Eje horizontal (Oeste a Este).
  - `0`: Extremo Oeste de Neuquén.
  - `100`: Extremo Este de Neuquén.
- `posY (0 a 100)`: Eje vertical (Sur a Norte).
  - `0`: Extremo Sur de Neuquén.
  - `100`: Extremo Norte de Neuquén.

El archivo `app.js` se encarga de traducir matemáticamente estos porcentajes a las coordenadas reales del mapa interactivo de Leaflet.

---

## 💻 2. Cómo Editar de forma Local (Modo Demo / Sin conexión)

Si la aplicación no está conectada a la base de datos o se está usando la data "mockeada", los tableros viven dentro de `js/app.js` en el objeto `appState.tableros`.

### 📌 Mover un tablero existente
1. Abre el archivo `js/app.js`.
2. Busca la sección de inicialización `tableros: { TABLERO_01: { ... } }` (cerca de la línea 15).
3. Encuentra el tablero que deseas mover y ajusta sus valores `posX` y `posY`:
   ```javascript
   TABLERO_01: {
     id: "TABLERO_01",
     nombre: "Centro / Palacio Municipal",
     posX: 50, // Cambia este valor (ej. 50 lo pondrá en el centro horizontal)
     posY: 50, // Cambia este valor (ej. 50 lo pondrá en el centro vertical)
     // ...
   }
   ```

### ➕ Agregar un tablero nuevo
Para agregar un tablero nuevo, simplemente copia un bloque de tablero existente y pégalo justo debajo. Asegúrate de:
1. Cambiar la clave principal (ej. `TABLERO_05`).
2. Cambiar el `id` para que coincida.
3. Establecer sus posiciones `posX` y `posY` (de 0 a 100).
   ```javascript
   TABLERO_05: {
     id: "TABLERO_05",
     nombre: "Paseo de la Costa",
     ubicacion: "Isla 132",
     posX: 80, 
     posY: 10, 
     tension_v: 220.0,
     tension_nominal_v: 220.0,
     fase: "L1",
     focos: {} // Puedes dejar los focos vacíos o agregar mock data
   },
   ```

### 🗑️ Borrar un tablero
Simplemente **elimina todo el bloque** de ese tablero dentro de `appState.tableros` y guarda el archivo.

---

## ☁️ 3. Cómo Editar en Producción (Base de Datos Supabase)

Cuando la aplicación está conectada a **Supabase**, los datos precargados de `app.js` son ignorados y se renderiza lo que viene directamente de la nube. 

Para modificar el mapa:
1. Ingresa a tu panel de control de **Supabase**.
2. Ve al **Table Editor** (Editor de tablas).
3. Abre la tabla llamada `tableros`.

### 📌 Mover un tablero
- Ubica el tablero en la tabla.
- Edita las columnas `pos_x` y `pos_y` ingresando números entre 0 y 100.

### ➕ Agregar un tablero nuevo
- Haz clic en **Insert Row** (Insertar fila).
- Rellena obligatoriamente los campos principales, prestando especial atención a `pos_x` y `pos_y`.
- Al guardar la fila, el mapa en la aplicación mostrará automáticamente el nuevo punto al recargar la página.

### 🗑️ Borrar un tablero
- Selecciona la fila del tablero que quieres eliminar y bórrala (Delete Row). Desaparecerá de inmediato del mapa.

---

## ⚙️ Ajuste de Calibración del Mapa (Avanzado)
Si notas que el rango de 0 a 100 se queda "corto" o se sale mucho de la ciudad de Neuquén, puedes ajustar la caja delimitadora (Bounding Box) directamente en `app.js`.

Busca la función `renderMapPins()` en `app.js`:
```javascript
const baseLat = -38.98; // Límite inferior (Sur)
const baseLng = -68.08; // Límite izquierdo (Oeste)

// El 0.05 es cuánto crece hacia el Norte (hasta -38.93)
const lat = baseLat + (tablero.posY / 100) * 0.05;

// El 0.08 es cuánto crece hacia el Este (hasta -68.00)
const lng = baseLng + (tablero.posX / 100) * 0.08;
```
Cambiando esos valores maestros, reescalarás la distribución de todos los pines instantáneamente para abarcar un área mayor o menor.
