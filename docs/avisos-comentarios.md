# POLIMAP — Avisos como posts y comentarios

Responsable: Alexis (los avisos en Inicio son la sección de Leo).

## Qué ve el alumno
- **Inicio → "Avisos del Poli"**: todos los avisos vigentes como posts, uno debajo de otro; se ven bajando en Inicio.
- **Cada aviso es un post**:
  - Fotos en carrusel (hasta 5) o, si no trae fotos, un panel de color.
  - Me gusta (también con doble toque en la foto), comentarios y compartir.
  - Fijados primero, luego urgentes, luego los más nuevos.
- **Comentarios**:
  - Con nombre y foto de la cuenta UdeG.
  - Responder (un nivel, como Instagram), reportar y borrar los propios.
  - Los del equipo salen con la etiqueta "POLIMAP".
- **Invitados y familias**: ven todo, pero para dar me gusta o comentar tienen que entrar con su cuenta @alumnos.udg.mx.
- **Desde una notificación** (`/?aviso=12`): Inicio baja hasta ese aviso y lo marca en dorado.

## Cuidar el ambiente institucional
| Capa | Qué hace | Dónde |
|---|---|---|
| Cuenta real | Solo @alumnos.udg.mx (y admins) comentan, con su nombre | `api/comentarios.php` |
| Filtro automático | Bloquea groserías (también "p3nd3jo", "p.u.t.o", "ptm"), amenazas, teléfonos, correos y enlaces que no sean de udg.mx | `api/moderacion.php` |
| Pausa automática | 3 comentarios bloqueados en 24 h = esa cuenta no comenta por 24 h | `moderacion_log` |
| Límites | 4 comentarios por minuto, 60 por día, sin repetir el mismo texto | `api/comentarios.php` |
| Reportes | Cualquier alumno reporta con un motivo; con 3 reportes se oculta solo | `comentarios_reportes` |
| Panel → Comentarios | Por revisar, Bloqueados por el filtro, Recientes y Pausados; ocultar, borrar o pausar una cuenta 1, 7 o 30 días | `ModerationSection.jsx` |
| Por aviso | El admin puede cerrar los comentarios de un aviso | "Permitir comentarios" |

**Agregar una palabra al filtro:** en `api/moderacion.php`, ponla en minúsculas y sin acentos.
- En `PALABRAS_EXACTAS` va como palabra completa.
- En `RAICES_PROHIBIDAS` bloquea todo lo que empiece así.
- Pruébala antes con frases normales para no bloquear palabras buenas: por ejemplo, "computadora" contiene "puta".

## Panel (admin)
- **Avisos de la app → Nuevo aviso**:
  - Hasta 5 fotos: se achican solas antes de subirse y la primera es la portada.
  - "Fijar arriba", "Permitir comentarios" y "Mandar notificación".
- **Cada tarjeta de aviso** dice:
  - cuántos me gusta y comentarios tiene;
  - cuántos comentarios están "por revisar", con un botón que lleva a Comentarios.
- **El menú "Comentarios"** muestra en rojo cuántos hay por revisar (se revisa cada minuto).

## Archivos
| Archivo | Para qué |
|---|---|
| `sql/migracion-avisos-social.sql` | Columnas nuevas de `avisos` y las 6 tablas |
| `api/avisos.php` | Avisos con fotos, me gusta y fijados; `?accion=foto` sube una foto (admin) |
| `api/comentarios.php` | Listar, comentar, reportar, borrar y moderación |
| `api/moderacion.php` | El filtro de texto |
| `src/components/PostCard.jsx` | El aviso como post |
| `src/components/CommentsSheet.jsx` | La hoja de comentarios |
| `src/hooks/useNoticesFeed.js` | Lista de avisos y me gusta |
| `src/admin/PhotoPicker.jsx`, `NoticesSection.jsx` | Fotos y opciones del aviso en el panel |
| `src/admin/ModerationSection.jsx` | Sección Comentarios del panel |

Las fotos se guardan en `api/uploads/avisos/`. La publicación automática no toca esa carpeta, así que no se borran.

## Cómo probar
1. Corre `sql/migracion-avisos-social.sql` en phpMyAdmin (en XAMPP y en InfinityFree).
2. Abre `/api/auth.php?diagnostico=1`: debe salir `"tablasComentarios": true`.
3. En el panel, crea un aviso con 2 fotos y "Fijar arriba". En la app, en Inicio, sale primero con su carrusel.
4. Entra a la app con un correo @alumnos.udg.mx y prueba:
   - dar me gusta;
   - comentar "¿a qué hora es?";
   - responder;
   - escribir "qué pinche feria": debe bloquearse con el mensaje.
5. Con otra cuenta, reporta un comentario. En el panel → Comentarios aparece en "Por revisar".

## Archivos adjuntos (PDF, Word, Excel, PowerPoint)

- Corre `sql/migracion-avisos-archivos.sql` una vez (local y en InfinityFree).
- En el panel → Avisos → "Adjuntar archivos": hasta 5 por aviso, de hasta 10 MB.
  La API revisa el contenido real (no solo la extensión) y rechaza archivos
  disfrazados y Office con macros.
- En la app, los PDF muestran la primera página y se abren en un visor
  (`src/components/PdfViewer.jsx`, con pdf.js). Word, Excel y PowerPoint se
  descargan. Todo, incluidas las fotos, tiene botón de descargar.
- Se guardan en `api/uploads/avisos/archivos/` (el despliegue automático no
  toca `uploads/`).

### Probarlo

1. `npm install` (instala pdf.js y actualiza `package-lock.json`).
2. Panel → Avisos → crea uno con un PDF y un Word.
3. En Inicio: la miniatura del PDF, "Ver" abre el visor (acercar/alejar,
   Esc para cerrar) y "Descargar" guarda el archivo con su nombre.
4. Intenta subir un `.zip` renombrado a `.pdf`: debe rechazarlo.

