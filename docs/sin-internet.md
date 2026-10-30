# POLIMAP sin internet

Responsable: Alexis.

## Un solo archivo por página

`npm run build` hace dos pasadas (ver `package.json` y `vite.config.js`):

1. `vite build` arma la app. Antes de empezar, borra `dist/`.
2. `vite build --mode panel` arma el panel y lo agrega a `dist/`.

Cada página queda en **un solo `.js` y un solo `.css`** dentro de `dist/assets/`, sin trozos que se
descarguen después. El único archivo aparte es el "worker" de pdf.js, porque el navegador lo exige
así.

## Qué funciona sin red

El service worker es `public/sw.js`. Al terminar el build, `vite.config.js` (`listaSinInternet`)
escribe en `dist/sw.js` la lista de todos los archivos y una versión nueva. Así, desde la
**primera visita**, se guarda lo siguiente:

| Funciona sin red | Cómo |
|---|---|
| Toda la app y el panel (pantallas, íconos, imágenes, vista previa de PDF) | Se guardan al instalar |
| Letras e íconos (Google Fonts) | Se guardan al instalar o al verlos |
| Edificios, FAQ y asistente | `api.js` guarda la última copia (y si no hay, usa `src/data/`) |
| Avisos | Los últimos que viste (fotos y PDF incluidos, si los abriste) |
| Fechas del grupo, horario y calculadora | Última copia y datos locales |
| Mapa | Los cuadritos que ya viste (hasta 600) |
| Reportes | Se guardan en el celular con folio `POLI-LOCAL-…` |

Lo que **necesita internet** es todo lo que habla con el servidor: iniciar sesión, publicar,
comentar, votar, dar me gusta, objetos perdidos, clima y todo el panel con datos.

En el repo, `ARCHIVOS = []` y `VERSION = 'dev'` se ven vacíos en `public/sw.js`. Es normal: se
llenan solos en `dist/sw.js`.

## Cómo probar

1. `npm run build`. En `dist/assets/` debe haber un `index-….js`, un `admin-….js`, los `.css` y
   el worker de PDF.
2. Sube `dist/` al hosting y abre la app una vez con internet.
3. Pon el celular en modo avión y ábrela de nuevo. Deben abrir Inicio con los últimos avisos,
   las pestañas Mapa, Edificios, Reportar y Horario, el asistente, y el panel en su pantalla de
   entrada.
