# Horario (pestaña "Horario") — funciones nuevas

Responsable: Alexis (sobre la pantalla de Leo). Datos: PDF oficial Cal. 2026B.

## Qué hace

| Parte | Qué ve el alumno | Archivo |
|---|---|---|
| Recordar grupo | Se elige carrera y grupo una vez (se guarda en el celular) | `src/pages/ScheduleScreen.jsx` |
| Ahora | Clase actual con barra de avance, "faltan 25 min" y la siguiente | `src/components/AhoraCard.jsx` |
| Mi día | Pestañas Lun–Vie (abre en hoy, se desliza), horas libres, color por materia | `src/components/DiaHorario.jsx` |
| Salón → mapa | Tocar una clase: maestro(s), salón, piso, quién más usa el salón y "Ver el Edificio N en el mapa" | `src/components/ClaseSheet.jsx` |
| Semana | Cuadrícula tipo hoja de la UdeG; descargar imagen o Excel | `src/components/SemanaGrid.jsx` |
| Oficial | La hoja del PDF de la UdeG (imagen), en grande y para descargar | `src/components/OficialHorario.jsx` |
| Más | Salones libres, comparar con un amigo, calendario del celular, avisos en la app | `src/components/HerramientasHorario.jsx` |
| Modo consejal | Dividir al grupo por semana, lista del grupo, Excel, imagen y compartir | `src/components/DivisionEditor.jsx` |
| Asistente | "¿Dónde está el profe Cisneros ahora?", "maestra Martha mañana a las 10", "salones libres el lunes a las 10" | `src/lib/asistenteHorario.js` |

La lógica (sin pantallas) está en `src/lib/horario.js`: hora de Zapopan, clase
actual, huecos, colores, salones libres, comparar, maestros y el archivo `.ics`.

## Modo consejal

Pincel → tocar clases: **Grupo 1** (azul), **Grupo 2** (rojo), **Mitad y mitad**
(30 min cada uno), **Todo el grupo** (magenta), **No hay clase** (tachada) o **Normal**.
Se guarda por grupo y por semana en el celular (`src/lib/division.js`).

"Excel" descarga un `.xlsx` con 3 hojas:

1. **HORARIO DE LA SEMANA**: la misma vista (celdas combinadas por hora), colores de la
   división, X roja en las canceladas, leyenda y RECORDATORIOS. Se imprime en una hoja.
2. **DIVISION DE GRUPO**: Código de alumno, Nombre, Correo institucional, Grupo (1 o 2,
   con lista para elegir) y Notas. El color del renglón cambia solo y arriba se cuenta
   cuántos hay en cada grupo.
3. **HORARIO OFICIAL**: la imagen de la hoja de la UdeG.

La lista se puede pegar directo desde Excel (código, nombre y correo en cualquier orden).
"Repartir en dos mitades" pone la primera mitad (por apellido) en Grupo 1.

## Hojas oficiales (imágenes)

`public/horarios/2026B/<GRUPO>.png` (83 imágenes, ~80 KB cada una). Se generan del PDF:

```
python scripts/generar_horarios_oficiales.py hrios_grupos26b.pdf 2026B
```

Requiere Python con Pillow y Poppler (`pdftoppm`, `pdftotext`). Para el siguiente ciclo:
genera las imágenes nuevas, actualiza `src/data/schedules/` y cambia `CICLO` en
`src/lib/horario.js` (nombre, inicio, fin y días sin clases).

## Recordatorios

- **Calendario del celular (.ics)**: todas las clases del ciclo con aviso X minutos antes.
  Funciona aunque POLIMAP esté cerrada (lo hace Google Calendar / Calendario de iPhone).
- **Avisos de POLIMAP**: notificación antes de cada clase mientras la app esté abierta.
  Avisos con la app cerrada desde el servidor no son posibles en InfinityFree: no tiene
  tareas programadas (cron) y bloquea los "pings" automáticos externos.

## pdf.js y Vite

`vite.config.js` sube el mínimo de Safari a 15 (iOS 15+) porque pdf.js (vista previa de
PDF en Avisos) no se puede compilar para Safari 14, y publica su worker como `.js`.

## Cómo probar

1. `npm run dev` → pestaña **Horario** → elige carrera y grupo.
2. Revisa "Ahora" (cambia la hora de tu compu para probar otros momentos).
3. Toca una clase → "Ver el Edificio N en el mapa".
4. Semana → Modo consejal → pinta clases, pega una lista, descarga el Excel y ábrelo.
5. Asistente (burbuja de chat) → "¿Dónde está el profe Cisneros ahora?".
