# POLIMAP — Panel de reportes (admin)

Responsable: Alexis. Dirección: **https://polimap.ct.ws/admin.html** (no aparece en el menú de la app).

## Qué hace
- Entrada con la clave de administrador (`admin_token` de `api/config.php` del servidor).
- Contadores por estado: Todos, Recibido, En revisión, En proceso, Resuelto (también filtran).
- Búsqueda por folio, descripción o lugar, y filtro por categoría.
- Detalle del reporte: foto, ubicación, fecha, enlace al mapa si trae GPS.
- Cambiar estado y dejar un comentario para el equipo.

## Archivos
| Archivo | Para qué |
|---|---|
| `admin.html` | Segunda página de Vite (no registra el service worker) |
| `src/admin/main.jsx` | Arranca el panel |
| `src/admin/AdminApp.jsx` | Entrada, encabezado, contadores, filtros y lista |
| `src/admin/ReportDetail.jsx` | Ventana de detalle y cambio de estado |
| `src/admin/StateChip.jsx` | Etiqueta de color del estado |
| `src/admin/reportMeta.js` | Nombres, íconos y colores de categorías y estados |
| `src/lib/api.js` | Nuevas funciones `getAllReports()` y `updateReport()` |
| `api/reportes.php` | Acepta `POST ?_method=PATCH` (algunos hostings bloquean PATCH) |
| `vite.config.js` | `build.rollupOptions.input` con `index.html` y `admin.html` |
| `public/sw.js` | Ya no guarda en caché `/api/` (antes mostraba datos viejos) |

## Cómo probar
1. Local: XAMPP encendido + `npm run dev` → http://localhost:5173/admin.html (clave = `admin_token` de tu `config.php` local).
2. Publicado: `npm run build` → subir el **contenido** de `dist/` a `htdocs` (ahora incluye `admin.html`) y el `api/reportes.php` nuevo a `htdocs/api`.
3. Entra a https://polimap.ct.ws/admin.html, cambia un reporte a "En proceso" y revisa en phpMyAdmin que la columna `estado` cambió.

## Pendiente (Avance 2)
Cambiar la clave única por usuario y contraseña con la tabla `usuarios_admin`.
