# Fechas del grupo (exámenes y entregas) y calculadora de notas

Responsable: Alexis. Parte 3 de las mejoras generales.

**Antes de probar:** phpMyAdmin → tu base → SQL → pega todo `sql/migracion-calendario.sql`
→ Continuar (en XAMPP y luego en InfinityFree). Crea `grupo_consejales`, `grupo_fechas`,
`grupo_encuadres` y agrega la columna `grupo` a `push_suscripciones`.

## 1. Consejales de grupo (panel)

- Panel → **Consejales de grupo** (`src/admin/CouncilSection.jsx`): eliges el grupo,
  escribes el correo `@alumnos.udg.mx` y el rol (Consejal o Jefe de grupo).
- Puede ser alguien que aún no entra a la app; en cuanto inicie sesión con ese correo
  ya puede publicar. Quitar también se hace aquí. Ambas cosas quedan en Historial → Accesos.

## 2. Fechas del grupo (app → Horario → Fechas)

- Todos ven los exámenes y entregas de su grupo: "Esta semana", "La próxima semana",
  por mes; "mañana", "en 3 días" y la hora; "A mi calendario" descarga un `.ics`
  con recordatorio (1 día y 1 hora antes).
- Los consejales/jefes ven **Agregar fecha**, editar y borrar. Tipos: examen, entrega,
  exposición, práctica y otra fecha. Mismo filtro de groserías; máximo 20 por día.
- **Notificación**: al publicar, les llega a los celulares que eligieron ese grupo en
  Horario y activaron "Avisos en tu celular" en Inicio. El grupo se manda con la
  suscripción (`api/push.php`) y se actualiza solo al cambiar de grupo.
  Al tocarla abre `/?tab=horario&vista=fechas`.
- Inicio muestra lo de los próximos 3 días ("Mañana: Examen de Física a las 10:00").
- Sin internet se ve lo último que se descargó.
- API: `api/calendario.php` (ver comentarios al inicio del archivo).

## 3. Calculadora de promedio y faltas (app → Horario → Notas)

- Una tarjeta por materia del grupo con el promedio y una barra de faltas.
- En cada materia:
  - **Encuadre**: criterios y porcentajes (deben sumar 100). Lo escribe el alumno o usa
    **el encuadre del grupo** si el consejal lo compartió. El encuadre cambia por profe:
    el alumno siempre lo puede editar.
  - Pones lo que vas sacando → puntos que llevas, promedio y **cuánto necesitas en lo
    que falta para llegar a 60** (o si ya no alcanza).
  - **Faltas** con − / +; las clases del semestre salen del horario (ciclo 2026B, sin
    festivos) y se pueden cambiar; mínimo 80 % para ordinario (editable) y 65 % para
    extraordinario → "Puedes faltar 3 veces más".
  - Consejales: **Compartir encuadre con el grupo** (solo criterios y %, nunca calificaciones).
- En la hoja de una clase (Mi día → toca una clase) hay un botón **Falté**.
- Las calificaciones y faltas se guardan **solo en el celular** (`src/lib/calificaciones.js`),
  no en el servidor.

## Pruebas que se hicieron

- API: 26 pruebas automáticas (designar/quitar, permisos, fechas, validaciones, filtro,
  orden, editar sin cambiar de grupo, encuadres que suman 100, historial): todas bien.
- Cuentas de la calculadora con casos (sin datos, en camino, imposible, aprobado,
  faltas en el límite / extraordinario / sin derecho).
- Pantallas en claro, oscuro y alto contraste: 0 problemas; letra muy grande sin
  desbordar; sin errores en consola.

## Cómo probar

1. Corre la migración. `npm run dev`.
2. Panel → Consejales de grupo → designa tu correo de alumno en tu grupo.
3. App con esa cuenta → Horario (tu grupo) → Fechas → Agregar fecha.
4. Con otra cuenta del mismo grupo: Inicio muestra "Mañana: …" y Horario → Fechas la lista.
5. Horario → Notas → toca una materia → pon el encuadre y calificaciones; suma faltas.
6. Notificaciones: en un celular con HTTPS (InfinityFree), activa "Avisos en tu celular",
   elige el grupo en Horario y publica una fecha desde la cuenta del consejal.
