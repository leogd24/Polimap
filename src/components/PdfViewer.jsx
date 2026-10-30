// src/components/PdfViewer.jsx — Responsable: Alexis (sección de Avisos de Leo)
// =====================================================================
// Visor de PDF a pantalla completa (se abre al tocar "Ver" en un adjunto).
//   - Arriba: cerrar, nombre del archivo, "Página 2 de 5", acercar/alejar
//     y descargar.
//   - Las páginas se dibujan con pdf.js (src/lib/pdf.js) solo cuando están
//     cerca de la pantalla, así un PDF largo no traba el celular.
//   - Esc o el botón ← lo cierran.
//
// Props:
//   archivo  { name, url, download, size }  (un elemento de notice.files)
//   onClose()
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { abrirPdf, dibujarPagina, proporcionPagina } from '../lib/pdf.js';
import { pesoBonito } from '../lib/archivos.js';

const ZOOMS = [1, 1.5, 2, 3];
const MAX_ANCHO = 880; // en computadora la página no se estira de más

export default function PdfViewer({ archivo, onClose }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [proporcion, setProporcion] = useState(1.294); // carta vertical, mientras carga
  const [ancho, setAncho] = useState(0);
  const [zoom, setZoom] = useState(0); // índice de ZOOMS
  const [actual, setActual] = useState(1);
  const cuerpo = useRef(null);
  const cerrar = useRef(null);
  const paginas = useRef([]); // cajas de cada página (para saber cuál se ve)
  const alCerrar = useRef(onClose); // siempre la versión más nueva de onClose
  alCerrar.current = onClose;

  // 1) Abrir el PDF
  useEffect(() => {
    let vivo = true;
    abrirPdf(archivo.url)
      .then(async (d) => {
        const p = await proporcionPagina(d, 1);
        if (!vivo) return;
        setProporcion(p);
        setDoc(d);
      })
      .catch(() => vivo && setError('No se pudo abrir el PDF. Puedes descargarlo y verlo en tu celular.'));
    return () => {
      vivo = false;
    };
  }, [archivo.url]);

  // 2) Ancho disponible (cambia al girar el celular o cambiar el tamaño de la ventana)
  useEffect(() => {
    const el = cuerpo.current;
    const medir = () => setAncho(Math.min(el.clientWidth - 24, MAX_ANCHO));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 3) Esc para cerrar, sin scroll de fondo y el foco en "cerrar"
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && alCerrar.current();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, []);

  // Página actual = la que está a un tercio de la pantalla.
  function alHacerScroll() {
    const el = cuerpo.current;
    const linea = el.scrollTop + el.clientHeight / 3;
    let n = 1;
    paginas.current.forEach((caja, i) => {
      if (caja && caja.offsetTop <= linea) n = i + 1;
    });
    setActual(n);
  }

  // Al cambiar el zoom se queda en la misma página.
  function cambiarZoom(paso) {
    const nuevo = Math.max(0, Math.min(ZOOMS.length - 1, zoom + paso));
    if (nuevo === zoom) return;
    const pagina = actual;
    setZoom(nuevo);
    requestAnimationFrame(() => paginas.current[pagina - 1]?.scrollIntoView({ block: 'start' }));
  }

  const anchoPagina = Math.round(ancho * ZOOMS[zoom]);
  const total = doc?.numPages ?? 0;

  // Portal: se pinta directo en <body>, encima de todo, aunque el post
  // que lo abre esté dentro de algo con animación o recorte.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`PDF: ${archivo.name}`}
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ backgroundColor: colors.blueDeep }}
    >
      {/* Barra de arriba */}
      <header className="flex items-center gap-1 px-2 py-2 sm:px-4" style={{ color: colors.white, paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <BotonBarra botonRef={cerrar} icon="arrow_back" label="Cerrar" onClick={onClose} />
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-black">{archivo.name}</div>
          <div className="text-xs" style={{ color: alpha(colors.white, 0.7) }}>
            {total ? `Página ${actual} de ${total}` : error ? 'PDF' : 'Abriendo…'}
            {archivo.size ? ` · ${pesoBonito(archivo.size)}` : ''}
          </div>
        </div>
        <BotonBarra icon="zoom_out" label="Alejar" onClick={() => cambiarZoom(-1)} disabled={zoom === 0} />
        <span className="hidden w-11 text-center text-xs font-bold sm:inline" aria-live="polite">
          {Math.round(ZOOMS[zoom] * 100)}%
        </span>
        <BotonBarra icon="zoom_in" label="Acercar" onClick={() => cambiarZoom(1)} disabled={zoom === ZOOMS.length - 1} />
        <a
          href={archivo.download}
          download={archivo.name}
          className="tappable ml-1 flex h-10 items-center gap-1 px-3 text-sm font-black no-underline"
          style={{ borderRadius: 999, backgroundColor: colors.gold, color: colors.blueDeep }}
        >
          <Icon name="download" size={20} color={colors.blueDeep} />
          <span className="hidden sm:inline">Descargar</span>
        </a>
      </header>

      {/* Páginas */}
      <div ref={cuerpo} onScroll={alHacerScroll} className="flex-1 overflow-auto pb-8 pt-2" style={{ overscrollBehavior: 'contain' }}>
        {error && (
          <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-3 px-6 text-center" style={{ color: colors.white }}>
            <Icon name="picture_as_pdf" size={56} color={alpha(colors.white, 0.6)} />
            <p className="m-0 text-sm">{error}</p>
          </div>
        )}
        {!doc && !error && (
          <div className="mt-24 flex flex-col items-center gap-3" style={{ color: alpha(colors.white, 0.8) }}>
            <span className="pdfv-giro h-9 w-9 rounded-full" style={{ border: `3px solid ${alpha(colors.white, 0.25)}`, borderTopColor: colors.gold }} />
            <span className="text-sm font-bold">Abriendo PDF…</span>
          </div>
        )}
        {doc && anchoPagina > 0 && (
          <div className="flex flex-col items-center gap-3 px-3" style={{ width: Math.max(anchoPagina + 24, ancho + 24), margin: '0 auto' }}>
            {Array.from({ length: total }, (_, i) => (
              <Pagina
                key={i}
                registrar={(el) => (paginas.current[i] = el)}
                doc={doc}
                numero={i + 1}
                ancho={anchoPagina}
                proporcion={proporcion}
                raiz={cuerpo}
              />
            ))}
          </div>
        )}
      </div>
      <style>{`.pdfv-giro{animation:pdfv-giro .9s linear infinite}@keyframes pdfv-giro{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.pdfv-giro{animation-duration:3s}}`}</style>
    </div>,
    document.body
  );
}

/** Una página: guarda su lugar y se dibuja cuando se acerca a la pantalla. */
function Pagina({ registrar, doc, numero, ancho, proporcion, raiz }) {
  const caja = useRef(null);
  const lienzo = useRef(null);
  const [cerca, setCerca] = useState(numero <= 2);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    if (cerca) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { root: raiz.current, rootMargin: '900px 0px' });
    io.observe(caja.current);
    return () => io.disconnect();
  }, [cerca, raiz]);

  useEffect(() => {
    if (!cerca || !ancho) return undefined;
    let vivo = true;
    let tarea = null;
    // Se dibuja en un canvas NUEVO y luego se cambia por el anterior: así no
    // se mezclan dos dibujos si el zoom cambia a media carga.
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    dibujarPagina(doc, numero, canvas, ancho)
      .then((t) => {
        tarea = t;
        if (!vivo) t.cancel();
        return t.promise;
      })
      .then(() => {
        if (!vivo) return;
        lienzo.current?.replaceChildren(canvas);
        setLista(true);
      })
      .catch(() => {}); // cancelada: no pasa nada
    return () => {
      vivo = false;
      tarea?.cancel();
    };
  }, [cerca, ancho, doc, numero]);

  return (
    <div
      ref={(el) => {
        caja.current = el;
        registrar(el);
      }}
      className="relative shrink-0 overflow-hidden"
      style={{
        width: ancho,
        minHeight: lista ? undefined : Math.round(ancho * proporcion),
        backgroundColor: colors.white,
        borderRadius: 6,
        boxShadow: `0 6px 24px ${alpha(colors.blueDeep, 0.5)}`,
      }}
      aria-label={`Página ${numero}`}
    >
      <div ref={lienzo} />
      {!lista && (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: colors.textMuted }}>
          Página {numero}
        </span>
      )}
    </div>
  );
}

// (React 18 no deja pasar "ref" como prop normal; por eso se llama botonRef)
function BotonBarra({ botonRef, icon, label, onClick, disabled = false }) {
  return (
    <button
      ref={botonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="tappable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Icon name={icon} size={24} color={colors.white} />
    </button>
  );
}
