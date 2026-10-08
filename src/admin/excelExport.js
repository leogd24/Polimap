// src/admin/excelExport.js — Responsable: Alexis
// "Exportar Excel" del panel: arma un archivo .xlsx REAL (no CSV) con:
//
//   Hoja "Resumen"   → encabezado POLIMAP, 6 indicadores, 4 tablas y 4 gráficas
//                      nativas de Excel (estado, categoría, lugar y semanas).
//   Hoja "Reportes"  → todos los reportes con formato: encabezado fijo, filtros,
//                      fechas reales, colores por estado y prioridad.
//   Hoja "Notas"     → cómo se calcula cada número y qué filtros se usaron.
//
// Los números del Resumen son FÓRMULAS (COUNTIF, COUNTIFS, AVERAGE) que leen la
// hoja Reportes: si alguien borra o corrige una fila en Excel, el resumen y las
// gráficas se actualizan solos.
//
// No usa librerías: un .xlsx es un ZIP con archivos XML. Aquí se escriben esos
// XML a mano y se empacan con un ZIP sencillo (sin compresión), así no hay que
// instalar nada con npm.
//
// Uso (DashboardSection.jsx):
//   import { downloadExcel } from './excelExport.js';
//   downloadExcel(reportesFiltrados, nombresDeEdificios, { filtros: 'Edificio 3', autor: user.correo });
import { CATEGORIES, STATES, categoryInfo, stateInfo, priorityInfo, locationText } from './reportMeta.js';

// ---------------------------------------------------------------------------
// 1) Colores (Paleta Oficial del Politécnico, los mismos de theme.css)
//    Excel no lee variables CSS, por eso aquí van en hexadecimal.
// ---------------------------------------------------------------------------
const C = {
  noche: '14203A',
  nocheProfundo: '0B1424',
  blanco: 'FFFFFF',
  fondo: 'F3F5F9',
  borde: 'DCE3ED',
  texto: '14203A',
  gris: '5D6980',
  grisClaro: '93A0B5',
  verde: '2FB344',
  magenta: 'E72582',
  ciano: '00AEEF',
  naranja: 'F6921E',
  rojo: 'E5233D',
  rojoTinte: 'FDE7EA',
  naranjaTinte: 'FEF1E2',
  cianoTinte: 'E0F4FC',
  verdeTinte: 'E3F6E6',
  nocheTinte: 'E8EDF5',
};
const COLOR_ESTADO = { recibido: C.rojo, revision: C.naranja, proceso: C.ciano, resuelto: C.verde };
const TINTE_ESTADO = { recibido: C.rojoTinte, revision: C.naranjaTinte, proceso: C.cianoTinte, resuelto: C.verdeTinte };
const FUENTE = 'Arial';

// ---------------------------------------------------------------------------
// 2) Función principal
// ---------------------------------------------------------------------------

/** Genera el .xlsx y lo descarga en el navegador. */
export function downloadExcel(reports, buildingNames, opciones = {}) {
  const bytes = buildWorkbook(reports, buildingNames, opciones);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `POLIMAP-reportes-${fechaArchivo(opciones.ahora || new Date())}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Arma el libro completo y regresa los bytes del .xlsx (Uint8Array).
 * Separado de downloadExcel() para poder probarlo sin navegador.
 */
export function buildWorkbook(reports, buildingNames = {}, opciones = {}) {
  const ahora = opciones.ahora || new Date();
  const estilos = new Estilos();
  // Del más nuevo al más viejo (como en el panel).
  const filas = [...reports].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const hojaReportes = construirReportes(filas, buildingNames, estilos, ahora);
  const resumen = construirResumen(filas, buildingNames, estilos, ahora, opciones, hojaReportes.rango);
  const notas = construirNotas(estilos, opciones, filas.length, ahora);

  const archivos = {
    '[Content_Types].xml': tiposDeContenido(resumen.graficas.length),
    '_rels/.rels': relsRaiz(),
    'docProps/app.xml': appXml(),
    'docProps/core.xml': coreXml(ahora, opciones.autor),
    'xl/workbook.xml': workbookXml(hojaReportes.rango),
    'xl/_rels/workbook.xml.rels': workbookRels(),
    'xl/styles.xml': estilos.xml(),
    'xl/worksheets/sheet1.xml': resumen.xml,
    'xl/worksheets/_rels/sheet1.xml.rels': rels([['rId1', TIPO_DRAWING, '../drawings/drawing1.xml']]),
    'xl/worksheets/sheet2.xml': hojaReportes.xml,
    'xl/worksheets/sheet3.xml': notas,
    'xl/drawings/drawing1.xml': drawingXml(resumen.graficas),
    'xl/drawings/_rels/drawing1.xml.rels': rels(
      resumen.graficas.map((g, i) => [`rId${i + 1}`, TIPO_CHART, `../charts/chart${i + 1}.xml`]),
    ),
  };
  resumen.graficas.forEach((g, i) => {
    archivos[`xl/charts/chart${i + 1}.xml`] = g.xml;
  });
  return zip(archivos);
}

// ---------------------------------------------------------------------------
// 3) Hoja "Reportes"
// ---------------------------------------------------------------------------

// Columnas de la tabla (A..P). Las letras se usan en las fórmulas del Resumen.
const COLUMNAS = [
  { titulo: 'Folio', ancho: 17 },
  { titulo: 'Fecha', ancho: 17 },
  { titulo: 'Categoría', ancho: 21 },
  { titulo: 'Edificio', ancho: 9 },
  { titulo: 'Zona', ancho: 14 },
  { titulo: 'Ubicación', ancho: 30 },
  { titulo: 'Estado', ancho: 13 },
  { titulo: 'Prioridad', ancho: 11 },
  { titulo: 'Descripción', ancho: 48 },
  { titulo: 'Comentario del equipo', ancho: 32 },
  { titulo: 'Enviado por', ancho: 30 },
  { titulo: 'Resuelto el', ancho: 17 },
  { titulo: 'Días para resolver', ancho: 12 },
  { titulo: 'Latitud', ancho: 11 },
  { titulo: 'Longitud', ancho: 12 },
  { titulo: 'Apoyos', ancho: 9 },
];
const FILA_ENCABEZADO = 4; // los datos empiezan en la fila 5

function construirReportes(filas, buildingNames, est, ahora) {
  const s = {
    titulo: est.id({
      fuente: { tam: 16, negrita: true, color: C.blanco },
      relleno: C.noche,
      vertical: 'center',
      indent: 1,
    }),
    subtitulo: est.id({ fuente: { tam: 10, color: 'C9D3E6' }, relleno: C.noche, vertical: 'center', indent: 1 }),
    encabezado: est.id({
      fuente: { tam: 10, negrita: true, color: C.blanco },
      relleno: C.noche,
      borde: { abajo: [C.ciano, 'medium'] },
      horizontal: 'center',
      vertical: 'center',
      ajustar: true,
    }),
    texto: est.id({ fuente: { tam: 10 }, borde: { abajo: [C.borde, 'thin'] }, vertical: 'top' }),
    textoAjustado: est.id({ fuente: { tam: 10 }, borde: { abajo: [C.borde, 'thin'] }, vertical: 'top', ajustar: true }),
    folio: est.id({
      fuente: { tam: 10, negrita: true, color: C.noche },
      borde: { abajo: [C.borde, 'thin'] },
      vertical: 'top',
    }),
    fecha: est.id({
      fuente: { tam: 10 },
      borde: { abajo: [C.borde, 'thin'] },
      vertical: 'top',
      formato: 'dd/mm/yyyy hh:mm',
      horizontal: 'left',
    }),
    numero: est.id({ fuente: { tam: 10 }, borde: { abajo: [C.borde, 'thin'] }, vertical: 'top', horizontal: 'center' }),
    dias: est.id({
      fuente: { tam: 10 },
      borde: { abajo: [C.borde, 'thin'] },
      vertical: 'top',
      horizontal: 'center',
      formato: '0.0',
    }),
    coord: est.id({
      fuente: { tam: 9, color: C.gris },
      borde: { abajo: [C.borde, 'thin'] },
      vertical: 'top',
      formato: '0.000000',
    }),
    urgente: est.id({
      fuente: { tam: 10, negrita: true, color: 'B71C30' },
      borde: { abajo: [C.borde, 'thin'] },
      vertical: 'top',
      horizontal: 'center',
    }),
    prioridad: est.id({
      fuente: { tam: 10, color: C.gris },
      borde: { abajo: [C.borde, 'thin'] },
      vertical: 'top',
      horizontal: 'center',
    }),
    anonimo: est.id({
      fuente: { tam: 10, cursiva: true, color: C.grisClaro },
      borde: { abajo: [C.borde, 'thin'] },
      vertical: 'top',
    }),
  };
  const estadoEstilo = Object.fromEntries(
    STATES.map((st) => [
      st.key,
      est.id({
        fuente: {
          tam: 10,
          negrita: true,
          color:
            st.key === 'proceso'
              ? '006A96'
              : st.key === 'revision'
                ? 'A35700'
                : st.key === 'resuelto'
                  ? '1E7A2E'
                  : 'B71C30',
        },
        relleno: TINTE_ESTADO[st.key],
        borde: { abajo: [C.borde, 'thin'] },
        horizontal: 'center',
        vertical: 'top',
      }),
    ]),
  );

  const hoja = new Hoja();
  hoja.alto(1, 30);
  hoja.alto(2, 18);
  hoja.alto(FILA_ENCABEZADO, 30);
  hoja.unir(`A1:P1`);
  hoja.unir(`A2:P2`);
  hoja.texto('A1', 'POLIMAP · Reportes de incidencias', s.titulo);
  hoja.texto('A2', `Escuela Politécnica "Ing. Jorge Matute Remus" · Generado el ${fechaLarga(ahora)}`, s.subtitulo);
  for (let col = 2; col <= COLUMNAS.length; col++) {
    hoja.vacia(`${letra(col)}1`, s.titulo);
    hoja.vacia(`${letra(col)}2`, s.subtitulo);
  }
  COLUMNAS.forEach((c, i) => hoja.texto(`${letra(i + 1)}${FILA_ENCABEZADO}`, c.titulo, s.encabezado));

  filas.forEach((r, i) => {
    const f = FILA_ENCABEZADO + 1 + i;
    const prio = priorityInfo(r.prioridad);
    hoja.texto(`A${f}`, r.folio, s.folio);
    hoja.fecha(`B${f}`, r.createdAt, s.fecha);
    hoja.texto(`C${f}`, categoryInfo(r.categoria).label, s.texto);
    if (r.edificioNumber) hoja.numero(`D${f}`, r.edificioNumber, s.numero);
    else hoja.vacia(`D${f}`, s.numero);
    hoja.texto(`E${f}`, r.edificioNumber ? '' : r.zona || 'Sin ubicación', s.texto);
    hoja.texto(`F${f}`, locationText(r, buildingNames), s.textoAjustado);
    hoja.texto(`G${f}`, stateInfo(r.estado).label, estadoEstilo[r.estado] ?? s.texto);
    hoja.texto(`H${f}`, prio.label, r.prioridad === 'alta' ? s.urgente : s.prioridad);
    hoja.texto(`I${f}`, r.descripcion || '', s.textoAjustado);
    hoja.texto(`J${f}`, r.comentarioAdmin || '', s.textoAjustado);
    if (r.autor) hoja.texto(`K${f}`, `${r.autor.nombre || ''} <${r.autor.correo}>`.trim(), s.textoAjustado);
    else hoja.texto(`K${f}`, 'Anónimo', s.anonimo);
    if (r.resolvedAt) hoja.fecha(`L${f}`, r.resolvedAt, s.fecha);
    else hoja.vacia(`L${f}`, s.fecha);
    // Días para resolver = Resuelto el − Fecha (fórmula, se recalcula sola).
    const dias = r.resolvedAt ? serial(r.resolvedAt) - serial(r.createdAt) : null;
    hoja.formula(`M${f}`, `IF(L${f}="","",L${f}-B${f})`, dias == null ? '' : redondear(dias, 4), s.dias);
    if (r.lat != null) hoja.numero(`N${f}`, r.lat, s.coord);
    else hoja.vacia(`N${f}`, s.coord);
    if (r.lng != null) hoja.numero(`O${f}`, r.lng, s.coord);
    else hoja.vacia(`O${f}`, s.coord);
    // Apoyos: alumnos que se sumaron con "A mí también me pasa".
    hoja.numero(`P${f}`, r.apoyos || 0, s.numero);
  });

  const ultima = Math.max(FILA_ENCABEZADO + 1, FILA_ENCABEZADO + filas.length);
  const rango = { primera: FILA_ENCABEZADO + 1, ultima, hay: filas.length };
  const xml = hoja.xml({
    columnas: COLUMNAS.map((c) => c.ancho),
    congelar: { fila: FILA_ENCABEZADO + 1 },
    filtro: `A${FILA_ENCABEZADO}:P${Math.max(FILA_ENCABEZADO + 1, ultima)}`,
    cuadricula: true,
    horizontal: true,
    colorPestana: C.ciano,
  });
  return { xml, rango };
}

// ---------------------------------------------------------------------------
// 4) Hoja "Resumen" (indicadores, tablas y gráficas)
// ---------------------------------------------------------------------------

function construirResumen(filas, buildingNames, est, ahora, opciones, rango) {
  const R = (col) => `Reportes!$${col}$${rango.primera}:$${col}$${rango.ultima}`;
  const hoja = new Hoja();
  const total = filas.length;

  const s = {
    titulo: est.id({
      fuente: { tam: 20, negrita: true, color: C.blanco },
      relleno: C.noche,
      vertical: 'center',
      indent: 1,
    }),
    subtitulo: est.id({ fuente: { tam: 10, color: 'C9D3E6' }, relleno: C.noche, vertical: 'center', indent: 1 }),
    filtros: est.id({ fuente: { tam: 9, cursiva: true, color: C.gris }, vertical: 'center', indent: 1 }),
    seccion: est.id({
      fuente: { tam: 12, negrita: true, color: C.noche },
      borde: { abajo: [C.noche, 'medium'] },
      vertical: 'bottom',
    }),
    encabezado: est.id({
      fuente: { tam: 9, negrita: true, color: C.gris },
      relleno: C.fondo,
      borde: { abajo: [C.borde, 'thin'] },
      horizontal: 'left',
    }),
    encabezadoNum: est.id({
      fuente: { tam: 9, negrita: true, color: C.gris },
      relleno: C.fondo,
      borde: { abajo: [C.borde, 'thin'] },
      horizontal: 'right',
    }),
    celda: est.id({ fuente: { tam: 10 }, borde: { abajo: [C.borde, 'thin'] } }),
    num: est.id({ fuente: { tam: 10, negrita: true }, borde: { abajo: [C.borde, 'thin'] }, formato: '0' }),
    pct: est.id({ fuente: { tam: 10, color: C.gris }, borde: { abajo: [C.borde, 'thin'] }, formato: '0%' }),
    semana: est.id({
      fuente: { tam: 10 },
      borde: { abajo: [C.borde, 'thin'] },
      formato: 'dd/mm/yyyy',
      horizontal: 'left',
    }),
    totalTxt: est.id({ fuente: { tam: 10, negrita: true }, borde: { arriba: [C.noche, 'thin'] } }),
    totalNum: est.id({ fuente: { tam: 10, negrita: true }, borde: { arriba: [C.noche, 'thin'] }, formato: '0' }),
    nota: est.id({ fuente: { tam: 8, cursiva: true, color: C.grisClaro } }),
    franja: Object.fromEntries(
      [C.verde, C.magenta, C.ciano, C.naranja, C.rojo].map((col) => [col, est.id({ relleno: col })]),
    ),
  };

  // Columnas: A margen · B..M contenido (12 columnas iguales) · N margen
  hoja.anchos = [2, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 2]; // tarjetas del mismo ancho

  // --- Encabezado ---------------------------------------------------------
  hoja.alto(1, 8);
  hoja.alto(2, 34);
  hoja.alto(3, 20);
  hoja.alto(4, 5);
  hoja.unir('B2:M2');
  hoja.unir('B3:M3');
  for (let col = 1; col <= 14; col++) {
    hoja.vacia(`${letra(col)}1`, s.titulo);
    if (col !== 2) hoja.vacia(`${letra(col)}2`, s.titulo);
    if (col !== 2) hoja.vacia(`${letra(col)}3`, s.subtitulo);
  }
  hoja.texto('B2', 'POLIMAP · Reporte de incidencias del campus', s.titulo);
  hoja.texto(
    'B3',
    `Escuela Politécnica "Ing. Jorge Matute Remus" · Generado el ${fechaLarga(ahora)}${opciones.autor ? ` por ${opciones.autor}` : ''}`,
    s.subtitulo,
  );
  // Franja con los 5 colores oficiales
  const franja = [
    C.verde,
    C.verde,
    C.verde,
    C.magenta,
    C.magenta,
    C.magenta,
    C.ciano,
    C.ciano,
    C.naranja,
    C.naranja,
    C.naranja,
    C.rojo,
    C.rojo,
    C.rojo,
  ];
  franja.forEach((col, i) => hoja.vacia(`${letra(i + 1)}4`, s.franja[col]));
  hoja.alto(5, 18);
  hoja.unir('B5:M5');
  hoja.texto(
    'B5',
    `Filtros aplicados: ${opciones.filtros || 'ninguno (todos los reportes)'} · ${total} ${total === 1 ? 'reporte' : 'reportes'}`,
    s.filtros,
  );

  // --- Indicadores (6 tarjetas de 2 columnas cada una) ---------------------
  const kpis = calcularKpis(filas);
  const tarjetas = [
    { titulo: 'Total de reportes', f: `COUNTA(${R('A')})`, v: total, color: C.noche, formato: '0' },
    { titulo: 'Sin atender', f: `COUNTIF(${R('G')},"Recibido")`, v: kpis.recibido, color: C.rojo, formato: '0' },
    { titulo: 'En revisión', f: `COUNTIF(${R('G')},"En revisión")`, v: kpis.revision, color: C.naranja, formato: '0' },
    { titulo: 'En proceso', f: `COUNTIF(${R('G')},"En proceso")`, v: kpis.proceso, color: C.ciano, formato: '0' },
    { titulo: 'Resueltos', f: `COUNTIF(${R('G')},"Resuelto")`, v: kpis.resuelto, color: C.verde, formato: '0' },
    {
      titulo: 'Días prom. de solución',
      f: `IFERROR(AVERAGE(${R('M')}),0)`,
      v: kpis.promedio,
      color: C.magenta,
      formato: '0.0',
    },
  ];
  hoja.alto(6, 10);
  hoja.alto(7, 20);
  hoja.alto(8, 40);
  hoja.alto(9, 18);
  tarjetas.forEach((t, i) => {
    const c1 = letra(2 + i * 2);
    const c2 = letra(3 + i * 2);
    const etiqueta = est.id({
      fuente: { tam: 9, negrita: true, color: C.gris },
      relleno: C.blanco,
      borde: { arriba: [t.color, 'thick'], izq: [C.borde, 'thin'], der: [C.borde, 'thin'] },
      indent: 1,
      vertical: 'bottom',
    });
    const valor = est.id({
      fuente: { tam: 24, negrita: true, color: C.noche },
      relleno: C.blanco,
      borde: { izq: [C.borde, 'thin'], der: [C.borde, 'thin'] },
      indent: 1,
      vertical: 'center',
      horizontal: 'left',
      formato: t.formato,
    });
    const pie = est.id({
      fuente: { tam: 8, color: C.grisClaro },
      relleno: C.blanco,
      borde: { abajo: [C.borde, 'thin'], izq: [C.borde, 'thin'], der: [C.borde, 'thin'] },
      indent: 1,
      vertical: 'top',
    });
    hoja.unir(`${c1}7:${c2}7`);
    hoja.unir(`${c1}8:${c2}8`);
    hoja.unir(`${c1}9:${c2}9`);
    hoja.texto(`${c1}7`, t.titulo, etiqueta);
    hoja.vacia(`${c2}7`, etiqueta);
    hoja.formula(`${c1}8`, t.f, t.v, valor);
    hoja.vacia(`${c2}8`, valor);
    hoja.texto(
      `${c1}9`,
      i === 1 ? `${kpis.urgentes} urgentes` : i === 5 ? 'meta: 2 días' : i === 0 ? 'con los filtros del panel' : '',
      pie,
    );
    hoja.vacia(`${c2}9`, pie);
  });
  // "Sin atender" lleva el número de urgentes como fórmula también
  hoja.formula(
    'D9',
    `COUNTIFS(${R('G')},"Recibido",${R('H')},"Urgente")&" urgentes"`,
    `${kpis.urgentes} urgentes`,
    hoja.estiloDe('D9'),
  );

  // --- Tablas + gráficas ---------------------------------------------------
  const graficas = [];
  let fila = 12;

  /**
   * Escribe una tabla "Concepto | Reportes | %" y regresa sus filas.
   * Concepto ocupa B:C (unidas), Reportes va en D y el % en E.
   * La gráfica de cada tabla va a su derecha, de la columna G a la M.
   */
  const tabla = (titulo, filasTabla, conPorcentaje = true) => {
    hoja.alto(fila, 22);
    hoja.unir(`B${fila}:E${fila}`);
    hoja.texto(`B${fila}`, titulo, s.seccion);
    ['C', 'D', 'E'].forEach((c) => hoja.vacia(`${c}${fila}`, s.seccion));
    fila += 1;
    hoja.unir(`B${fila}:C${fila}`);
    hoja.texto(`B${fila}`, filasTabla.encabezado || 'Concepto', s.encabezado);
    hoja.vacia(`C${fila}`, s.encabezado);
    hoja.texto(`D${fila}`, 'Reportes', s.encabezadoNum);
    hoja.texto(`E${fila}`, conPorcentaje ? '%' : '', s.encabezadoNum);
    fila += 1;
    const inicio = fila;
    const suma = filasTabla.items.reduce((a, b) => a + b.v, 0);
    const fin = inicio + filasTabla.items.length - 1;
    const filaTotal = fin + 1;
    filasTabla.items.forEach((it) => {
      hoja.unir(`B${fila}:C${fila}`);
      if (it.fecha) hoja.fecha(`B${fila}`, it.fecha, s.semana);
      else hoja.texto(`B${fila}`, it.etiqueta, s.celda);
      hoja.vacia(`C${fila}`, s.celda);
      hoja.formula(`D${fila}`, it.f, it.v, s.num);
      if (conPorcentaje) {
        hoja.formula(`E${fila}`, `IF($D$${filaTotal}=0,0,D${fila}/$D$${filaTotal})`, suma ? it.v / suma : 0, s.pct);
      } else {
        hoja.vacia(`E${fila}`, s.celda);
      }
      fila += 1;
    });
    hoja.unir(`B${filaTotal}:C${filaTotal}`);
    hoja.texto(`B${filaTotal}`, 'Total', s.totalTxt);
    hoja.vacia(`C${filaTotal}`, s.totalTxt);
    hoja.formula(`D${filaTotal}`, `SUM(D${inicio}:D${fin})`, suma, s.totalNum);
    hoja.vacia(`E${filaTotal}`, s.totalTxt);
    fila = filaTotal + 2;
    return { inicio, fin, filaTitulo: inicio - 2 };
  };

  // 4.1 Estado
  const porEstado = tabla('Reportes por estado', {
    encabezado: 'Estado',
    items: STATES.map((st) => ({
      etiqueta: st.label,
      f: `COUNTIF(${R('G')},"${st.label}")`,
      v: filas.filter((r) => r.estado === st.key).length,
    })),
  });
  graficas.push(
    graficaDona({
      titulo: 'Reportes por estado',
      cats: rangoResumen('B', porEstado),
      vals: rangoResumen('D', porEstado),
      etiquetas: STATES.map((st) => st.label),
      valores: STATES.map((st) => filas.filter((r) => r.estado === st.key).length),
      colores: STATES.map((st) => COLOR_ESTADO[st.key]),
      ancla: anclaGrafica(porEstado.filaTitulo, 15),
    }),
  );
  fila = Math.max(fila, porEstado.filaTitulo + 16);

  // 4.2 Categoría (de mayor a menor)
  const cats = Object.entries(CATEGORIES)
    .map(([key, c]) => ({ key, etiqueta: c.label, v: filas.filter((r) => r.categoria === key).length }))
    .sort((a, b) => b.v - a.v);
  const porCategoria = tabla('Reportes por categoría', {
    encabezado: 'Categoría',
    items: cats.map((c) => ({ etiqueta: c.etiqueta, f: `COUNTIF(${R('C')},"${c.etiqueta}")`, v: c.v })),
  });
  graficas.push(
    graficaBarras({
      titulo: 'Reportes por categoría',
      cats: rangoResumen('B', porCategoria),
      vals: rangoResumen('D', porCategoria),
      etiquetas: cats.map((c) => c.etiqueta),
      valores: cats.map((c) => c.v),
      colores: cats.map((c) => (['fuga', 'riesgo'].includes(c.key) ? C.rojo : C.ciano)),
      horizontal: true,
      ancla: anclaGrafica(porCategoria.filaTitulo, 16),
    }),
  );
  fila = Math.max(fila, porCategoria.filaTitulo + 17);

  // 4.3 Lugar (edificios 1–10 y zonas abiertas)
  const numeros = Object.keys(buildingNames).length
    ? Object.keys(buildingNames)
        .map(Number)
        .sort((a, b) => a - b)
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const lugares = [
    ...numeros.map((n) => ({
      etiqueta: `Edificio ${n}`,
      f: `COUNTIF(${R('D')},${n})`,
      v: filas.filter((r) => r.edificioNumber === n).length,
    })),
    { etiqueta: 'Zonas abiertas', f: `COUNTIF(${R('E')},"?*")`, v: filas.filter((r) => !r.edificioNumber).length },
  ];
  const porLugar = tabla('Reportes por lugar', { encabezado: 'Lugar', items: lugares });
  const maxLugar = Math.max(1, ...lugares.map((l) => l.v));
  graficas.push(
    graficaBarras({
      titulo: 'Reportes por lugar',
      cats: rangoResumen('B', porLugar),
      vals: rangoResumen('D', porLugar),
      etiquetas: lugares.map((l) => l.etiqueta.replace('Edificio ', 'Edif. ')),
      valores: lugares.map((l) => l.v),
      colores: lugares.map((l) => (l.v >= maxLugar * 0.6 && l.v > 0 ? C.rojo : l.v > 0 ? C.naranja : C.borde)),
      horizontal: false,
      ancla: anclaGrafica(porLugar.filaTitulo, 16),
    }),
  );
  fila = Math.max(fila, porLugar.filaTitulo + 17);

  // 4.4 Últimas 8 semanas (lunes a domingo)
  const lunes = inicioSemana(ahora);
  const semanas = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(lunes);
    d.setDate(d.getDate() - i * 7);
    semanas.push(d);
  }
  const porSemana = tabla(
    'Reportes por semana (últimas 8)',
    {
      encabezado: 'Semana del',
      items: semanas.map((d, i) => {
        const filaItem = fila + 2 + i; // fila donde quedará esta semana
        const desde = d.getTime();
        const hasta = desde + 7 * 86400000;
        return {
          fecha: d,
          f: `COUNTIFS(${R('B')},">="&B${filaItem},${R('B')},"<"&(B${filaItem}+7))`,
          v: filas.filter((r) => {
            const t = fechaLocal(r.createdAt)?.getTime();
            return t >= desde && t < hasta;
          }).length,
        };
      }),
    },
    false,
  );
  graficas.push(
    graficaLinea({
      titulo: 'Reportes por semana',
      cats: rangoResumen('B', porSemana),
      vals: rangoResumen('D', porSemana),
      etiquetas: semanas.map((d) => `${d.getDate()}/${d.getMonth() + 1}`),
      valores: semanas.map((d) => {
        const desde = d.getTime();
        return filas.filter((r) => {
          const t = fechaLocal(r.createdAt)?.getTime();
          return t >= desde && t < desde + 7 * 86400000;
        }).length;
      }),
      color: C.magenta,
      ancla: anclaGrafica(porSemana.filaTitulo, 15),
    }),
  );
  fila = Math.max(fila, porSemana.filaTitulo + 16);

  hoja.unir(`B${fila}:M${fila}`);
  hoja.texto(
    `B${fila}`,
    'Los números de esta hoja son fórmulas que leen la hoja "Reportes": si corriges o borras una fila allá, este resumen y las gráficas se actualizan solos.',
    s.nota,
  );

  const xml = hoja.xml({
    columnas: hoja.anchos,
    cuadricula: false,
    horizontal: true,
    colorPestana: C.noche,
    dibujo: true,
    seleccion: 'B2',
  });
  return { xml, graficas };
}

/** Rango de una columna de una tabla del Resumen, para las gráficas. */
function rangoResumen(col, t) {
  return `Resumen!$${col}$${t.inicio}:$${col}$${t.fin}`;
}

/** Las gráficas van a la derecha de su tabla (columnas G a M). */
function anclaGrafica(filaTitulo, filas) {
  return { col1: 6, fila1: filaTitulo - 1, col2: 13, fila2: filaTitulo - 1 + filas };
}

function calcularKpis(filas) {
  const cuenta = (e) => filas.filter((r) => r.estado === e).length;
  const dias = filas
    .filter((r) => r.estado === 'resuelto' && r.resolvedAt)
    .map((r) => serial(r.resolvedAt) - serial(r.createdAt))
    .filter((d) => d >= 0);
  return {
    recibido: cuenta('recibido'),
    revision: cuenta('revision'),
    proceso: cuenta('proceso'),
    resuelto: cuenta('resuelto'),
    urgentes: filas.filter((r) => r.estado === 'recibido' && r.prioridad === 'alta').length,
    promedio: dias.length ? redondear(dias.reduce((a, b) => a + b, 0) / dias.length, 2) : 0,
  };
}

// ---------------------------------------------------------------------------
// 5) Hoja "Notas"
// ---------------------------------------------------------------------------

function construirNotas(est, opciones, total, ahora) {
  const hoja = new Hoja();
  const titulo = est.id({ fuente: { tam: 14, negrita: true, color: C.noche } });
  const negrita = est.id({ fuente: { tam: 10, negrita: true }, vertical: 'top' });
  const texto = est.id({ fuente: { tam: 10 }, ajustar: true, vertical: 'top' });
  const lineas = [
    ['Archivo', `Exportado del panel de administración de POLIMAP el ${fechaLarga(ahora)}.`],
    ['Filtros', opciones.filtros || 'Ninguno: incluye todos los reportes.'],
    ['Reportes incluidos', String(total)],
    [
      'Sin atender',
      'Reportes con estado "Recibido". Los urgentes son los de prioridad alta (fugas y riesgos entran así automáticamente).',
    ],
    [
      'Días para resolver',
      'Columna M de "Reportes": fecha de "Resuelto el" menos la fecha del reporte. El promedio solo cuenta los resueltos.',
    ],
    ['Por semana', 'Cada semana va de lunes a domingo; la fecha es el lunes.'],
    ['Lugar', '"Zonas abiertas" son los reportes sin edificio (Explanada, canchas, etc.).'],
    [
      'Apoyos',
      'Alumnos que se sumaron al reporte con "A mí también me pasa" (sin contar a quien lo envió). Con 5 apoyos sube solo a urgente.',
    ],
    ['Enviado por', 'Si el alumno marcó "anónimo", aparece como Anónimo y no se exporta su nombre ni su correo.'],
    [
      'Privacidad',
      'Este archivo contiene datos de alumnos. Compártelo solo con el personal que atiende las incidencias.',
    ],
  ];
  hoja.texto('B2', 'Notas del reporte', titulo);
  hoja.alto(2, 24);
  lineas.forEach(([k, v], i) => {
    hoja.texto(`B${4 + i}`, k, negrita);
    hoja.texto(`C${4 + i}`, v, texto);
    hoja.alto(4 + i, v.length > 80 ? 30 : 16);
  });
  return hoja.xml({ columnas: [2, 20, 90], cuadricula: false, colorPestana: C.grisClaro });
}

// ---------------------------------------------------------------------------
// 6) Gráficas (DrawingML de Excel)
// ---------------------------------------------------------------------------

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function envolverGrafica(titulo, plotArea, leyenda = '') {
  return {
    xml:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
      `<c:roundedCorners val="0"/>` +
      `<c:chart>${tituloGrafica(titulo)}<c:autoTitleDeleted val="0"/>${plotArea}${leyenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
      `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${C.borde}"/></a:solidFill></a:ln></c:spPr>` +
      `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="${C.gris}"/></a:solidFill><a:latin typeface="${FUENTE}"/></a:defRPr></a:pPr><a:endParaRPr lang="es-MX"/></a:p></c:txPr>` +
      `</c:chartSpace>`,
  };
}

function tituloGrafica(texto) {
  return (
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr>` +
    `<a:r><a:rPr lang="es-MX" sz="1200" b="1"><a:solidFill><a:srgbClr val="${C.noche}"/></a:solidFill><a:latin typeface="${FUENTE}"/></a:rPr><a:t>${esc(texto)}</a:t></a:r></a:p></c:rich></c:tx>` +
    `<c:overlay val="0"/></c:title>`
  );
}

function serieXml({ titulo, cats, vals, etiquetas, valores, colores, color, conPuntos = true, linea = false }) {
  const puntos =
    conPuntos && colores
      ? colores
          .map(
            (col, i) =>
              `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
          )
          .join('')
      : '';
  const spSerie = linea
    ? `<c:spPr><a:ln w="31750" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr>` +
      `<c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:marker>`
    : color
      ? `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr>`
      : '';
  return (
    `<c:ser><c:idx val="0"/><c:order val="0"/>` +
    `<c:tx><c:v>${esc(titulo)}</c:v></c:tx>` +
    spSerie +
    (linea ? '' : '<c:invertIfNegative val="0"/>') +
    puntos +
    `<c:cat><c:strRef><c:f>${esc(cats)}</c:f><c:strCache><c:ptCount val="${etiquetas.length}"/>` +
    etiquetas.map((e, i) => `<c:pt idx="${i}"><c:v>${esc(e)}</c:v></c:pt>`).join('') +
    `</c:strCache></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${esc(vals)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${valores.length}"/>` +
    valores.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('') +
    `</c:numCache></c:numRef></c:val>` +
    (linea ? '<c:smooth val="0"/>' : '') +
    `</c:ser>`
  );
}

function etiquetasDatos({ posicion, porcentaje = false, color = C.noche }) {
  return (
    `<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>` +
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${FUENTE}"/></a:defRPr></a:pPr><a:endParaRPr lang="es-MX"/></a:p></c:txPr>` +
    (posicion ? `<c:dLblPos val="${posicion}"/>` : '') +
    `<c:showLegendKey val="0"/><c:showVal val="${porcentaje ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${porcentaje ? 1 : 0}"/><c:showBubbleSize val="0"/>` +
    `</c:dLbls>`
  );
}

function ejes(idCat, idVal, { horizontal = false, enteros = true } = {}) {
  const linea = `<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${C.borde}"/></a:solidFill></a:ln></c:spPr>`;
  return (
    `<c:catAx><c:axId val="${idCat}"/><c:scaling><c:orientation val="${horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    linea +
    `<c:crossAx val="${idVal}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="${idVal}"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="${horizontal ? 1 : 0}"/>` +
    `<c:axPos val="${horizontal ? 'b' : 'l'}"/>` +
    `<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="${C.fondo}"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>` +
    `<c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>` +
    `<c:crossAx val="${idCat}"/><c:crosses val="${horizontal ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/>` +
    (enteros ? '<c:majorUnit val="1"/>' : '') +
    `</c:valAx>`
  );
}

function graficaDona({ titulo, cats, vals, etiquetas, valores, colores, ancla }) {
  const plot =
    `<c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/>` +
    serieXml({ titulo, cats, vals, etiquetas, valores, colores }).replace(
      '</c:ser>',
      `${etiquetasDatos({ porcentaje: true, color: 'FFFFFF' })}</c:ser>`,
    ) +
    `<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>` +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>`;
  const leyenda = `<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>`;
  return { ...envolverGrafica(titulo, plot, leyenda), ancla };
}

function graficaBarras({ titulo, cats, vals, etiquetas, valores, colores, horizontal, ancla }) {
  const max = Math.max(1, ...valores);
  const plot =
    `<c:plotArea><c:layout/><c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
    serieXml({ titulo, cats, vals, etiquetas, valores, colores, color: C.ciano }).replace(
      '</c:ser>',
      `${etiquetasDatos({ posicion: 'outEnd' })}</c:ser>`,
    ) +
    `<c:gapWidth val="${horizontal ? 45 : 60}"/><c:axId val="1001"/><c:axId val="1002"/></c:barChart>` +
    ejes(1001, 1002, { horizontal, enteros: max <= 12 }) +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>`;
  return { ...envolverGrafica(titulo, plot), ancla };
}

function graficaLinea({ titulo, cats, vals, etiquetas, valores, color, ancla }) {
  const max = Math.max(1, ...valores);
  const plot =
    `<c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>` +
    serieXml({ titulo, cats, vals, etiquetas, valores, color, conPuntos: false, linea: true }).replace(
      '<c:smooth val="0"/>',
      `${etiquetasDatos({ posicion: 't' })}<c:smooth val="0"/>`,
    ) +
    `<c:marker val="1"/><c:axId val="2001"/><c:axId val="2002"/></c:lineChart>` +
    ejes(2001, 2002, { enteros: max <= 12 }) +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>`;
  return { ...envolverGrafica(titulo, plot), ancla };
}

function drawingXml(graficas) {
  const anclas = graficas
    .map(
      (g, i) =>
        `<xdr:twoCellAnchor editAs="oneCell">` +
        `<xdr:from><xdr:col>${g.ancla.col1}</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>${g.ancla.fila1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${g.ancla.col2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.ancla.fila2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfica ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
        `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" r:id="rId${i + 1}"/></a:graphicData></a:graphic>` +
        `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`,
    )
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}" xmlns:r="${NS_R}">${anclas}</xdr:wsDr>`
  );
}

// ---------------------------------------------------------------------------
// 7) Hoja de cálculo: celdas, filas, columnas
// ---------------------------------------------------------------------------

class Hoja {
  constructor() {
    this.celdas = new Map(); // "B5" → { fila, col, xml, estilo }
    this.altos = new Map();
    this.uniones = [];
    this.anchos = [];
  }

  poner(ref, contenido, estilo, tipo = '') {
    const { fila, col } = posicion(ref);
    const t = tipo ? ` t="${tipo}"` : '';
    const s = estilo ? ` s="${estilo}"` : '';
    this.celdas.set(ref, { fila, col, estilo, xml: `<c r="${ref}"${s}${t}>${contenido}</c>` });
  }
  texto(ref, valor, estilo) {
    if (valor === '' || valor == null) return this.vacia(ref, estilo);
    this.poner(ref, `<is><t xml:space="preserve">${esc(limpiar(valor))}</t></is>`, estilo, 'inlineStr');
  }
  numero(ref, valor, estilo) {
    this.poner(ref, `<v>${Number(valor)}</v>`, estilo);
  }
  fecha(ref, valor, estilo) {
    const n = valor instanceof Date ? serialDeFecha(valor) : serial(valor);
    if (n == null) return this.vacia(ref, estilo);
    this.poner(ref, `<v>${redondear(n, 6)}</v>`, estilo);
  }
  /** Fórmula + valor ya calculado (para que se vea bien aunque el programa no recalcule). */
  formula(ref, f, valor, estilo) {
    let v = '';
    let tipo = '';
    if (typeof valor === 'string') {
      tipo = 'str';
      v = valor === '' ? '' : `<v>${esc(valor)}</v>`;
    } else if (valor != null && !Number.isNaN(valor)) {
      v = `<v>${valor}</v>`;
    }
    this.poner(ref, `<f>${esc(f)}</f>${v}`, estilo, tipo);
  }
  vacia(ref, estilo) {
    const { fila, col } = posicion(ref);
    this.celdas.set(ref, { fila, col, estilo, xml: estilo ? `<c r="${ref}" s="${estilo}"/>` : `<c r="${ref}"/>` });
  }
  estiloDe(ref) {
    return this.celdas.get(ref)?.estilo;
  }
  alto(fila, puntos) {
    this.altos.set(fila, puntos);
  }
  unir(rango) {
    this.uniones.push(rango);
  }

  xml({
    columnas = [],
    congelar,
    filtro,
    cuadricula = true,
    horizontal = false,
    colorPestana,
    dibujo = false,
    seleccion,
  } = {}) {
    const porFila = new Map();
    for (const c of this.celdas.values()) {
      if (!porFila.has(c.fila)) porFila.set(c.fila, []);
      porFila.get(c.fila).push(c);
    }
    for (const f of this.altos.keys()) if (!porFila.has(f)) porFila.set(f, []);
    const filasXml = [...porFila.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([f, celdas]) => {
        const alto = this.altos.get(f);
        const attr = alto ? ` ht="${alto}" customHeight="1"` : '';
        return `<row r="${f}"${attr}>${celdas
          .sort((a, b) => a.col - b.col)
          .map((c) => c.xml)
          .join('')}</row>`;
      })
      .join('');

    const pane = congelar
      ? `<pane ySplit="${congelar.fila - 1}" topLeftCell="A${congelar.fila}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${congelar.fila}" sqref="A${congelar.fila}"/>`
      : seleccion
        ? `<selection activeCell="${seleccion}" sqref="${seleccion}"/>`
        : '';
    const cols = columnas.length
      ? `<cols>${columnas.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_R}">` +
      `<sheetPr>${colorPestana ? `<tabColor rgb="FF${colorPestana}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>` +
      `<sheetViews><sheetView workbookViewId="0"${cuadricula ? '' : ' showGridLines="0"'}${congelar ? '' : ''}>${pane}</sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      cols +
      `<sheetData>${filasXml}</sheetData>` +
      (filtro ? `<autoFilter ref="${filtro}"/>` : '') +
      (this.uniones.length
        ? `<mergeCells count="${this.uniones.length}">${this.uniones.map((u) => `<mergeCell ref="${u}"/>`).join('')}</mergeCells>`
        : '') +
      `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
      `<pageSetup orientation="${horizontal ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>` +
      (dibujo ? `<drawing r:id="rId1"/>` : '') +
      `</worksheet>`
    );
  }
}

// ---------------------------------------------------------------------------
// 8) Estilos (fuentes, rellenos, bordes y formatos) sin repetir
// ---------------------------------------------------------------------------

class Estilos {
  constructor() {
    this.fuentes = [`<font><sz val="10"/><color rgb="FF${C.texto}"/><name val="${FUENTE}"/><family val="2"/></font>`];
    this.rellenos = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
    ];
    this.bordes = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.formatos = []; // { id, codigo }
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.cache = new Map();
  }

  indice(lista, xml) {
    let i = lista.indexOf(xml);
    if (i === -1) {
      lista.push(xml);
      i = lista.length - 1;
    }
    return i;
  }

  /** Recibe una descripción simple y regresa el número de estilo para la celda. */
  id(d) {
    const clave = JSON.stringify(d);
    if (this.cache.has(clave)) return this.cache.get(clave);

    const f = d.fuente || {};
    const fuente = this.indice(
      this.fuentes,
      `<font>${f.negrita ? '<b/>' : ''}${f.cursiva ? '<i/>' : ''}<sz val="${f.tam || 10}"/><color rgb="FF${f.color || C.texto}"/><name val="${FUENTE}"/><family val="2"/></font>`,
    );
    const relleno = d.relleno
      ? this.indice(
          this.rellenos,
          `<fill><patternFill patternType="solid"><fgColor rgb="FF${d.relleno}"/><bgColor indexed="64"/></patternFill></fill>`,
        )
      : 0;
    const b = d.borde || {};
    const lado = (nombre, v) =>
      v ? `<${nombre} style="${v[1]}"><color rgb="FF${v[0]}"/></${nombre}>` : `<${nombre}/>`;
    const borde = d.borde
      ? this.indice(
          this.bordes,
          `<border>${lado('left', b.izq)}${lado('right', b.der)}${lado('top', b.arriba)}${lado('bottom', b.abajo)}<diagonal/></border>`,
        )
      : 0;
    let formato = 0;
    if (d.formato) {
      const existente = this.formatos.find((x) => x.codigo === d.formato);
      if (existente) formato = existente.id;
      else {
        formato = 164 + this.formatos.length;
        this.formatos.push({ id: formato, codigo: d.formato });
      }
    }
    const alin =
      d.horizontal || d.vertical || d.ajustar || d.indent
        ? `<alignment${d.horizontal ? ` horizontal="${d.horizontal}"` : ''}${d.vertical ? ` vertical="${d.vertical}"` : ''}${d.ajustar ? ' wrapText="1"' : ''}${d.indent ? ` indent="${d.indent}"` : ''}/>`
        : '';
    const xf =
      `<xf numFmtId="${formato}" fontId="${fuente}" fillId="${relleno}" borderId="${borde}" xfId="0"` +
      `${formato ? ' applyNumberFormat="1"' : ''} applyFont="1"${relleno ? ' applyFill="1"' : ''}${borde ? ' applyBorder="1"' : ''}${alin ? ' applyAlignment="1">' + alin + '</xf>' : '/>'}`;
    const i = this.indice(this.xfs, xf);
    this.cache.set(clave, i);
    return i;
  }

  xml() {
    const numFmts = this.formatos.length
      ? `<numFmts count="${this.formatos.length}">${this.formatos.map((x) => `<numFmt numFmtId="${x.id}" formatCode="${esc(x.codigo)}"/>`).join('')}</numFmts>`
      : '';
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      numFmts +
      `<fonts count="${this.fuentes.length}">${this.fuentes.join('')}</fonts>` +
      `<fills count="${this.rellenos.length}">${this.rellenos.join('')}</fills>` +
      `<borders count="${this.bordes.length}">${this.bordes.join('')}</borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`
    );
  }
}

// ---------------------------------------------------------------------------
// 9) Archivos fijos del paquete .xlsx
// ---------------------------------------------------------------------------

const TIPO_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const TIPO_CHART = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

function rels(lista) {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    lista.map(([id, tipo, destino]) => `<Relationship Id="${id}" Type="${tipo}" Target="${destino}"/>`).join('') +
    `</Relationships>`
  );
}

function relsRaiz() {
  return rels([
    ['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', 'xl/workbook.xml'],
    [
      'rId2',
      'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
      'docProps/core.xml',
    ],
    [
      'rId3',
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
      'docProps/app.xml',
    ],
  ]);
}

function workbookRels() {
  const base = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  return rels([
    ['rId1', `${base}worksheet`, 'worksheets/sheet1.xml'],
    ['rId2', `${base}worksheet`, 'worksheets/sheet2.xml'],
    ['rId3', `${base}worksheet`, 'worksheets/sheet3.xml'],
    ['rId4', `${base}styles`, 'styles.xml'],
  ]);
}

function workbookXml(rango) {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_R}">` +
    `<bookViews><workbookView activeTab="0"/></bookViews>` +
    `<sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/><sheet name="Reportes" sheetId="2" r:id="rId2"/><sheet name="Notas" sheetId="3" r:id="rId3"/></sheets>` +
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">Reportes!$A$${FILA_ENCABEZADO}:$P$${rango.ultima}</definedName>` +
    `<definedName name="_xlnm.Print_Titles" localSheetId="1">Reportes!$${FILA_ENCABEZADO}:$${FILA_ENCABEZADO}</definedName></definedNames>` +
    // fullCalcOnLoad: Excel recalcula todas las fórmulas al abrir el archivo.
    `<calcPr calcId="191029" fullCalcOnLoad="1"/>` +
    `</workbook>`
  );
}

function tiposDeContenido(numGraficas) {
  const base = 'application/vnd.openxmlformats-officedocument';
  let charts = '';
  for (let i = 1; i <= numGraficas; i++) {
    charts += `<Override PartName="/xl/charts/chart${i}.xml" ContentType="${base}.drawingml.chart+xml"/>`;
  }
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="${base}.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${base}.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="${base}.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet3.xml" ContentType="${base}.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${base}.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/xl/drawings/drawing1.xml" ContentType="${base}.drawing+xml"/>` +
    charts +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="${base}.extended-properties+xml"/>` +
    `</Types>`
  );
}

function appXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>POLIMAP</Application></Properties>`
  );
}

function coreXml(ahora, autor) {
  const iso = ahora.toISOString().replace(/\.\d+Z$/, 'Z');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>POLIMAP · Reportes de incidencias</dc:title><dc:creator>${esc(autor || 'Panel POLIMAP')}</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    `</cp:coreProperties>`
  );
}

// ---------------------------------------------------------------------------
// 10) ZIP sencillo (sin compresión) — un .xlsx es un ZIP
// ---------------------------------------------------------------------------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(archivos) {
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

// ---------------------------------------------------------------------------
// 11) Ayudantes
// ---------------------------------------------------------------------------

/** Escapa &, <, > y comillas para XML. */
function esc(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Quita caracteres de control que rompen el XML (los pueden traer los textos de los alumnos). */
function limpiar(texto) {
  // eslint-disable-next-line no-control-regex
  return String(texto).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** 1 → A, 27 → AA */
function letra(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function posicion(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { fila: Number(m[2]), col };
}

/** "2026-10-07T13:05:00" (hora de Guadalajara) → Date local sin cambiar la hora. */
function fechaLocal(iso) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

/** Fecha de Excel: días desde el 30/12/1899 (con la hora como fracción). */
function serialDeFecha(d) {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

function serial(iso) {
  const d = fechaLocal(iso);
  return d ? serialDeFecha(d) : null;
}

function inicioSemana(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes
  return d;
}

function redondear(n, decimales) {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

function fechaLarga(d) {
  return d.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
}

function fechaArchivo(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
