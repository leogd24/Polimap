// src/components/Adjuntos.jsx — Responsable: Alexis (sección de Avisos de Leo)
// =====================================================================
// Archivos adjuntos de un aviso, debajo del texto del post:
//   - PDF: miniatura de la primera página (se dibuja al llegar a la
//     pantalla), cuántas páginas tiene, botón "Ver" (abre el visor) y
//     "Descargar".
//   - Word, Excel y PowerPoint: ícono de color, nombre, peso y "Descargar"
//     (el navegador no los puede mostrar; se abren en la app del celular).
//
// Props:
//   files      notice.files → [{ name, ext, size, url, download }]
//   onOpenPdf(archivo)  → abrir el visor de PDF
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { colors } from '../styles/theme.js';
import Icon from './Icon.jsx';
import { tipoArchivo, pesoBonito } from '../lib/archivos.js';
import { abrirPdf, dibujarPagina } from '../lib/pdf.js';

export default function Adjuntos({ files = [], onOpenPdf }) {
  if (!files.length) return null;
  return (
    <section className="mt-3 flex flex-col gap-2" aria-label="Archivos adjuntos">
      <div className="flex items-center gap-1 text-xs font-black uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
        <Icon name="attach_file" size={16} color={colors.textMuted} />
        {files.length === 1 ? '1 archivo adjunto' : `${files.length} archivos adjuntos`}
      </div>
      {files.map((f) =>
        f.ext === 'pdf' ? <TarjetaPdf key={f.url} archivo={f} onOpen={() => onOpenPdf(f)} /> : <FilaArchivo key={f.url} archivo={f} />
      )}
    </section>
  );
}

/** PDF con miniatura de su primera página. */
function TarjetaPdf({ archivo, onOpen }) {
  const t = tipoArchivo('pdf');
  const [paginas, setPaginas] = useState(0);
  return (
    <div className="flex gap-3 p-2" style={{ borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.background }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver ${archivo.name}`}
        className="tappable relative shrink-0 overflow-hidden border-0 p-0"
        style={{ width: 84, height: 108, borderRadius: 10, backgroundColor: colors.surface, boxShadow: `0 1px 4px ${colors.border}` }}
      >
        <Miniatura url={archivo.url} ancho={84} onPaginas={setPaginas} />
        <span
          className="absolute bottom-1 left-1 px-[5px] py-[1px] text-[0.625rem] font-black"
          style={{ backgroundColor: t.color, color: colors.white, borderRadius: 5 }}
        >
          PDF
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <div>
          <div className="line-clamp-2 text-sm font-black leading-snug" style={{ color: colors.textPrimary, wordBreak: 'break-word' }}>
            {archivo.name}
          </div>
          <div className="mt-[2px] text-xs" style={{ color: colors.textMuted }}>
            PDF{paginas ? ` · ${paginas} ${paginas === 1 ? 'página' : 'páginas'}` : ''} · {pesoBonito(archivo.size)}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="tappable flex h-9 items-center gap-1 border-0 px-3 text-xs font-black"
            style={{ borderRadius: 999, backgroundColor: colors.blue, color: colors.white }}
          >
            <Icon name="visibility" size={18} color={colors.white} />
            Ver
          </button>
          <BotonDescargar archivo={archivo} />
        </div>
      </div>
    </div>
  );
}

/** Word / Excel / PowerPoint: ícono, nombre y descargar. */
function FilaArchivo({ archivo }) {
  const t = tipoArchivo(archivo.ext);
  return (
    <div className="flex items-center gap-3 p-2" style={{ borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.background }}>
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center" style={{ backgroundColor: t.tint, borderRadius: 12 }}>
        <Icon name={t.icon} size={26} color={t.dark} />
        <span
          className="absolute -bottom-1 -right-1 px-[4px] text-[0.5625rem] font-black uppercase"
          style={{ backgroundColor: t.solido, color: colors.white, borderRadius: 5 }}
        >
          {archivo.ext}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-black leading-snug" style={{ color: colors.textPrimary, wordBreak: 'break-word' }}>
          {archivo.name}
        </div>
        <div className="text-xs" style={{ color: colors.textMuted }}>
          {t.label} · {pesoBonito(archivo.size)}
        </div>
      </div>
      <BotonDescargar archivo={archivo} soloIcono />
    </div>
  );
}

function BotonDescargar({ archivo, soloIcono = false }) {
  return (
    <a
      href={archivo.download}
      download={archivo.name}
      aria-label={`Descargar ${archivo.name}`}
      title="Descargar"
      className={`tappable flex h-9 shrink-0 items-center justify-center gap-1 text-xs font-black no-underline ${soloIcono ? 'w-9' : 'px-3'}`}
      style={{ borderRadius: 999, border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
    >
      <Icon name="download" size={18} color={colors.textPrimary} />
      {!soloIcono && 'Descargar'}
    </a>
  );
}

/**
 * Primera página del PDF en chiquito. Solo se baja y dibuja cuando la
 * tarjeta aparece en pantalla (si nadie baja hasta ese aviso, no gasta datos).
 */
export function Miniatura({ url, ancho, onPaginas }) {
  const caja = useRef(null);
  const [estado, setEstado] = useState('esperando'); // esperando | cargando | lista | error

  useEffect(() => {
    if (estado !== 'esperando') return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setEstado('cargando'), { rootMargin: '300px' });
    io.observe(caja.current);
    return () => io.disconnect();
  }, [estado]);

  useEffect(() => {
    if (estado !== 'cargando') return undefined;
    let vivo = true;
    let tarea = null;
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    abrirPdf(url)
      .then((doc) => {
        if (vivo) onPaginas?.(doc.numPages);
        return dibujarPagina(doc, 1, canvas, ancho);
      })
      .then((t) => {
        tarea = t;
        if (!vivo) t.cancel();
        return t.promise;
      })
      .then(() => {
        if (!vivo) return;
        caja.current?.replaceChildren(canvas);
        setEstado('lista');
      })
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
      tarea?.cancel();
    };
  }, [estado, url, ancho]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div ref={caja} className="absolute inset-0" />
      {estado !== 'lista' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon name="picture_as_pdf" size={34} color={estado === 'error' ? colors.textMuted : colors.crimson} />
        </span>
      )}
    </>
  );
}
