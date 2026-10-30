// src/lib/pdf.js — Responsable: Alexis
// =====================================================================
// Previsualizar PDF de los avisos con pdf.js (librería de Mozilla, la misma
// que usa Firefox). Se usa porque en Android el navegador NO muestra los PDF
// dentro de la página; así se ven igual en cualquier celular.
//
// pdf.js va dentro del archivo principal de la app (sin descargas aparte),
// así la vista previa también funciona sin internet. Su "worker" sí es un
// archivo separado (los navegadores lo exigen); el service worker lo guarda.
//
// Se usa la versión "legacy" para que funcione también en iPhone/Android
// algo viejitos.
//
//   const doc = await abrirPdf(url);           // abre (y recuerda) el PDF
//   doc.numPages                                // cuántas páginas tiene
//   await dibujarPagina(doc, 1, canvas, 320);   // dibuja la página 1 a 320 px de ancho
// =====================================================================

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const abiertos = new Map(); // url → promesa del documento (para no bajarlo dos veces)

/** pdf.js ya viene cargado; se deja como promesa para no cambiar el resto. */
function cargarLibreria() {
  return Promise.resolve(pdfjs);
}

/** Abre un PDF por su URL. Regresa el documento de pdf.js. */
export async function abrirPdf(url) {
  if (!abiertos.has(url)) {
    const promesa = cargarLibreria().then(
      (pdfjs) =>
        pdfjs.getDocument({
          url,
          isEvalSupported: false, // seguridad: nunca ejecutar código que venga dentro del PDF
          withCredentials: false,
        }).promise
    );
    abiertos.set(url, promesa);
    promesa.catch(() => abiertos.delete(url));
  }
  return abiertos.get(url);
}

/**
 * Dibuja una página en un <canvas> con un ancho en pantalla (px CSS).
 * Se dibuja al doble de resolución en pantallas retina para que se lea nítido.
 * Regresa la tarea de pdf.js (tiene .cancel() por si el componente se cierra).
 */
export async function dibujarPagina(doc, numero, canvas, anchoCss) {
  const pagina = await doc.getPage(numero);
  const base = pagina.getViewport({ scale: 1 });
  const nitidez = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = pagina.getViewport({ scale: (anchoCss / base.width) * nitidez });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(anchoCss)}px`;
  canvas.style.height = `${Math.floor(viewport.height / nitidez)}px`;
  return pagina.render({ canvas, canvasContext: canvas.getContext('2d'), viewport });
}

/** Proporción alto/ancho de una página (para reservar su lugar antes de dibujarla). */
export async function proporcionPagina(doc, numero = 1) {
  const vp = (await doc.getPage(numero)).getViewport({ scale: 1 });
  return vp.height / vp.width;
}
