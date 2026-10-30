# Edificio por dentro, encuestas en avisos y objetos perdidos

Responsable: Alexis. Parte 2 de las mejoras generales.

**Antes de probar:** phpMyAdmin → tu base → SQL → pega todo
`sql/migracion-encuestas-perdidos.sql` → Continuar (local en XAMPP y luego en InfinityFree).
Crea `avisos_encuestas`, `avisos_opciones`, `avisos_votos`, `perdidos`,
`perdidos_reportes` y agrega el tipo `perdido` al historial (`bitacora`).

## 1. Edificio por dentro

- Ficha de cualquier edificio → sección **Por dentro**: el mismo esquema del panel
  (`src/components/FachadaEdificio.jsx`, ahora compartido; `SchematicSky.jsx` se movió
  de `src/admin/` a `src/components/`).
- Tu salón de hoy (la clase de ahora o la siguiente, del grupo elegido en Horario)
  brilla en dorado con el letrero "TU CLASE · AHORA" o "TU CLASE · 12:00".
- Al tocar un salón: piso, si está libre u ocupado ahora y sus clases de hoy.
- Desde Horario → toca una clase → **Ver el salón por dentro**.
- Archivos: `src/components/EdificioPorDentro.jsx`, `BuildingDetailScreen.jsx`,
  `ClaseSheet.jsx`, `ScheduleScreen.jsx`, `MainShell.jsx`.

## 2. Encuestas rápidas en avisos

- Panel → Avisos → Nuevo/Editar → **Agregar encuesta**: pregunta, 2 a 6 opciones,
  "se pueden elegir varias" y fecha de cierre (opcional) — `src/admin/PollEditor.jsx`.
- En la tarjeta del aviso del panel se ven los resultados (votos y %).
- App: la encuesta sale dentro del post (`src/components/EncuestaAviso.jsx`).
  - Los resultados se ven **después de votar** (o cuando cierra), para no votar por la mayoría.
  - Se puede cambiar el voto mientras esté abierta. Invitado: "Inicia sesión para votar".
- Al editar un aviso las opciones conservan sus votos; si mandas el aviso sin `poll`
  no se toca la encuesta; `poll: null` la borra con sus votos.
- API (`api/avisos.php`): cada aviso trae
  `poll = { question, multiple, closesAt, closed, voters, myVotes, showResults, options:[{id,text,votes}] }`
  (`votes` llega en `null` hasta que votas). Votar: `POST { accion:'votar', id, opciones:[ids] }`.

## 3. Objetos perdidos y encontrados

- App: Inicio → **Objetos perdidos** (o `/?perdidos=1`) — `src/pages/PerdidosScreen.jsx`.
  - Pestañas Se perdió / Se encontró / Míos; buscador y categorías.
  - Publicar (con sesión): foto opcional (se comprime antes de subir), qué es,
    categoría, edificio, lugar, fecha (últimos 60 días), "dónde recogerlo" y
    "mostrar mi correo".
  - "Escribir" abre el correo institucional del autor: solo con sesión y si lo permitió.
    El invitado ve la lista pero no nombres ni correos.
  - "Mapa" lleva al edificio. "Ya lo encontré / Ya se entregó" y Borrar en Míos.
- Cuidados: mismo filtro que los comentarios (groserías, teléfonos, correos, enlaces),
  máximo 5 publicaciones por día, si un admin pausó tus comentarios tampoco publicas,
  3 reportes la ocultan sola, se vence a los 30 días y se borra (con su foto) 30 días después.
- Panel → **Objetos perdidos** (`src/admin/LostSection.jsx`): por revisar (ocultas y
  reportadas), ocultar / volver a mostrar / borrar. Queda en Historial → Perdidos.
- API: `api/perdidos.php`. Fotos en `api/uploads/perdidos/` (la carpeta se crea sola).

## Pruebas que se hicieron

- API con 43 pruebas automáticas (encuestas: una/varias opciones, resultados ocultos,
  cambiar voto, cerrar, editar conservando votos, quitar; perdidos: publicar, filtro,
  límite diario, fecha/edificio inválidos, quién ve el correo, reportes → oculto,
  panel, moderar, resolver, borrar, historial): todas bien.
- Pantallas en claro, oscuro y alto contraste: 0 problemas de contraste, nombres o alt.

## Cómo probar

1. Corre la migración. `npm run dev`.
2. Panel (`/admin.html`) → Avisos → Nuevo aviso → Agregar encuesta → Publicar.
3. App con tu correo de alumno → Inicio → vota → ves los %; "Cambiar mi voto".
4. Inicio → Objetos perdidos → Publicar (con foto) → aparece en la lista y en Míos.
   Con otra cuenta: "Escribir" y la bandera para reportar.
5. Panel → Objetos perdidos → ocultar / volver a mostrar → Historial → Perdidos.
6. Edificios → Edificio 4 → Por dentro (elige antes tu grupo en Horario).
