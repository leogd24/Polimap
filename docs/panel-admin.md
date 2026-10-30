# POLIMAP — Panel de administración v2

Responsable: Alexis. Dirección: **https://polimap.ct.ws/admin.html** (no aparece en el menú de la app; los admins lo abren desde su foto → "Abrir panel de administración").

Entrada: correo designado + contraseña, o Google con `@academicos.udg.mx` designado. Ver `docs/login.md`.

## Las 11 mejoras

| # | Mejora | Dónde |
|---|---|---|
| 1 | Buscador (folio, texto, edificio, alumno) y filtros por estado, categoría, edificio, prioridad y fechas | `ui.jsx` (FilterBar), `reportMeta.js` (applyFilters) |
| 2 | Se actualiza solo cada 30 s, marca los NUEVOS, "(3) Panel POLIMAP" en la pestaña y sonido opcional | `AdminApp.jsx` |
| 3 | Exportar a Excel (.xlsx real), en **Estadísticas → Descargar en Excel**: periodo (todo, 7 días, 30 días, este mes) y con o sin resueltos. Hojas: Resumen con 6 indicadores y 4 gráficas nativas; Reportes (con la columna Salón); Horarios (mapa de calor día × hora y salones con más reportes); Notas. Respeta los filtros del panel | `ExportCard.jsx`, `excelExport.js` |
| 4 | Tarjetas: sin atender, en revisión, en proceso, resueltos del mes, tiempo promedio de solución | `DashboardSection.jsx` |
| 5 | Mapa de calor del campus en el Tablero (el Poli dibujado a partir de OpenStreetMap, últimos 30 días; tocar un edificio filtra) y **Mapa de reportes con el mapa 3D de Marcos**: un punto por salón (color = prioridad, tamaño = cuántos, late si es urgente o 3+). Tocar un edificio abre su **esquema** con los salones de cada piso | `CampusHeatCard.jsx`, `MapSection.jsx`, `BuildingSchematic.jsx`, `reportDots.js`, `src/data/buildingLayouts.js` |
| 6 | Estadísticas: tarjetas de resumen, dona de estados, nuevos vs resueltos por semana, mapa de calor día × hora, por categoría, por edificio y tiempo de solución (tooltip y "Ver datos" en cada una) | `StatsSection.jsx` |
| 7 | Tablero Kanban: arrastrar una tarjeta cambia el estado | `KanbanBoard.jsx` |
| 8 | Prioridad: fuga y riesgo entran como urgentes; el admin la cambia | `api/reportes.php`, `ReportDetail.jsx` |
| 9 | Avisos de la app como **posts** (hasta 5 fotos, fijar arriba, permitir comentarios, me gusta): crear, editar, borrar y **mandarlos como notificación al celular** | `NoticesSection.jsx`, `api/avisos.php`, `api/push.php`, `api/webpush.php` |
| 12 | **Comentarios**: lo reportado por alumnos, lo que bloqueó el filtro, recientes y cuentas en pausa | `ModerationSection.jsx`, `api/comentarios.php`, `api/moderacion.php` |
| 10 | Historial de TODO el panel (reportes, avisos, comentarios, accesos y entradas) con resumen, filtros por tipo/persona/fechas, búsqueda y CSV | `HistorySection.jsx`, `api/historial.php`, `api/bitacora.php`, tablas `reportes_historial` y `bitacora` (`sql/migracion-bitacora.sql`) |
| 11 | Usuarios admin: tarjetas por admin (última entrada, cambios de la semana, nota editable), invitación por correo, restablecer contraseña, desbloquear, "Ver su historial" y lista de personas que han entrado | `AccessSection.jsx`, `AdminLogin.jsx`, `api/auth.php`, `api/accesos.php` |

## Archivos
| Archivo | Para qué |
|---|---|
| `src/admin/AdminApp.jsx` | Sesión, recarga cada 30 s, menú y secciones |
| `src/admin/AdminLogin.jsx` | Entrada: contraseña, Google o "Crear o recuperar contraseña" |
| `src/admin/Sidebar.jsx` | Menú lateral (cajón en celular) |
| `src/admin/DashboardSection.jsx`, `CampusHeatCard.jsx`, `KanbanBoard.jsx`, `ReportCard.jsx` | Tablero (mismo diseño que la propuesta aprobada) |
| `src/admin/MapSection.jsx`, `StatsSection.jsx`, `NoticesSection.jsx`, `HistorySection.jsx`, `AccessSection.jsx` | Secciones |
| `src/admin/ReportDetail.jsx` | Detalle: foto, autor (si no es anónimo), estado, prioridad, comentario e historial |
| `src/admin/ui.jsx`, `reportMeta.js` | Piezas compartidas, filtros, CSV y textos |

## Esquema de edificios
- Los salones salen solos de los **horarios 2026B** (`Aula E4-A05` → edificio 4, aula A05).
  Regla: 3er piso A01–A04, 2º piso A05–A08, luego planta baja; laboratorios y talleres son más anchos.
- Si un edificio no está como en la vida real, se corrige en `AJUSTES` de `src/data/buildingLayouts.js` (hay un ejemplo ahí).
- El alumno elige el salón en Reportar (opcional). Reportes viejos: si en la descripción dice "aula 5" o "E4-A05", también se ubican.
- Botón Día/Noche (arranca de noche después de las 7 pm).

## Cómo probar
1. Local: XAMPP + `npm run dev` → http://localhost:5173/admin.html. Con `'modo_dev_login' => true` el código sale en pantalla.
2. Arrastra un reporte de "Recibido" a "En proceso" → en phpMyAdmin cambia `estado` y aparece una fila en `reportes_historial`.
3. Estadísticas → Descargar en Excel → se abre en Excel con acentos bien y 4 hojas.
4. Avisos → crea uno con fecha de hoy → aparece en Inicio de la app.

## Bitácora del panel

Corre `sql/migracion-bitacora.sql` una vez (local y en InfinityFree). Sin esa tabla
el panel sigue funcionando, pero el Historial solo muestra los cambios de reportes.

El botón para entrar al panel desde la app ya existe: toca tu foto de perfil →
"Abrir panel de administración" (solo aparece si tu correo está en `accesos`).

