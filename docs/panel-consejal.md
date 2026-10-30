# Panel de consejal, filtro en todo lo público y listas nuevas

Responsable: Alexis.

## 1. Panel de consejal (app → Horario → Más)

Solo lo ven el **consejal** y el **subconsejal** que un admin designó en el panel
(Usuarios y consejales). Los demás alumnos ya no ven "Modo consejal" ni pueden publicar
fechas.

| Pestaña | Qué hace |
|---|---|
| Resumen | El dueto, fechas de las próximas 2 semanas, avisos visibles, celulares con notificaciones y accesos rápidos |
| Avisos | Avisos **solo para su grupo**, con encuesta opcional y notificación a los celulares del grupo |
| Fechas | Exámenes y entregas: agregar, editar y borrar |
| Encuadres | Criterios y % de cada materia; el grupo los usa en Horario → Notas |
| División | Dividir al grupo por semana (antes "Modo consejal") |

En **Horario → Fechas** todos siguen viendo las fechas, pero ya sin botones para editar.

Archivos: `src/components/PanelConsejal.jsx`, `src/components/HerramientasHorario.jsx`
(tarjeta "Panel de consejal"), `src/pages/ScheduleScreen.jsx`,
`src/components/CalendarioGrupo.jsx` (prop `editar`).

### Avisos de grupo

- **Base de datos:** `avisos.audiencia = 'grupo'` y la columna `avisos.grupo` (ej. `1AM TIN`).
- **Quién los ve en Inicio:**
  - quien eligió ese grupo en Horario (la app manda `?grupo=`);
  - los consejales del grupo;
  - los admins.
  - Salen con la etiqueta "Para 1AM TIN".
- **Reglas:**
  - Duran máximo 60 días.
  - Cada consejal publica máximo 10 al día.
  - Pasan por el filtro de palabras.
- **API** (`api/avisos.php`):
  - `grupo_publicar` publica un aviso.
  - `grupo_borrar` borra uno.
  - `GET ?grupo_panel=1AM TIN` devuelve los avisos del grupo.
- **En el panel de admin** salen en Avisos como "SOLO 1AM TIN · DE SU CONSEJAL". El admin los puede editar o borrar.

## 2. Filtro en todo lo público

- **Dónde aplica:** el mismo filtro (`api/moderacion.php`) revisa:
  - comentarios;
  - **objetos perdidos**;
  - **fechas** del grupo;
  - **avisos de consejales**.
- **Reportes:** si la descripción de un reporte no pasa el filtro, en "Reportes parecidos" no se muestra a otros alumnos. El equipo que atiende el reporte sí la ve completa.
- **Pausa automática:** 3 textos bloqueados en 24 h pausan la cuenta 24 h, en todo lo público.
- **Revisión de un admin:**
  - Panel → **Comentarios → Bloqueados por el filtro**. Ahí está todo lo bloqueado, con su origen.
  - El admin lo marca como **Bien bloqueado** o **Error del filtro**. Lo marcado como error no cuenta para la pausa.
  - No hay pestaña nueva en el panel.
- **Pausar cuenta:** se elige en una ventana nueva (`src/admin/PausarDialog.jsx`):
  - 1, 7 o 30 días;
  - o **Permanente**: no vence y solo la cuenta maestra la quita.
- **Tabla:** `moderacion_log` ahora tiene las columnas `origen`, `veredicto`, `revisado_por` y `revisado_en`.

## 3. Listas con diseño propio

`SelectField` (`src/components/Inputs.jsx`) ya no usa la lista del navegador. Ahora abre un
menú flotante redondeado con palomita en la opción elegida. Funciona con teclado: flechas,
Enter y Esc.

## 4. Inicio de sesión y aviso de privacidad

- **Inicio de sesión:** pantalla nueva y sin el recuadro blanco alrededor del botón de Google (`color-scheme: light` en `GoogleButton.jsx`).
- **Aviso de privacidad** (`public/privacidad.html`):
  - Está actualizado con todo lo nuevo.
  - Respeta el modo oscuro.
  - Se abre desde el inicio de sesión, desde tu cuenta (foto de perfil) y desde Apariencia y accesibilidad, en la app y en el panel.

## Actualizar una base que ya tiene datos (sin borrar nada)

En phpMyAdmin, elige la base y ve a la pestaña **SQL**. Pega esto y da clic en Continuar:

```sql
ALTER TABLE avisos
  MODIFY audiencia ENUM('todos','consejales','solo_consejales','grupo') NOT NULL DEFAULT 'todos',
  ADD COLUMN grupo VARCHAR(12) NULL AFTER audiencia,
  ADD KEY idx_avisos_grupo (grupo);

ALTER TABLE moderacion_log
  ADD COLUMN origen ENUM('comentario','perdido','fecha','aviso') NOT NULL DEFAULT 'comentario' AFTER motivo,
  ADD COLUMN veredicto ENUM('correcto','error') NULL AFTER origen,
  ADD COLUMN revisado_por VARCHAR(190) NULL AFTER veredicto,
  ADD COLUMN revisado_en DATETIME NULL AFTER revisado_por,
  ADD KEY idx_mod_revision (veredicto, creado_en);

UPDATE moderacion_log SET origen = 'perdido' WHERE texto LIKE '[Perdidos]%';
```

Si no te importa perder los datos, mejor importa otra vez `sql/polimap.sql`.

## Cómo probar

1. En el panel de admin, designa a tu cuenta de alumno como consejal de tu grupo.
2. En la app, ve a **Horario → Más**. Debe salir la tarjeta "Panel de consejal". Ábrela y publica un aviso con encuesta.
3. Con otra cuenta que tenga ese grupo elegido, el aviso sale en Inicio con la etiqueta "Para …". Con otro grupo no sale.
4. En Objetos perdidos, escribe una grosería. Debe bloquearse y aparecer en **Panel → Comentarios → Bloqueados**, con la etiqueta "Objetos perdidos".
5. Da clic en **Pausar cuenta** y elige **Permanente**. Otro admin no la puede quitar; la cuenta maestra sí.
