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

## 2. Cómo Editar Tableros en PostgreSQL local

Los tableros se administran desde PostgreSQL local y la API del backend. Si el servicio de datos no responde, la aplicación no inventa tableros ni habilita edición en memoria.

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
Para agregar un tablero nuevo, crea el registro en PostgreSQL usando una migración SQL versionada. Asegúrate de:
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
     focos: {} // Estructura de focos persistida en PostgreSQL
   },
   ```

### 🗑️ Borrar un tablero
Simplemente **elimina todo el bloque** de ese tablero dentro de `appState.tableros` y guarda el archivo.

---

## 3. Editar en Producción

Los datos de tableros se leen desde PostgreSQL local a través de la API del backend. Para modificar ubicaciones, actualizá los campos del tablero en la base local respetando el esquema de `backend/src/db/migrations/`, o agregá el cambio mediante una migración SQL versionada.
