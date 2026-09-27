# POLIMAP — Contrato de datos v1

Responsable: Alexis · 26 sep 2026 · Estado: **propuesta, falta confirmar con Katia y Marcos**

Este documento define **qué tablas hay en MySQL** y **qué JSON regresa cada endpoint de la API**.
Regla de oro: la API regresa **los mismos nombres de campo que ya usan los archivos de `src/data/`**, así nadie cambia su pantalla cuando conectemos el backend. Solo cambia el origen de los datos en `src/lib/api.js`.

---

## 1. Reglas generales

| Regla | Valor |
|---|---|
| Motor | MySQL 8, `utf8mb4` / `utf8mb4_unicode_ci` (acentos y ñ) |
| Llave de edificio | `number` (entero 1–10), igual que `campusBuildings.js`. **No se cambia nunca.** |
| Nombres en la BD | español, `snake_case` (`edificio_number`, `creado_en`) |
| Nombres en el JSON | los de `src/data/*.js` (inglés, `camelCase`) — la API hace la traducción |
| Colores | se guarda la **clave** de `theme.js` (`"blue"`, `"crimson"`…), nunca un hex; `api.js` la convierte con `colors[clave]` |
| Fechas | ISO 8601 en el JSON: `"2026-10-05T10:30:00"` |
| Respuesta de error | `{ "ok": false, "error": "mensaje en español" }` con código HTTP 400/404/500 |
| Base de la API | local: `http://localhost/polimap/api/` · desde React: `/api/...` (proxy de Vite) |

---

## 2. Tablas (7)

### `edificios`
| Columna | Tipo | Nota |
|---|---|---|
| number | TINYINT UNSIGNED **PK** | 1–10 |
| name | VARCHAR(100) NOT NULL | |
| summary | VARCHAR(200) | |
| description | TEXT | |
| hours | VARCHAR(150) | vacío = "Sin información" |
| accessibility | VARCHAR(255) | |
| icon | VARCHAR(50) | nombre de Material Symbols |
| color | VARCHAR(30) | clave de `theme.js` |
| lat, lng | DECIMAL(9,6) NULL | los llena Marcos |
| entrance_lat, entrance_lng | DECIMAL(9,6) NULL | puerta principal (opcional) |
| foto | VARCHAR(255) NULL | ruta, ej. `img/edificios/1.jpg` |

### `espacios`
| Columna | Tipo | Nota |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| edificio_number | TINYINT UNSIGNED **FK → edificios** ON DELETE CASCADE | |
| nombre | VARCHAR(120) NOT NULL | |
| orden | SMALLINT DEFAULT 0 | para respetar el orden actual |

### `servicios`
Igual que `espacios` (id, edificio_number FK, nombre, orden).

### `tramites`
| Columna | Tipo | Nota |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| edificio_number | TINYINT UNSIGNED **FK → edificios** ON DELETE CASCADE | |
| nombre | VARCHAR(150) NOT NULL | → `name` en JSON |
| detalles | TEXT | → `details` en JSON |
| orden | SMALLINT DEFAULT 0 | |

### `faq`
| Columna | Tipo | Nota |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| pregunta | VARCHAR(255) NOT NULL | → `question` |
| respuesta | TEXT NOT NULL | → `answer` (sin número de edificio escrito a mano) |
| palabras_clave | VARCHAR(500) | separadas por coma → `keywords` (arreglo) |
| categoria | ENUM('tramites','ubicaciones','servicios','horarios') | → `category` |
| edificio_number | TINYINT UNSIGNED NULL **FK → edificios** ON DELETE SET NULL | → `buildingNumber` |
| icon | VARCHAR(50) | |
| activo | TINYINT(1) DEFAULT 1 | |

### `reportes`
| Columna | Tipo | Nota |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| folio | CHAR(14) UNIQUE | `POLI-2026-0001`, **lo genera el servidor** |
| categoria | ENUM('basura','mobiliario','banos','fuga','iluminacion','riesgo','otro') | |
| edificio_number | TINYINT UNSIGNED NULL **FK → edificios** ON DELETE SET NULL | si eligió un edificio |
| zona | VARCHAR(100) NULL | si eligió "Explanada" u "Otra zona" |
| descripcion | VARCHAR(500) NOT NULL | mínimo 10 caracteres (igual que el formulario) |
| foto | VARCHAR(255) NULL | nombre aleatorio en `api/uploads/` |
| lat, lng | DECIMAL(9,6) NULL | GPS del navegador |
| precision_m | SMALLINT NULL | `accuracy` de la geolocalización |
| anonimo | TINYINT(1) DEFAULT 1 | |
| estado | ENUM('recibido','revision','proceso','resuelto') DEFAULT 'recibido' | |
| comentario_admin | VARCHAR(500) NULL | |
| creado_en | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| actualizado_en | DATETIME ON UPDATE CURRENT_TIMESTAMP | |

Regla: el reporte necesita **`edificio_number` o `zona`** (lo que hoy es el campo "Ubicación"). GPS es opcional.

### `avisos`
| Columna | Tipo |
|---|---|
| id | INT AUTO_INCREMENT PK |
| titulo | VARCHAR(150) NOT NULL |
| contenido | TEXT |
| tipo | ENUM('general','urgente','evento') DEFAULT 'general' |
| fecha_inicio, fecha_fin | DATE |

### `usuarios_admin`
| Columna | Tipo |
|---|---|
| id | INT AUTO_INCREMENT PK |
| usuario | VARCHAR(50) UNIQUE |
| password_hash | VARCHAR(255) (`password_hash()` de PHP) |
| nombre | VARCHAR(100) |

**Relaciones:** un edificio tiene muchos espacios, servicios, trámites, preguntas FAQ y reportes. FAQ y reportes pueden no tener edificio (NULL).

Los **horarios** (`src/data/schedules/`) **no van a la BD**: salen del PDF oficial 2026B y no cambian en el semestre.

---

## 3. Endpoints y JSON

### `GET /api/edificios.php` → Marcos, Gabo
Regresa el arreglo con la **misma forma que `campusBuildings.js`** + coordenadas:
```json
[
  {
    "number": 1,
    "name": "Atención a alumnos",
    "summary": "Trámites escolares, PLEX y Coordinación",
    "description": "Aquí se atiende a los alumnos…",
    "services": ["Constancias", "Kardex", "PLEX"],
    "spaces": ["Atención a alumnos", "Oficinas de PLEX", "Coordinación"],
    "hours": "",
    "accessibility": "",
    "icon": "support_agent",
    "color": "blue",
    "lat": 20.746517,
    "lng": -103.379771,
    "entrance": { "lat": 20.74640, "lng": -103.37970 },
    "photo": "img/edificios/1.jpg",
    "procedures": [
      { "name": "Kardex", "details": "Presenta tu código de alumno." }
    ]
  }
]
```
`GET /api/edificios.php?number=1` → un solo objeto (404 si no existe).

### `GET /api/faq.php` → Gabo
```json
[
  {
    "id": 1,
    "question": "¿Dónde saco mi kardex?",
    "answer": "Ahí puedes solicitar kardex y constancias con tu código de alumno.",
    "keywords": ["kardex", "kárdex", "historial", "calificaciones"],
    "category": "tramites",
    "buildingNumber": 1,
    "icon": "description"
  }
]
```

### `POST /api/reportes.php` → Katia
Se envía como **`FormData`** (por la foto):

| Campo | Obligatorio | Ejemplo |
|---|---|---|
| categoria | sí | `banos` |
| descripcion | sí (≥10 caracteres) | `El lavabo del baño de hombres gotea` |
| edificio_number | uno de los dos | `3` |
| zona | uno de los dos | `Explanada` |
| anonimo | no (default 1) | `1` |
| foto | no | archivo jpg/png/webp, máx 2 MB (comprimir antes) |
| lat, lng, precision_m | no | `20.7466`, `-103.3797`, `15` |

Respuesta **201**:
```json
{ "ok": true, "folio": "POLI-2026-0001", "estado": "recibido", "createdAt": "2026-10-05T10:30:00" }
```

**Tabla de categorías** (lo que ve el usuario → lo que se envía):

| Formulario | Se envía |
|---|---|
| Basura | `basura` |
| Mobiliario dañado | `mobiliario` |
| Baños en mal estado | `banos` |
| Fuga de agua | `fuga` |
| Iluminación | `iluminacion` |
| Riesgo o desperfecto | `riesgo` |
| Otro | `otro` |

### `GET /api/reportes.php` → Katia ("Mis reportes" / panel admin)
Sin `?folios=` regresa **todos** y exige el encabezado `X-Admin-Token` (clave de `api/config.php`).
`?folios=POLI-2026-0001,POLI-2026-0002` para "Mis reportes" (los folios se guardan en `localStorage` del celular).
```json
[
  {
    "folio": "POLI-2026-0001",
    "categoria": "banos",
    "edificioNumber": 3,
    "zona": null,
    "descripcion": "El lavabo del baño de hombres gotea",
    "foto": "/api/uploads/a8f3c2e1.jpg",
    "lat": 20.7466, "lng": -103.3797,
    "estado": "recibido",
    "comentarioAdmin": null,
    "createdAt": "2026-10-05T10:30:00",
    "updatedAt": null
  }
]
```

### `PATCH /api/reportes.php` → panel admin (Avance 2, exige `X-Admin-Token`)
JSON `{ "folio": "POLI-2026-0001", "estado": "proceso", "comentarioAdmin": "Ya se avisó a mantenimiento" }` → `{ "ok": true }`

### `GET /api/avisos.php` → Leo
```json
[
  { "id": 1, "title": "Suspensión de clases", "content": "…", "type": "urgente", "startDate": "2026-10-10", "endDate": "2026-10-10" }
]
```
Solo regresa avisos vigentes (hoy entre `fecha_inicio` y `fecha_fin`), urgentes primero.

---

## 4. Funciones de `src/lib/api.js` (lo único que importan las pantallas)

| Función | Regresa | Respaldo si la API no responde |
|---|---|---|
| `getBuildings()` | arreglo de edificios | `campusBuildings` de `src/data/` |
| `getFaq()` | arreglo de preguntas | `faqEntries` de `src/data/` |
| `createReport(formData)` | `{ ok, folio, estado }` | guarda en `localStorage` y genera folio local |
| `getReports(folios)` | arreglo de reportes | lo guardado en `localStorage` |
| `getNotices()` | arreglo de avisos | `src/data/notices.js` |

---

## 5. Pendientes por confirmar

- [ ] **Katia:** nombres de campos del reporte y la tabla de categorías (sección 3).
- [ ] **Marcos:** los edificios se identifican por `number`; coordenadas en `lat`, `lng` y `entrance`.
- [ ] **Gabo:** dónde se tramita el kardex y dónde está PLEX (el FAQ dice edificios 6 y 8, `campusBuildings.js` dice edificio 1). Hasta confirmarlo no se cargan esas respuestas.
- [ ] **Leo:** campos de avisos (`title`, `content`, `type`, `startDate`, `endDate`).
