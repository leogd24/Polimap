# POLIMAP — Panel de administración v2

Responsable: Alexis. Dirección: **https://polimap.ct.ws/admin.html** (no aparece en el menú de la app; los admins lo abren desde su foto → "Abrir panel de administración").

Entrada: correo designado + contraseña, o Google con `@academicos.udg.mx` designado. Ver `docs/login.md`.

## Las 11 mejoras

| # | Mejora | Dónde |
|---|---|---|
| 1 | Buscador (folio, texto, edificio, alumno) y filtros por estado, categoría, edificio, prioridad y fechas | `ui.jsx` (FilterBar), `reportMeta.js` (applyFilters) |
| 2 | Se actualiza solo cada 30 s, marca los NUEVOS, "(3) Panel POLIMAP" en la pestaña y sonido opcional | `AdminApp.jsx` |
| 3 | Exportar a Excel (CSV con acentos correctos) | `reportMeta.js` (downloadCsv) |
| 4 | Tarjetas: sin atender, en revisión, en proceso, resueltos del mes, tiempo promedio de solución | `DashboardSection.jsx` |
| 5 | Mapa de calor del campus en el Tablero (el Poli dibujado a partir de OpenStreetMap, últimos 30 días; tocar un edificio filtra) y mapa real con color por estado | `CampusHeatCard.jsx`, `MapSection.jsx` (Leaflet, se descarga solo al abrirlo) |
| 6 | Gráficas: estado, reportes por semana, por categoría, por lugar y tiempo de solución | `StatsSection.jsx` |
| 7 | Tablero Kanban: arrastrar una tarjeta cambia el estado | `KanbanBoard.jsx` |
| 8 | Prioridad: fuga y riesgo entran como urgentes; el admin la cambia | `api/reportes.php`, `ReportDetail.jsx` |
| 9 | Avisos de la app: crear, editar y borrar | `NoticesSection.jsx`, `api/avisos.php` |
| 10 | Historial: quién cambió qué y cuándo | `HistorySection.jsx`, tabla `reportes_historial` |
| 11 | Usuarios admin reales: correos designados, cada uno con su contraseña | `AccessSection.jsx`, `AdminLogin.jsx`, `api/auth.php`, `api/accesos.php` |

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

## Cómo probar
1. Local: XAMPP + `npm run dev` → http://localhost:5173/admin.html. Con `'modo_dev_login' => true` el código sale en pantalla.
2. Arrastra un reporte de "Recibido" a "En proceso" → en phpMyAdmin cambia `estado` y aparece una fila en `reportes_historial`.
3. Exportar Excel → se abre en Excel con acentos bien.
4. Avisos → crea uno con fecha de hoy → aparece en Inicio de la app.
