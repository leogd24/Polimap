// src/lib/compressImage.js — Responsable: Katia
//
// Achica una foto ANTES de enviarla con el reporte.
// ¿Por qué? Una foto de celular pesa de 3 a 8 MB y el servidor solo acepta
// hasta 2 MB (docs/contrato-datos.md). Además, subir menos datos es más rápido
// con los datos móviles del alumno.
//
// Cómo funciona:
//   1. Abre la imagen en memoria (sin subirla a ningún lado).
//   2. La dibuja en un <canvas> más pequeño (máximo 1280 px de lado).
//   3. La guarda otra vez como JPEG con calidad 75 %.
//   4. Si aún pesa más de lo permitido, baja la calidad poco a poco.
//
// Bonus de privacidad: el JPEG nuevo ya NO trae los metadatos EXIF de la foto
// original (modelo de celular, fecha, ¡y a veces la ubicación GPS!).
//
// Uso:
//   import { compressImage } from '../lib/compressImage.js';
//   const fotoChica = await compressImage(archivoOriginal);

import { colors } from '../styles/theme.js';

const MAX_SIDE = 1280; // lado más largo en píxeles: se ve bien y pesa poco
const START_QUALITY = 0.75; // calidad inicial del JPEG (0 a 1)
const MIN_QUALITY = 0.45; // de aquí no bajamos para que la foto siga siendo útil
const MAX_BYTES = 1.8 * 1024 * 1024; // un poco menos de 2 MB, para ir con margen

/**
 * Recibe el File que eligió el alumno y regresa un File JPEG más ligero.
 * Lanza un Error con mensaje en español si la imagen no se puede leer.
 */
export async function compressImage(file) {
  // 1) Abrir la imagen.
  const image = await loadImage(file);

  // 2) Calcular el tamaño nuevo sin deformarla (misma proporción).
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  // 3) Dibujarla en un canvas de ese tamaño.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Fondo blanco: si era un PNG con partes transparentes, en JPEG saldrían negras.
  ctx.fillStyle = colors.white; // el blanco de theme.js (es un hex, el canvas no lee variables CSS)
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  if (image.close) image.close(); // libera memoria (solo existe en ImageBitmap)

  // 4) Exportar como JPEG; si pesa demasiado, bajar la calidad y reintentar.
  let quality = START_QUALITY;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_BYTES) {
    throw new Error('La foto sigue pesando demasiado. Intenta con otra.');
  }

  // Lo regresamos como File (con nombre) para mandarlo en el FormData.
  return new File([blob], 'reporte.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

/** Convierte bytes a texto legible: 345 KB, 1.2 MB… (para mostrarlo en pantalla). */
export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -----------------------------------------------------------------------
// Utilidades internas
// -----------------------------------------------------------------------

/**
 * Abre el archivo como imagen.
 * createImageBitmap es lo más rápido y además respeta la orientación de la foto
 * (si no, algunas fotos de celular saldrían acostadas). Si el navegador no lo
 * soporta, usamos un <img> normal como respaldo.
 */
async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // seguimos con el respaldo de abajo
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo leer la foto. Intenta con otra.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** canvas.toBlob con promesa (la versión original usa callback). */
function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la foto.'))),
      'image/jpeg',
      quality
    );
  });
}
