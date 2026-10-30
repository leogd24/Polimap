# Consejales (dueto por grupo), avisos para consejales y editor de avisos

Responsable: Alexis.

**Antes de probar:** phpMyAdmin → tu base → SQL → `sql/migracion-consejales-avisos.sql`
(requiere `sql/migracion-calendario.sql`). Hace dos cosas:
- cambia el rol "jefe" a "subconsejal";
- agrega `avisos.audiencia`.

## Usuarios y consejales (panel)

- Las secciones "Usuarios admin" y "Consejales de grupo" ahora son una sola:
  **Usuarios y consejales** (`src/admin/AccessSection.jsx`), con el diseño de credenciales.
- En la banda azul, "Designar correo como" tiene la opción nueva **Consejal**: escribes
  el correo `@alumnos.udg.mx`, eliges el grupo y el puesto (Consejal o Subconsejal).
- Cada grupo tiene un **dueto**: un consejal y un subconsejal.
  - Si ese lugar ya está ocupado, el panel pregunta si quieres reemplazar a esa persona.
  - Un alumno solo puede estar en un lugar; si ya estaba en otro grupo, se mueve.
- **Consejales por grupo**: una tarjeta por grupo con sus dos lugares.
  - Si un lugar está vacío, sale "+ Designar", que llena el formulario.
  - "Ver los 83 grupos" muestra también los grupos sin nadie.
- La cuenta maestra ve todo. Los demás admins solo ven y designan consejales.
- API: `api/calendario.php` (asignar con `reemplazar`; 409 si el lugar está ocupado).

## Avisos solo para consejales

- En el editor, **¿Quién lo ve?**: Todos · Consejales y subconsejales · Solo consejales.
  - "Ver a quién le llega" muestra la lista por grupo.
- Nadie más ve esos avisos, ni sus comentarios ni abriéndolos por `?aviso=` (`api/audiencia.php`).
- La notificación les llega solo a ellos.
- En la app salen marcados "Para consejales" / "Solo consejales".

## Editor de avisos estilo Google Forms

`src/admin/NoticeEditor.jsx`:
- Franja de color del tipo y título grande con línea.
- Texto que crece solo.
- Chips para el tipo y para quién lo ve, y fechas con su etiqueta.
- Encuesta como Google Forms (`PollEditor.jsx`).
- Opciones con interruptores y Publicar abajo.

Además:
- Se quitó el recuadro azul por dentro de los campos: ahora el campo completo marca el
  borde al escribir (`.campo` en `global.css`).
- Campos nuevos en `Inputs.jsx`: `LineField` y `ChoiceChip`.

## Apariencia en el panel

- Botón en el menú (y arriba en celular) que abre la **misma hoja de la app**: tema
  automático/claro/oscuro, tamaño de letra, alto contraste y menos movimiento.
- Es el mismo ajuste que el de la app: si lo cambias en un lado, cambia en el otro.

## Pruebas

- API: 19 pruebas nuevas (dueto, reemplazar, mover, quién ve cada aviso, comentarios y
  `?id=`), más las anteriores: todas bien.
- Panel en claro, oscuro y alto contraste: 0 problemas de contraste.
