# 🔌 Sistema de Monitoreo y Alertas Eléctricas

**Proyecto interescolar EPET 14 × EPET 20**
`estado: draft` · `versión: 0.2` · `junio 2025`

> Hardware: EPET 14 — Software: EPET 20

---

## ¿De qué va esto?

Estamos armando un sistema que monitorea un tablero eléctrico en tiempo real y le avisa a un técnico cuando algo sale mal. La EPET 14 pone los sensores y el microcontrolador; nosotros (EPET 20) ponemos el servidor, la base de datos y el panel donde se ven las alertas.

El flujo es simple:

```
[Sensores + Micro EPET14]  →  HTTP POST (JSON)  →  [API EPET20]  →  [Panel Web Técnico]
```

Tres cosas que el sistema tiene que detectar y avisar:

| #   | Qué pasó                              | Cómo se detecta                       |
| --- | ------------------------------------- | ------------------------------------- |
| 1   | Baja tensión en la red                | Sensor de tensión                     |
| 3   | Foco quemado                          | Corriente muy baja de forma sostenida |
| 2   | Robo / desconexión abrupta de un foco | Caída brusca de corriente             |

---

## 1. Arquitectura de Comunicación

### Cómo funciona

La placa de la EPET 14 detecta un evento, arma un JSON con los datos y hace un **HTTP POST** a nuestra API. Punto. No hay broker, no hay protocolo especial — solo WiFi y una request HTTP que cualquier ESP32 puede hacer con la librería `HTTPClient`.

```
[ESP32 / Micro]  ──POST /api/evento──►  [FastAPI o Express]  ──►  [PostgreSQL]
                      JSON Body                  ↓
                                          [Panel Web]  ◄──  [Técnico]
```

### Nuestro endpoint (lo que tiene que llamar la EPET 14)

```
POST http://<ip-de-nuestro-servidor>:8000/api/evento
Content-Type: application/json
```

Eso es todo lo que necesitan saber. El cuerpo del POST varía según el tipo de evento (ver sección 4).

### Stack que vamos a usar (EPET 20)

Elegimos una de estas dos opciones según lo que mejor manejemos:

**Opción A — Python con FastAPI**
```
fastapi + uvicorn + sqlalchemy + psycopg2
```
Recomendada si el equipo viene de Python. FastAPI es muy rápido de levantar y genera documentación automática en `/docs`.

**Opción B — Node.js con Express**
```
express + pg (o sequelize) + dotenv
```
Buena opción si preferimos JavaScript. Misma funcionalidad, diferente lenguaje.

La base de datos va a ser **PostgreSQL** en ambos casos, corriendo en Docker.

### Por qué Docker

Todo el entorno (API + base de datos) corre en contenedores Docker. Esto significa que no importa si usás Windows, Linux o Mac: todo el equipo levanta exactamente el mismo entorno con un solo comando. Nada de "en mi PC funciona".

```bash
docker-compose up -d
# ↑ esto levanta todo: la API y la base de datos
```

---

## 2. Casos de Uso

### UC-01 — Baja Tensión en la Red

```
1. El sensor detecta que la tensión bajó de 190V (en una red de 220V).
2. El micro arma el JSON con los datos y hace POST a /api/evento.
3. Nuestra API recibe el POST, valida el JSON y lo guarda en la base de datos.
4. La alerta aparece en el panel del técnico marcada como CRÍTICA (color rojo).
5. El técnico puede marcarla como vista o resuelta.
```

### UC-02 — Desconexión Abrupta / Robo de Foco

```
1. Un foco estaba encendido y de golpe la corriente cae a 0 en menos de 200ms.
2. El micro detecta que eso no fue un apagado normal (el circuito sigue activo).
3. Manda el POST con el ID del foco afectado y los valores de corriente antes/después.
4. El panel muestra qué foco fue y a qué hora pasó.
```

### UC-03 — Foco Quemado

```
1. Un foco debería estar consumiendo ~450mA pero está consumiendo 12mA hace 30 segundos.
2. El micro determina que es falla del componente (no robo, porque la caída fue lenta).
3. Manda el POST con el diagnóstico.
4. El panel muestra el foco que hay que reemplazar, marcado como ADVERTENCIA.
```

> **Para la EPET 14:** la diferencia entre UC-02 y UC-03 la puede calcular el micro mirando la velocidad de caída. Si cayó en menos de 200ms → desconexión abrupta. Si la corriente fue bajando lento o lleva tiempo en un valor muy bajo → foco quemado. Si tienen dudas, manden los dos campos (`tiempo_caida_ms` y `duracion_anomalia_s`) y nosotros hacemos la lógica del lado del servidor.

---

## 3. Estructura de los JSON (lo que tiene que mandar la EPET 14)

Todos los eventos van al mismo endpoint: `POST /api/evento`. Lo que cambia es el cuerpo del JSON.

### 3.1 Baja Tensión

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
  "ubicacion": "Aula Taller 3 - Planta Baja"
}
```

| Campo | Tipo | Qué es |
|-------|------|--------|
| `tipo_evento` | string | Siempre `"BAJA_TENSION"` para este caso |
| `id_tablero` | string | ID del tablero (lo definimos juntos) |
| `timestamp` | string ISO 8601 | Fecha y hora en UTC cuando ocurrió |
| `tension_medida_v` | float | Voltaje real que midió el sensor |
| `tension_nominal_v` | float | Voltaje normal de la red (220V) |
| `umbral_minimo_v` | float | A partir de qué valor se dispara la alerta |
| `fase` | string | `"L1"`, `"L2"`, `"L3"` o `"MONOFASICA"` |
| `severidad` | string | `"CRITICA"`, `"ADVERTENCIA"` o `"INFO"` |
| `ubicacion` | string | Dónde está el tablero, en texto libre |

---

### 3.2 Desconexión Abrupta / Robo de Foco

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

| Campo | Tipo | Qué es |
|-------|------|--------|
| `id_foco` | string | ID del foco dentro del tablero (ej: `"FOCO_A3"`) |
| `corriente_previa_ma` | float | Cuántos mA consumía antes de la caída |
| `corriente_actual_ma` | float | Cuántos mA hay ahora (debería ser 0) |
| `tiempo_caida_ms` | int | En cuántos milisegundos cayó la corriente |
| `estado_circuito` | string | Si el circuito está `"ACTIVO"` o `"INACTIVO"` |

> Criterio: si `tiempo_caida_ms < 200` y `estado_circuito = "ACTIVO"` → lo clasificamos como desconexión abrupta.

---

### 3.3 Foco Quemado

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
  "ubicacion": "Laboratorio de Electrónica - Luminaria 1"
}
```

| Campo | Tipo | Qué es |
|-------|------|--------|
| `id_foco` | string | ID del foco afectado |
| `corriente_esperada_ma` | float | Cuántos mA debería consumir ese foco |
| `corriente_medida_ma` | float | Cuántos mA está consumiendo realmente |
| `duracion_anomalia_s` | int | Hace cuántos segundos que está en ese estado raro |
| `estado_circuito` | string | `"ACTIVO"` o `"INACTIVO"` |

> Criterio: si `corriente_medida_ma < corriente_esperada_ma * 0.2` y `duracion_anomalia_s >= 10` y `estado_circuito = "ACTIVO"` → foco quemado.

---

### 3.4 Respuestas de nuestra API

Cuando todo va bien:
```json
{
  "status": "ok",
  "id_alerta": "ALR-20250610-0042",
  "mensaje": "Evento registrado."
}
```

Cuando falta algo en el JSON:
```json
{
  "status": "error",
  "codigo": 422,
  "mensaje": "Campo 'id_tablero' ausente en el payload."
}
```

---

## 4. Roadmap — Qué hace el equipo EPET 20 ahora

### Paso 1 — Armar el `docker-compose.yml`

Crear la estructura base del proyecto y el archivo de Docker Compose que levanta la API y la base de datos juntas:

```
proyecto-alertas/
├── docker-compose.yml
├── api/
│   ├── Dockerfile
│   ├── main.py          ← si usan FastAPI
│   └── requirements.txt
└── .env
```

El `docker-compose.yml` mínimo:

```yaml
version: "3.9"

services:
  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: epet20
      POSTGRES_PASSWORD: epet20pass
      POSTGRES_DB: alertas_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./api
    restart: always
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://epet20:epet20pass@db:5432/alertas_db
    depends_on:
      - db

volumes:
  postgres_data:
```

Con esto, `docker-compose up -d` levanta PostgreSQL y la API juntos. Todos en el equipo trabajan sobre lo mismo.

---

### Paso 2 — Crear la base de datos

El schema inicial que necesitamos. Se puede aplicar directo en psql o con una migración:

```sql
-- Tableros registrados en el sistema
CREATE TABLE tableros (
  id          VARCHAR(20) PRIMARY KEY,
  ubicacion   TEXT NOT NULL,
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Todos los eventos/alertas que llegan del hardware
CREATE TABLE alertas (
  id            SERIAL PRIMARY KEY,
  id_tablero    VARCHAR(20) REFERENCES tableros(id),
  tipo_evento   VARCHAR(50)  NOT NULL,  -- BAJA_TENSION | DESCONEXION_ABRUPTA_FOCO | FOCO_QUEMADO
  severidad     VARCHAR(20)  NOT NULL,  -- CRITICA | ADVERTENCIA | INFO
  payload_raw   JSONB,                  -- guardamos el JSON completo por si acaso
  ubicacion     TEXT,
  resuelta      BOOLEAN DEFAULT FALSE,
  vista         BOOLEAN DEFAULT FALSE,
  creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dato inicial para pruebas
INSERT INTO tableros (id, ubicacion) VALUES ('TABLERO_01', 'Aula Taller 3 - Planta Baja');
```

---

### Paso 3 — Primer endpoint funcional (`POST /api/evento`)

El objetivo de este paso es tener el endpoint respondiendo antes de que la EPET 14 esté lista. Así podemos probar todo con `curl` o Postman.

**Con FastAPI (Python):**

```python
# api/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any
import psycopg2, os, json
from datetime import datetime

app = FastAPI()
DB_URL = os.getenv("DATABASE_URL")

class Evento(BaseModel):
    tipo_evento: str
    id_tablero: str
    timestamp: str
    datos: dict[str, Any]
    severidad: str
    ubicacion: str

@app.post("/api/evento")
def recibir_evento(evento: Evento):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO alertas (id_tablero, tipo_evento, severidad, payload_raw, ubicacion)
           VALUES (%s, %s, %s, %s, %s) RETURNING id""",
        (evento.id_tablero, evento.tipo_evento, evento.severidad,
         json.dumps(evento.dict()), evento.ubicacion)
    )
    id_alerta = cur.fetchone()[0]
    conn.commit()
    cur.close(); conn.close()
    return {"status": "ok", "id_alerta": f"ALR-{id_alerta}"}

@app.get("/api/alertas")
def listar_alertas():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT id, tipo_evento, severidad, ubicacion, creado_en FROM alertas ORDER BY creado_en DESC LIMIT 50")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{"id": r[0], "tipo": r[1], "severidad": r[2], "ubicacion": r[3], "cuando": str(r[4])} for r in rows]
```

Una vez que esto funciona, la documentación automática de la API está disponible en `http://localhost:8000/docs`.

---

### Paso 4 — Script de prueba (para no esperar a la EPET 14)

Mientras ellos terminan con el hardware, nosotros podemos simular los tres eventos con un script de Python o directamente con `curl`:

```bash
# Probar baja tensión con curl
curl -X POST http://localhost:8000/api/evento \
  -H "Content-Type: application/json" \
  -d '{
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
    "ubicacion": "Aula Taller 3 - Planta Baja"
  }'
```

O con un script Python si prefieren:

```python
# mock_hardware.py — simula los tres eventos
import requests, json

BASE_URL = "http://localhost:8000/api/evento"

eventos = [
    {
        "tipo_evento": "BAJA_TENSION",
        "id_tablero": "TABLERO_01",
        "timestamp": "2025-06-10T14:32:05Z",
        "datos": {"tension_medida_v": 185.3, "tension_nominal_v": 220.0, "umbral_minimo_v": 190.0, "fase": "L1"},
        "severidad": "CRITICA",
        "ubicacion": "Aula Taller 3 - Planta Baja"
    },
    {
        "tipo_evento": "DESCONEXION_ABRUPTA_FOCO",
        "id_tablero": "TABLERO_01",
        "timestamp": "2025-06-10T15:10:22Z",
        "datos": {"id_foco": "FOCO_A3", "corriente_previa_ma": 450.0, "corriente_actual_ma": 0.0, "tiempo_caida_ms": 85, "estado_circuito": "ACTIVO"},
        "severidad": "CRITICA",
        "ubicacion": "Pasillo Principal - Luminaria 3"
    },
    {
        "tipo_evento": "FOCO_QUEMADO",
        "id_tablero": "TABLERO_01",
        "timestamp": "2025-06-10T16:45:00Z",
        "datos": {"id_foco": "FOCO_B1", "corriente_esperada_ma": 450.0, "corriente_medida_ma": 12.5, "duracion_anomalia_s": 30, "estado_circuito": "ACTIVO"},
        "severidad": "ADVERTENCIA",
        "ubicacion": "Laboratorio de Electrónica - Luminaria 1"
    }
]

for e in eventos:
    r = requests.post(BASE_URL, json=e)
    print(f"{e['tipo_evento']} → {r.json()}")
```

Si los tres eventos aparecen en `GET /api/alertas`, el backend está listo para conectarse con la EPET 14.

---

## Pendientes y preguntas para la EPET 14

- [ ] ¿Qué micro están usando? (ESP32, Arduino Mega + módulo WiFi, otro) → necesitamos saber esto para darles el código de ejemplo del POST en C++.
- [ ] ¿Cuántos focos tiene el tablero? → para definir el rango de IDs (`FOCO_A1`, `FOCO_A2`, etc.).
- [ ] ¿La red es monofásica o trifásica? → para el campo `fase`.
- [ ] ¿El sistema va a funcionar en red local (sin internet) o necesita salir a internet?
- [ ] ¿Tienen IP fija para el servidor o necesitamos algo como ngrok para las pruebas?

---

## Glosario rápido

| Término | Qué es |
|---------|--------|
| **API REST** | Sistema para comunicarse entre aplicaciones usando HTTP. Nosotros exponemos endpoints, el micro los llama. |
| **Endpoint** | Una URL específica de nuestra API que acepta requests (ej: `/api/evento`). |
| **JSON** | Formato de texto para intercambiar datos. Es lo que manda la EPET 14 y lo que nosotros procesamos. |
| **Docker** | Herramienta para empaquetar aplicaciones en contenedores. Garantiza que el entorno sea igual en todas las PCs. |
| **Docker Compose** | Herramienta para levantar varios contenedores juntos con un solo comando. |
| **PostgreSQL** | Base de datos relacional donde guardamos todas las alertas. |
| **FastAPI** | Framework de Python para crear APIs rápido. Genera documentación automática en `/docs`. |

---

*Equipo de Software — EPET 20 · Draft v0.2 · Sujeto a revisión conjunta con EPET 14*
