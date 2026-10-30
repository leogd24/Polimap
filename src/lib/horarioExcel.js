// src/lib/horarioExcel.js — Responsable: Alexis
// =====================================================================
// Excel del horario para los CONSEJALES (y para cualquiera que lo quiera
// editar). Un .xlsx real con 3 hojas:
//
//   "HORARIO DE LA SEMANA"  → la misma vista de la hoja de la UdeG: horas,
//        días, cada clase en celdas combinadas del alto de su duración con
//        "MATERIA / maestro / 07-09hrs. Aula E4-A05". En modo consejal cada
//        clase va con el color de la división (Grupo 1 azul, Grupo 2 rojo,
//        mitad y mitad, todo el grupo) y las canceladas tachadas con X roja;
//        leyenda a la izquierda y RECORDATORIOS a la derecha. Lista para
//        imprimir (horizontal, una hoja).
//   "DIVISION DE GRUPO"     → Código de alumno, Nombre, Correo institucional,
//        Grupo (1 o 2, con lista para elegir) y Notas. El color de cada fila
//        cambia solo al escribir 1 o 2, y arriba se cuentan los de cada grupo.
//   "HORARIO OFICIAL"       → la imagen de la hoja oficial de la UdeG.
//
// Sin librerías: XML a mano + zip() de src/lib/xlsx.js.
//
//   const bytes = await libroHorario({ grupo, colores, modos, semana, notas, lista });
// =====================================================================
import { CICLO, aMinutos, clasesDelDia, diasConClases, llaveClase, maestrosDeClase, rangoHoras, urlOficial } from './horario.js';
import { hex, tonoHex } from './temaHex.js';
import { coloresModo, horasCortas } from './horarioImagen.js';
import { zip, esc, limpiar, letra } from './xlsx.js';

const FUENTE = 'Arial';
const FILAS_LISTA = 60; // renglones para la lista (aunque estén vacíos)

const sinGato = (h) => h.replace('#', '').toUpperCase();

// ---------------------------------------------------------------------
// Estilos: se registran al vuelo y se reutilizan (Excel guarda una tabla)
// ---------------------------------------------------------------------
function crearEstilos() {
  const fuentes = ['<font><sz val="10"/><name val="Arial"/></font>'];
  const rellenos = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const bordes = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const dxfs = [];
  const idx = (lista, xml) => {
    const i = lista.indexOf(xml);
    if (i >= 0) return i;
    lista.push(xml);
    return lista.length - 1;
  };

  function fuente({ b = false, sz = 10, color = hex('text-primary'), i = false, strike = false } = {}) {
    return idx(fuentes, `<font>${b ? '<b/>' : ''}${i ? '<i/>' : ''}${strike ? '<strike/>' : ''}<sz val="${sz}"/><color rgb="FF${sinGato(color)}"/><name val="${FUENTE}"/></font>`);
  }
  function relleno(color, color2) {
    if (!color) return 0;
    if (color2) {
      return idx(rellenos, `<fill><gradientFill degree="45"><stop position="0"><color rgb="FF${sinGato(color)}"/></stop><stop position="1"><color rgb="FF${sinGato(color2)}"/></stop></gradientFill></fill>`);
    }
    return idx(rellenos, `<fill><patternFill patternType="solid"><fgColor rgb="FF${sinGato(color)}"/><bgColor indexed="64"/></patternFill></fill>`);
  }
  function borde({ color = hex('border'), grosor = 'thin', tachado = null } = {}) {
    const lado = (n) => `<${n} style="${grosor}"><color rgb="FF${sinGato(color)}"/></${n}>`;
    const diag = tachado ? `<diagonal style="medium"><color rgb="FF${sinGato(tachado)}"/></diagonal>` : '<diagonal/>';
    return idx(bordes, `<border${tachado ? ' diagonalUp="1" diagonalDown="1"' : ''}>${lado('left')}${lado('right')}${lado('top')}${lado('bottom')}${diag}</border>`);
  }
  /** Estilo completo de celda → id para s="…" */
  function xf({ font = {}, fondo, fondo2, bordeOpc = null, h = 'center', v = 'center', wrap = true, numFmt = 0 } = {}) {
    const f = fuente(font);
    const r = relleno(fondo, fondo2);
    const b = bordeOpc ? borde(bordeOpc) : 0;
    return idx(
      xfs,
      `<xf numFmtId="${numFmt}" fontId="${f}" fillId="${r}" borderId="${b}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="${v}"${wrap ? ' wrapText="1"' : ''}/></xf>`
    );
  }
  /** Formato condicional (fuente + relleno) → id de dxf */
  function dxf({ color, fondo, b = false }) {
    return idx(dxfs, `<dxf><font>${b ? '<b/>' : ''}<color rgb="FF${sinGato(color)}"/></font><fill><patternFill patternType="solid"><bgColor rgb="FF${sinGato(fondo)}"/></patternFill></fill></dxf>`);
  }
  function xml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${fuentes.length}">${fuentes.join('')}</fonts>` +
      `<fills count="${rellenos.length}">${rellenos.join('')}</fills>` +
      `<borders count="${bordes.length}">${bordes.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      `<dxfs count="${dxfs.length}">${dxfs.join('')}</dxfs>` +
      '</styleSheet>'
    );
  }
  return { xf, dxf, xml };
}

// ---------------------------------------------------------------------
// Hoja de cálculo: celdas, celdas combinadas y alturas
// ---------------------------------------------------------------------
function crearHoja() {
  const celdas = new Map(); // fila → Map(col → xml)
  const altos = new Map();
  const combinadas = [];
  function poner(fila, col, valor, estilo) {
    if (!celdas.has(fila)) celdas.set(fila, new Map());
    const ref = `${letra(col)}${fila}`;
    let xml;
    if (valor === null || valor === undefined || valor === '') xml = `<c r="${ref}" s="${estilo}"/>`;
    else if (typeof valor === 'number') xml = `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`;
    else if (typeof valor === 'object' && valor.formula) xml = `<c r="${ref}" s="${estilo}"><f>${esc(valor.formula)}</f></c>`;
    else xml = `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(limpiar(valor))}</t></is></c>`;
    celdas.get(fila).set(col, xml);
  }
  /** Combina un rectángulo; el valor va arriba a la izquierda y el estilo en todas (para los bordes). */
  function combinar(fila1, col1, fila2, col2, valor, estilo) {
    for (let f = fila1; f <= fila2; f += 1) for (let c = col1; c <= col2; c += 1) poner(f, c, f === fila1 && c === col1 ? valor : '', estilo);
    if (fila2 > fila1 || col2 > col1) combinadas.push(`${letra(col1)}${fila1}:${letra(col2)}${fila2}`);
  }
  function filasXml() {
    return [...celdas.keys()]
      .sort((a, b) => a - b)
      .map((f) => {
        const cols = [...celdas.get(f).entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x).join('');
        const alto = altos.get(f);
        return `<row r="${f}"${alto ? ` ht="${alto}" customHeight="1"` : ''}>${cols}</row>`;
      })
      .join('');
  }
  return { poner, combinar, altos, combinadas, filasXml };
}

function hojaXml({ hoja, anchos, extraAntes = '', extraDespues = '', alFinal = '', horizontal = false, congelar = null, fitToPage = false }) {
  // El orden de las partes importa: Excel no abre el archivo si van en otro orden.
  const cols = anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const pane = congelar
    ? `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${congelar - 1}" topLeftCell="A${congelar}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews>';
  const merges = hoja.combinadas.length ? `<mergeCells count="${hoja.combinadas.length}">${hoja.combinadas.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>` : '';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    (fitToPage ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '') +
    pane +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols>` +
    `<sheetData>${hoja.filasXml()}</sheetData>` +
    extraAntes +
    merges +
    extraDespues +
    '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>' +
    `<pageSetup paperSize="1" orientation="${horizontal ? 'landscape' : 'portrait'}"${fitToPage ? ' fitToWidth="1" fitToHeight="1"' : ''}/>` +
    alFinal +
    '</worksheet>'
  );
}

// ---------------------------------------------------------------------
// Hoja 1: horario de la semana
// ---------------------------------------------------------------------
function hojaSemana(est, { grupo, colores, modos, semana, notas }) {
  const consejal = Boolean(modos);
  const dias = diasConClases(grupo);
  const [ini, fin] = rangoHoras(grupo);
  const h = crearHoja();
  // Columnas: A leyenda (solo consejal), B hora, C… días, luego espacio y recordatorios.
  const cHora = 2;
  const cDia = (i) => 3 + i;
  const cUltimoDia = cDia(dias.length - 1);
  const cNotas = cUltimoDia + 2;
  const F_TITULO = 1;
  const F_ENC = 4;
  const fHora = (hora) => F_ENC + 1 + (hora - ini);
  const fUltima = fHora(fin - 1);
  const fPie = fUltima + 1;

  const noche = hex('blue');
  const acero = hex('blue-steel');
  const naranja = hex('gold-dark');
  const borde = { color: noche, grosor: 'thin' };

  // Títulos
  h.combinar(F_TITULO, cHora, F_TITULO, cUltimoDia, `HORARIO DE GRUPO ${CICLO.nombre}${semana ? `   ·   ${semana.toUpperCase()}` : ''}`, est.xf({ font: { b: true, sz: 16, color: noche }, h: 'left' }));
  h.altos.set(F_TITULO, 26);
  h.combinar(2, cHora, 2, cUltimoDia, 'Escuela Politécnica "Ing. Jorge Matute Remus" · Universidad de Guadalajara · POLIMAP', est.xf({ font: { sz: 10, color: hex('text-secondary') }, h: 'left' }));
  h.combinar(3, cHora, 3, cUltimoDia, `GRUPO ${grupo.code}  ·  ${grupo.career}  ·  TURNO ${grupo.shift.toUpperCase()}`, est.xf({ font: { b: true, sz: 11, color: naranja }, h: 'left' }));
  h.altos.set(3, 22);

  // Encabezado de días
  const sEnc = est.xf({ font: { b: true, sz: 11, color: '#ffffff' }, fondo: acero, bordeOpc: borde });
  h.poner(F_ENC, cHora, 'HORA', sEnc);
  dias.forEach((d, i) => h.poner(F_ENC, cDia(i), d.toUpperCase(), sEnc));
  h.altos.set(F_ENC, 22);

  // Celdas vacías con borde y la columna de horas
  const sHora = est.xf({ font: { b: true, sz: 10 }, bordeOpc: borde });
  const sVacia = est.xf({ bordeOpc: { color: hex('border') } });
  for (let hora = ini; hora < fin; hora += 1) {
    const f = fHora(hora);
    h.altos.set(f, 66);
    h.poner(f, cHora, `${String(hora).padStart(2, '0')}:00 - ${String(hora + 1).padStart(2, '0')}:00`, sHora);
    dias.forEach((_, i) => h.poner(f, cDia(i), '', sVacia));
  }

  // Clases
  dias.forEach((d, i) => {
    for (const c of clasesDelDia(grupo, d)) {
      const f1 = fHora(Math.floor(aMinutos(c.start) / 60));
      const f2 = fHora(Math.ceil(aMinutos(c.end) / 60) - 1);
      const texto = `${c.subject}\n\n${maestrosDeClase(c).join('\n')}\n${horasCortas(c)} ${c.room}`;
      let estilo;
      if (consejal) {
        const modo = modos[llaveClase(c)] ?? 'normal';
        const m = coloresModo(modo);
        estilo = est.xf({
          font: { b: modo !== 'normal' && modo !== 'sin', sz: 9, color: m.texto, strike: modo === 'sin' },
          fondo: modo === 'normal' ? null : m.fondo,
          fondo2: m.fondo2,
          bordeOpc: { color: noche, tachado: m.tachado ?? null },
        });
      } else {
        const t = tonoHex(colores.get(c.subject) ?? 0);
        estilo = est.xf({ font: { sz: 9 }, fondo: t.fondo, bordeOpc: { color: noche } });
      }
      h.combinar(f1, cDia(i), f2, cDia(i), texto, estilo);
    }
  });

  // Pie
  const sPie = est.xf({ font: { b: true, sz: 11 }, bordeOpc: borde });
  h.poner(fPie, cHora, `${grupo.weeklyHours} HRS.`, sPie);
  h.combinar(fPie, cDia(0), fPie, cUltimoDia, `${grupo.group.toUpperCase()}      ${grupo.career}      TURNO ${grupo.shift.toUpperCase()}`, sPie);
  h.altos.set(fPie, 24);

  // Leyenda (A) y recordatorios (derecha) — solo consejales
  if (consejal) {
    const leyenda = [
      ['g1', 'GRUPO 1'],
      ['mitad', 'MITAD DE LA HORA\n(30 MIN. GRUPO 1 Y 30 MIN. GRUPO 2)'],
      ['g2', 'GRUPO 2'],
      ['todos', 'TODO EL GRUPO'],
      ['sin', 'NO HAY CLASES'],
    ];
    h.poner(F_ENC, 1, 'SIGNIFICADO', est.xf({ font: { b: true, sz: 10, color: noche } }));
    leyenda.forEach(([modo, texto], k) => {
      const m = coloresModo(modo);
      h.poner(F_ENC + 1 + k, 1, texto, est.xf({ font: { b: true, sz: 10, color: m.texto }, fondo: m.fondo, fondo2: m.fondo2, bordeOpc: { color: noche, tachado: m.tachado ?? null } }));
    });
    h.poner(F_ENC, cNotas, 'RECORDATORIOS', est.xf({ font: { b: true, sz: 11, color: '#ffffff' }, fondo: hex('crimson'), bordeOpc: borde }));
    h.combinar(F_ENC + 1, cNotas, fUltima, cNotas, notas || '', est.xf({ font: { sz: 11 }, h: 'left', v: 'top', bordeOpc: { color: hex('border') } }));
  }

  const anchos = [consejal ? 24 : 2, 15, ...dias.map(() => 30), 3, consejal ? 38 : 2];
  return hojaXml({ hoja: h, anchos, horizontal: true, fitToPage: true });
}

// ---------------------------------------------------------------------
// Hoja 2: división del grupo (lista)
// ---------------------------------------------------------------------
function hojaDivision(est, { grupo, lista }) {
  const h = crearHoja();
  const noche = hex('blue');
  const azul = hex('cyan-dark');
  const rojo = hex('crimson-dark');
  const ultima = 4 + Math.max(FILAS_LISTA, lista.length + 10);

  h.combinar(1, 1, 1, 5, `LISTA Y DIVISIÓN DEL GRUPO ${grupo.code}`, est.xf({ font: { b: true, sz: 15, color: noche }, h: 'left' }));
  h.altos.set(1, 24);
  const sEtiqueta = est.xf({ font: { b: true, sz: 11, color: '#ffffff' }, fondo: azul, h: 'center' });
  const sEtiqueta2 = est.xf({ font: { b: true, sz: 11, color: '#ffffff' }, fondo: rojo, h: 'center' });
  const sNum = est.xf({ font: { b: true, sz: 12 }, h: 'center', bordeOpc: { color: hex('border') } });
  h.poner(2, 1, 'GRUPO 1', sEtiqueta);
  h.poner(2, 2, { formula: `COUNTIF(D5:D${ultima},1)` }, sNum);
  h.poner(2, 3, 'GRUPO 2', sEtiqueta2);
  h.poner(2, 4, { formula: `COUNTIF(D5:D${ultima},2)` }, sNum);
  h.poner(3, 1, 'Escribe 1 o 2 en la columna "Grupo": el renglón cambia de color solo.', est.xf({ font: { i: true, sz: 9, color: hex('text-secondary') }, h: 'left', wrap: false }));

  const sEnc = est.xf({ font: { b: true, sz: 11, color: noche }, fondo: hex('gold-tint'), bordeOpc: { color: noche } });
  ['CÓDIGO DE ALUMNO', 'NOMBRE', 'CORREO INSTITUCIONAL', 'GRUPO (1 o 2)', 'NOTAS'].forEach((t, i) => h.poner(4, i + 1, t, sEnc));
  h.altos.set(4, 22);

  const sCelda = est.xf({ font: { sz: 10 }, h: 'left', bordeOpc: { color: hex('border') } });
  const sGrupo = est.xf({ font: { b: true, sz: 11 }, h: 'center', bordeOpc: { color: hex('border') } });
  for (let f = 5; f <= ultima; f += 1) {
    const a = lista[f - 5];
    h.poner(f, 1, a?.codigo ?? '', sCelda);
    h.poner(f, 2, a?.nombre ?? '', sCelda);
    h.poner(f, 3, a?.correo ?? '', sCelda);
    h.poner(f, 4, a?.grupo ?? '', sGrupo);
    h.poner(f, 5, '', sCelda);
  }

  // Colores que cambian solos según la columna D, y lista desplegable 1/2.
  const d1 = est.dxf({ color: azul, fondo: hex('cyan-tint'), b: true });
  const d2 = est.dxf({ color: rojo, fondo: hex('crimson-tint'), b: true });
  const rango = `A5:E${ultima}`;
  const condicional =
    `<conditionalFormatting sqref="${rango}">` +
    `<cfRule type="expression" dxfId="${d1}" priority="1"><formula>$D5=1</formula></cfRule>` +
    `<cfRule type="expression" dxfId="${d2}" priority="2"><formula>$D5=2</formula></cfRule>` +
    '</conditionalFormatting>' +
    `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Grupo" error="Escribe 1 o 2" sqref="D5:D${ultima}"><formula1>"1,2"</formula1></dataValidation></dataValidations>`;
  return hojaXml({
    hoja: h,
    anchos: [20, 44, 40, 15, 30],
    congelar: 5,
    extraAntes: `<autoFilter ref="A4:E${ultima}"/>`,
    extraDespues: condicional,
  });
}

// ---------------------------------------------------------------------
// Hoja 3: imagen oficial
// ---------------------------------------------------------------------
function hojaOficial(est, { grupo, conImagen }) {
  const h = crearHoja();
  h.poner(1, 1, `HORARIO OFICIAL ${grupo.code} · Cal. ${CICLO.nombre}`, est.xf({ font: { b: true, sz: 15, color: hex('blue') }, h: 'left', wrap: false }));
  h.poner(2, 1, conImagen ? 'Hoja tal cual viene en el PDF de la UdeG.' : 'No se pudo agregar la imagen (sin conexión). Ábrela en POLIMAP → Horario → Oficial.', est.xf({ font: { sz: 10, color: hex('text-secondary') }, h: 'left', wrap: false }));
  return hojaXml({ hoja: h, anchos: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12], alFinal: conImagen ? '<drawing r:id="rId1"/>' : '', horizontal: true, fitToPage: true });
}

function drawingImagen(ancho, alto) {
  // Se muestra a 1000 px de ancho (EMU = px × 9525).
  const w = 1000;
  const hh = Math.round((alto / ancho) * w);
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
    `<xdr:ext cx="${w * 9525}" cy="${hh * 9525}"/>` +
    '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Horario oficial"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
    '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w * 9525}" cy="${hh * 9525}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
    '<xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>'
  );
}

/** Ancho y alto de un PNG (están en los bytes 16–23). */
function tamanoPng(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset);
  return { ancho: v.getUint32(16), alto: v.getUint32(20) };
}

// ---------------------------------------------------------------------
// Libro completo
// ---------------------------------------------------------------------

/**
 * Arma el .xlsx. Regresa Uint8Array.
 * opciones: { grupo, colores, modos (o null), semana, notas, lista, imagen (Uint8Array PNG opcional) }
 */
export function construirLibro(opciones) {
  const est = crearEstilos();
  const consejal = Boolean(opciones.modos);
  const conImagen = Boolean(opciones.imagen?.length);
  const hojas = [
    { nombre: 'HORARIO DE LA SEMANA', xml: hojaSemana(est, opciones) },
    ...(consejal ? [{ nombre: 'DIVISION DE GRUPO', xml: hojaDivision(est, { grupo: opciones.grupo, lista: opciones.lista ?? [] }) }] : []),
    { nombre: 'HORARIO OFICIAL', xml: hojaOficial(est, { grupo: opciones.grupo, conImagen }), imagen: conImagen },
  ];

  const archivos = {};
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  hojas.forEach((hj, i) => {
    archivos[`xl/worksheets/sheet${i + 1}.xml`] = hj.xml;
    if (hj.imagen) {
      archivos[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
    }
  });
  if (conImagen) {
    const { ancho, alto } = tamanoPng(opciones.imagen);
    archivos['xl/drawings/drawing1.xml'] = drawingImagen(ancho, alto);
    archivos['xl/drawings/_rels/drawing1.xml.rels'] =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/image" Target="../media/image1.png"/></Relationships>`;
    archivos['xl/media/image1.png'] = opciones.imagen;
  }
  archivos['xl/styles.xml'] = est.xml();
  archivos['xl/workbook.xml'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><bookViews><workbookView/></bookViews><sheets>` +
    hojas.map((hj, i) => `<sheet name="${esc(hj.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';
  archivos['xl/_rels/workbook.xml.rels'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${hojas.length + 1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`;
  archivos['_rels/.rels'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  archivos['[Content_Types].xml'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    (conImagen ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';
  return zip(archivos);
}

/** Igual que construirLibro, pero baja la imagen oficial antes (si hay internet o está guardada). */
export async function libroHorario(opciones) {
  let imagen = null;
  try {
    const r = await fetch(urlOficial(opciones.grupo));
    if (r.ok) imagen = new Uint8Array(await r.arrayBuffer());
  } catch {
    // Sin conexión: el Excel sale sin la hoja de imagen.
  }
  return construirLibro({ ...opciones, imagen });
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
