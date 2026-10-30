# Base de datos de POLIMAP (optimizada, 24 tablas)

Responsable: Alexis. Todo está en **un solo archivo: `sql/polimap.sql`**. Trae las tablas,
sus llaves primarias y foráneas, y los datos iniciales.

## Archivo

**`sql/polimap.sql`** es lo único que hay que importar. En localhost/phpmyadmin, desde la
página principal (sin elegir base): **Importar** → `sql/polimap.sql` → **Importar**.

- Crea la base `polimap` si no existe y borra sus tablas para crearlas de nuevo (sin
  `DROP DATABASE`, que phpMyAdmin tiene desactivado). **Se pierden los datos.**
- Crea las 24 tablas con sus llaves primarias y foráneas.
- Carga los datos iniciales: edificios, FAQ, aviso de bienvenida y cuenta maestra.
- Al final acomoda las tablas en el **Diseñador**: base polimap → Diseñador → Abrir
  página → POLIMAP. Si tu phpMyAdmin no tiene la base `phpmyadmin`, esa última parte marca
  error, pero las tablas y los datos ya quedaron.

Las migraciones viejas ya no hacen falta (siguen en el historial de Git).

## Qué se optimizó (la app funciona igual)

| Antes (31 tablas) | Ahora (24) |
|---|---|
| `espacios`, `servicios`, `tramites` | `edificio_info` con columna `tipo` (espacio · servicio · tramite) |
| `avisos_fotos`, `avisos_archivos` | `avisos_adjuntos` con columna `tipo` (foto · archivo) |
| `avisos_encuestas` | columnas `encuesta`, `encuesta_multiple` y `encuesta_cierra` en `avisos` |
| `comentarios_silenciados` | columnas `silenciado_hasta/_motivo/_por/_en` en `usuarios` |
| `comentarios_reportes`, `perdidos_reportes` | `denuncias` (`comentario_id` **o** `perdido_id`) |

También se hizo lo siguiente:

- **Llaves foráneas nuevas:** `avisos.autor_id`, `perdidos.edificio_number`, `moderacion_log.aviso_id`, `avisos_votos.aviso_id` y `grupo_consejales.asignado_por`. Así el Diseñador dibuja todas las relaciones.
- **Índices:** se agregaron los que usan Avisos e Historial y se quitaron los repetidos.
- **Juego de caracteres:** todas las tablas en `utf8mb4_unicode_ci`.

Se probó con la API completa: 72 llamadas dieron **exactamente** las mismas respuestas antes y
después. Una base vieja con datos, después de la migración, también respondió igual.

## Tablas y relaciones

```
CAMPUS        edificios ─┬─< edificio_info
                         ├─< faq                (edificio opcional)
                         ├─< reportes           (edificio opcional)
                         └─< perdidos           (edificio opcional)

CUENTAS       usuarios ──┬─< sesiones
                         ├─< reportes, reportes_historial, reportes_apoyos
                         ├─< avisos (autor), avisos_likes, avisos_comentarios, avisos_votos
                         ├─< denuncias, moderacion_log, perdidos
                         ├─< bitacora, push_suscripciones
                         └─< grupo_consejales (quién designó), grupo_fechas, grupo_encuadres
              accesos, codigos_acceso   (por correo: la persona puede no haber entrado aún)

REPORTES      reportes ──┬─< reportes_historial
                         └─< reportes_apoyos

AVISOS        avisos ────┬─< avisos_adjuntos
                         ├─< avisos_likes
                         ├─< avisos_comentarios ──┬─< avisos_comentarios (respuestas)
                         │                        └─< denuncias
                         ├─< avisos_opciones ─────< avisos_votos
                         ├─< avisos_votos
                         └─< moderacion_log

PERDIDOS      perdidos ──< denuncias

GRUPOS        grupo_consejales · grupo_fechas · grupo_encuadres   (por código de grupo, ej. "1AM TIN")
```

Borrar un aviso borra sus fotos, archivos, me gusta, comentarios, encuesta y votos
(`ON DELETE CASCADE`). Borrar una cuenta deja los reportes y la bitácora sin autor
(`SET NULL`).

## Cómo probar

1. localhost/phpmyadmin → Importar → `sql/polimap.sql`.
2. Base `polimap` → **Diseñador** → Abrir página → POLIMAP: las 24 tablas con sus líneas.
3. `npm run dev`: la app y el panel funcionan igual que antes.
