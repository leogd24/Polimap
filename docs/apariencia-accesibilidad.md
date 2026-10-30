# Apariencia, accesibilidad, Inicio personalizado y accesos rápidos

Responsable: Alexis. Parte 1 de las mejoras generales.

## Modo oscuro

- Botón nuevo arriba (ícono de contraste) → **Apariencia y accesibilidad** → Tema:
  Automático (como el celular) / Claro / Oscuro. Se guarda en el celular.
- `src/lib/tema.js` pone `data-tema="oscuro"` en `<html>`; `src/styles/theme.css`
  cambia neutros, tintes y textos. `index.html` lo aplica antes de pintar (sin parpadeo).
- Tokens nuevos en `theme.css` / `theme.js`:
  - `ink`: el noche cuando se usa como **texto, ícono o borde** sobre tarjetas
    (en oscuro se aclara). `blue` sigue siendo el noche de barras y botones.
  - `cyanSolid`, `crimsonSolid`, `goldSolid`, `greenSolid`, `magentaSolid`:
    **fondos** con texto blanco (no cambian). Las `-dark` son para **texto**.
- Regla para componentes nuevos: texto/borde → `ink` o `textPrimary`; fondo de color
  con letra blanca → `*Solid`; texto de color sobre su tinte → `*Dark`.
- La imagen y el Excel del horario siempre salen en claro (para imprimir).
- **El panel también tiene modo día/noche y es el MISMO ajuste que la app**: botón de
  luna/sol en el menú del panel (y arriba en celular). Si lo cambias en el panel, la app
  queda igual, y al revés; con las dos abiertas en pestañas, la otra cambia al instante.
  Los dos leen `polimap.apariencia` del mismo dominio (`src/lib/tema.js`, evento
  `storage`). `admin.html` lo aplica antes de pintar. El panel no usa el tamaño de letra.
- En modo noche el mapa de OpenStreetMap también se oscurece (`global.css`, app y panel).
- Panel en oscuro y alto contraste: 0 problemas de contraste en todas las secciones.

## Accesibilidad

- Tamaño de letra: Normal / Grande (112.5 %) / Muy grande (125 %). Los tamaños fijos en
  px de la app se pasaron a rem para que todo crezca junto.
- Alto contraste y Menos movimiento (también respeta "reducir movimiento" del celular).
- Texto gris (`text-muted`) más oscuro: de 2.6:1 a 4.9:1. Contorno visible al usar Tab.
- Interruptores y botones de solo ícono con nombre para lector de pantalla;
  la barra de abajo indica la pestaña actual (`aria-current`).
- Auditoría automática (controles sin nombre, imágenes sin alt y contraste WCAG AA)
  en Inicio, Horario, Semana, Más, Edificios, Reportar y la hoja de Apariencia, en
  claro, oscuro y alto contraste: **0 problemas**.

## Inicio personalizado y clima

`src/components/SaludoInicio.jsx`: "Buenos días, Ana", fecha, temperatura, la frase de
tus clases de hoy (del grupo elegido en Horario) y "¿llevo paraguas?" con el pronóstico
por hora de Open-Meteo cruzado con tu hora de salida (`src/lib/clima.js`). Ejemplo:
"Sal a tiempo: llueve a las 15:00 y sales a las 13:00".

## Accesos rápidos del ícono

`public/manifest.webmanifest` → `shortcuts`: Mi horario, Reportar, Mapa y Asistente
(mantén presionado el ícono instalado en Android). Abren `/?tab=horario`,
`/?tab=reportar`, `/?tab=mapa` y `/?asistente=1`. El service worker subió a v7.

## Cómo probar

1. `npm run dev` → botón de contraste arriba → prueba Oscuro, letra Muy grande y Alto contraste.
2. Inicio: elige grupo en Horario y regresa (sale tu siguiente clase y el clima).
3. Accesos rápidos: instala la app en Android (`npm run build` + publicar), mantén
   presionado el ícono. En la compu: abre `http://localhost:5173/?tab=horario`.
