# POLIMAP — Paleta Oficial del Politécnico (estilo "Noche + colores")

Fuente única de color: `src/styles/theme.css` (y `src/styles/theme.js` para usarlos en JS).
Barras casi negras (noche) y los 5 colores oficiales como acentos.

| Color oficial | Hex | Token | Uso |
|---|---|---|---|
| Azul Ciano | #00AEEF | `cyan` (+ `cyanDark`, `cyanTint`) | Pestaña Inicio, estado "En proceso", agua/baños |
| Verde Matute | #2FB344 | `green` (+ `greenDark`, `greenTint`) | Pestaña Mapa, estado "Resuelto" |
| Naranja | #F6921E | `gold` (+ `goldDark`, `goldTint`) | Pestaña Edificios, estado "En revisión" |
| Rojo Central | #E5233D | `crimson` (+ `crimsonDark`, `crimsonLight`, `crimsonTint`) | Pestaña Reportar, botón principal, "Recibido" |
| Rosa Magenta | #E72582 | `magenta` (+ `magentaDark`, `magentaLight`, `magentaTint`) | Pestaña Horario, categoría "Otro" |

- `blue` = noche #14203A (barras, títulos), `blueDeep` #0B1424 (splash), `blueLight` #2A3A5C (degradado).
- Sobre la barra noche, el rojo y el magenta usan su versión `-Light` para que el texto se lea (≥ 4.5:1).
- Los nombres viejos (`blue`, `crimson`, `gold`) se conservan para no tocar las demás pantallas.
- `src/components/BrandStripe.jsx` = franja con los 5 colores (debajo del encabezado de la app y del panel).
- El menú inferior (`MainShell.jsx`) pinta cada pestaña con su color (`destinations[].accent / onDark`).
