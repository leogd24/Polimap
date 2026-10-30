// src/lib/xlsx.js — Responsable: Alexis
// Piezas para armar archivos de Excel (.xlsx) SIN librerías: un .xlsx es un
// ZIP con archivos XML. Lo usan el Excel de reportes del panel
// (src/admin/excelExport.js) y el del horario de consejales
// (src/lib/horarioExcel.js).
//
//   zip({ 'xl/workbook.xml': '<…>', 'xl/media/a.png': Uint8Array }) → Uint8Array
//   esc('a < b') → 'a &lt; b'      letra(27) → 'AA'

// ZIP sencillo (sin compresión)
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(archivos) {
  const cod = new TextEncoder();
  const partes = [];
  const central = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const nombreB = cod.encode(nombre);
    const datos = typeof contenido === 'string' ? cod.encode(contenido) : contenido;
    const crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin compresión
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombreB.length, true);
    partes.push(new Uint8Array(local.buffer), nombreB, datos);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, datos.length, true);
    cen.setUint32(24, datos.length, true);
    cen.setUint16(28, nombreB.length, true);
    cen.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(cen.buffer), nombreB);
    desplazamiento += 30 + nombreB.length + datos.length;
  }
  const tamCentral = central.reduce((a, b) => a + b.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, Object.keys(archivos).length, true);
  fin.setUint16(10, Object.keys(archivos).length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const parte of todo) {
    salida.set(parte, p);
    p += parte.length;
  }
  return salida;
}

/** Escapa &, <, > y comillas para XML. */
export function esc(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Quita caracteres de control que rompen el XML (los pueden traer los textos de los alumnos). */
export function limpiar(texto) {
  // eslint-disable-next-line no-control-regex
  return String(texto).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** 1 → A, 27 → AA */
export function letra(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
