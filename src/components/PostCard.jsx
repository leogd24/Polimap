// src/components/PostCard.jsx — Responsable: Alexis (sección de Avisos de Leo)
// =====================================================================
// Un aviso como POST de Instagram:
//   - encabezado: logo POLIMAP, "Avisos del Poli · hace 2 h", tipo y si está fijado;
//   - fotos en carrusel (se deslizan) o, si no trae fotos, un panel de color
//     con el ícono y el título;
//   - botón para descargar la foto que se está viendo;
//   - corazón (también con doble toque en la foto), comentarios y compartir;
//   - "123 Me gusta", el título y el texto (con "más") y "Ver los 5 comentarios";
//   - archivos adjuntos (PDF con vista previa; Word/Excel/PowerPoint) con
//     botón de descargar (src/components/Adjuntos.jsx y PdfViewer.jsx);
//   - encuesta rápida si el aviso trae una (src/components/EncuestaAviso.jsx).
//
// Props:
//   notice     el aviso (ver getNotices() en src/lib/api.js)
//   user       usuario con sesión o null (invitado)
//   onLike(notice)          → dar o quitar me gusta (lo hace quien lo usa)
//   onOpenComments(notice)  → abrir la hoja de comentarios
//   onRequestLogin()        → invitado que quiere dar me gusta o votar
//   onPollChange(id, poll)  → la encuesta cambió (votaste); opcional
//   highlight  true = viene de una notificación (se marca en dorado)
//   enHoja     true = dentro de la hoja de Inicio (sin borde ni encabezado: la hoja ya los tiene)
// =====================================================================
import { useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from './Icon.jsx';
import PolimapLogo from './PolimapLogo.jsx';
import Adjuntos from './Adjuntos.jsx';
import EncuestaAviso from './EncuestaAviso.jsx';
import PdfViewer from './PdfViewer.jsx';
import { haceCorto, fechaLarga } from '../lib/tiempo.js';
import { urlDescargaFoto } from '../lib/archivos.js';

// Tipo de aviso → etiqueta, ícono y color (mismos colores del resto de la app).
export const TIPOS_AVISO = {
  urgente: { label: 'Urgente', icon: 'warning', color: colors.crimson, dark: colors.crimsonDark, tint: colors.crimsonTint },
  evento: { label: 'Evento', icon: 'event', color: colors.magenta, dark: colors.magentaDark, tint: colors.magentaTint },
  general: { label: 'Aviso', icon: 'campaign', color: colors.cyan, dark: colors.cyanDark, tint: colors.cyanTint },
};

export default function PostCard({ notice, user, onLike, onOpenComments, onRequestLogin, onPollChange, highlight = false, enHoja = false }) {
  const tipo = TIPOS_AVISO[notice.type] ?? TIPOS_AVISO.general;
  const [foto, setFoto] = useState(0); // foto visible del carrusel
  const [verMas, setVerMas] = useState(false);
  const [corazon, setCorazon] = useState(false); // animación del doble toque
  const [mensaje, setMensaje] = useState('');
  const [pdf, setPdf] = useState(null); // adjunto PDF abierto en el visor
  const carrusel = useRef(null);
  const ultimoToque = useRef(0);

  function like() {
    if (!user) {
      setMensaje('Inicia sesión para dar me gusta');
      setTimeout(() => setMensaje(''), 2500);
      return;
    }
    onLike(notice);
  }

  // Doble toque en la foto = me gusta (como Instagram). Nunca lo quita.
  function toqueFoto() {
    const ahora = Date.now();
    if (ahora - ultimoToque.current < 300) {
      setCorazon(true);
      setTimeout(() => setCorazon(false), 800);
      if (user && !notice.liked) onLike(notice);
      else if (!user) like();
    }
    ultimoToque.current = ahora;
  }

  async function compartir() {
    const url = `${window.location.origin}/?aviso=${notice.id}`;
    try {
      if (navigator.share) await navigator.share({ title: notice.title, text: notice.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setMensaje('Enlace copiado');
        setTimeout(() => setMensaje(''), 2000);
      }
    } catch {
      // El usuario canceló: no pasa nada.
    }
  }

  const largo = (notice.content || '').length > 140;

  return (
    <article
      className="relative overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        borderRadius: enHoja ? 0 : 'var(--radius-card)',
        border: enHoja ? 'none' : highlight ? `3px solid ${colors.gold}` : `1px solid ${colors.border}`,
      }}
      aria-label={`Aviso: ${notice.title}`}
    >
      <style>{ESTILOS}</style>
      {/* Encabezado (en la hoja de Inicio no hace falta: la hoja ya dice qué es) */}
      <header className={`items-center gap-3 px-4 py-3 ${enHoja ? 'hidden' : 'flex'}`}>
        <span
          className="flex shrink-0 items-center justify-center rounded-full p-[2px]"
          style={{ background: `conic-gradient(${colors.cyan}, ${colors.magenta}, ${colors.gold}, ${colors.green}, ${colors.cyan})` }}
        >
          <span className="flex rounded-full p-[2px]" style={{ backgroundColor: colors.surface }}>
            <PolimapLogo size={32} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-black" style={{ color: colors.textPrimary }}>
            POLIMAP
            <Icon name="verified" size={16} color={colors.cyan} />
          </div>
          <div className="text-xs" style={{ color: colors.textMuted }}>
            Avisos del Poli · {haceCorto(notice.createdAt || notice.startDate)}
          </div>
        </div>
        {notice.pinned && <Icon name="push_pin" size={18} color={colors.textSecondary} />}
        <span
          className="inline-flex items-center gap-1 px-2 py-[3px] text-[0.6875rem] font-black"
          style={{ backgroundColor: tipo.tint, color: tipo.dark, borderRadius: 8 }}
        >
          <Icon name={tipo.icon} size={14} color={tipo.dark} />
          {tipo.label}
        </span>
      </header>

      {/* Fotos (carrusel) o panel de color */}
      <div className="relative select-none" onClick={toqueFoto}>
        {notice.photos?.length ? (
          <>
            <div
              ref={carrusel}
              className="pc-carrusel flex aspect-square w-full snap-x snap-mandatory overflow-x-auto"
              style={{ backgroundColor: colors.blueTint }}
              onScroll={(e) => setFoto(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            >
              {notice.photos.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={i === 0 ? notice.title : ''}
                  className="h-full w-full shrink-0 snap-center object-cover"
                  loading="lazy"
                  draggable="false"
                />
              ))}
            </div>
            {/* Descargar la foto que se está viendo */}
            <a
              href={urlDescargaFoto(notice.photos[foto] ?? notice.photos[0])}
              download
              onClick={(e) => e.stopPropagation()}
              aria-label="Descargar esta foto"
              title="Descargar foto"
              className="tappable absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: alpha(colors.blueDeep, 0.7) }}
            >
              <Icon name="download" size={20} color={colors.white} />
            </a>
            {notice.photos.length > 1 && (
              <>
                <span
                  className="absolute right-3 top-3 px-2 py-[2px] text-xs font-bold"
                  style={{ backgroundColor: alpha(colors.blueDeep, 0.7), color: colors.white, borderRadius: 999 }}
                >
                  {foto + 1}/{notice.photos.length}
                </span>
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-[5px]">
                  {notice.photos.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      aria-label={`Foto ${i + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        carrusel.current?.scrollTo({ left: i * carrusel.current.clientWidth, behavior: 'smooth' });
                      }}
                      className="h-[7px] rounded-full border-0 p-0 transition-all"
                      style={{ width: i === foto ? 16 : 7, backgroundColor: i === foto ? colors.white : alpha(colors.white, 0.6) }}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          // Sin fotos: panel de color con el ícono del tipo de aviso
          <div
            className="flex min-h-[170px] flex-col justify-end gap-2 px-5 py-5"
            style={{ background: `linear-gradient(135deg, ${colors.blue}, ${mezcla(tipo.color, colors.blue, 0.55)})` }}
          >
            <span
              className="flex h-11 w-11 items-center justify-center"
              style={{ backgroundColor: alpha(colors.white, 0.16), borderRadius: 14 }}
            >
              <Icon name={tipo.icon} color={colors.white} />
            </span>
            <div className="text-xl font-black leading-tight" style={{ color: colors.white }}>
              {notice.title}
            </div>
          </div>
        )}
        {corazon && (
          <span className="pc-corazon pointer-events-none absolute inset-0 flex items-center justify-center">
            <Icon name="favorite" size={96} color={colors.white} />
          </span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <AccionBoton
          icon="favorite"
          filled={notice.liked}
          color={notice.liked ? colors.crimson : colors.textPrimary}
          label={notice.liked ? 'Ya no me gusta' : 'Me gusta'}
          onClick={like}
          pop={notice.liked}
        />
        <AccionBoton icon="mode_comment" label="Comentarios" onClick={() => onOpenComments(notice)} color={colors.textPrimary} />
        <AccionBoton icon="send" label="Compartir" onClick={compartir} color={colors.textPrimary} />
        {mensaje && (
          <span className="ml-auto mr-2 text-xs font-bold" style={{ color: colors.textSecondary }} role="status">
            {mensaje}
          </span>
        )}
      </div>

      {/* Texto */}
      <div className="px-4 pb-4">
        <div className="text-sm font-black" style={{ color: colors.textPrimary }}>
          {notice.likes} {notice.likes === 1 ? 'Me gusta' : 'Me gusta'}
        </div>
        {notice.photos?.length ? (
          <div className="mt-1 text-[0.9375rem] font-black leading-snug" style={{ color: colors.textPrimary }}>
            {notice.title}
          </div>
        ) : null}
        {notice.content && (
          <p
            className={`m-0 mt-1 whitespace-pre-line text-sm ${verMas ? '' : 'line-clamp-3'}`}
            style={{ color: colors.textSecondary, lineHeight: 1.45 }}
          >
            {notice.content}
          </p>
        )}
        {largo && !verMas && (
          <button
            type="button"
            onClick={() => setVerMas(true)}
            className="border-0 bg-transparent p-0 text-sm font-bold"
            style={{ color: colors.textMuted }}
          >
            más
          </button>
        )}
        {notice.poll && (
          <EncuestaAviso avisoId={notice.id} poll={notice.poll} user={user} onChange={(p) => onPollChange?.(notice.id, p)} />
        )}
        <Adjuntos files={notice.files} onOpenPdf={setPdf} />
        {notice.allowComments || notice.comments ? (
          <button
            type="button"
            onClick={() => onOpenComments(notice)}
            className="mt-2 block border-0 bg-transparent p-0 text-left text-sm"
            style={{ color: colors.textMuted }}
          >
            {notice.comments
              ? `Ver ${notice.comments === 1 ? 'el comentario' : `los ${notice.comments} comentarios`}`
              : 'Sé el primero en comentar'}
          </button>
        ) : (
          <div className="mt-2 text-xs" style={{ color: colors.textMuted }}>
            Comentarios desactivados
          </div>
        )}
        <div className="mt-1 text-[0.6875rem] uppercase" style={{ color: colors.textMuted, letterSpacing: 0.4 }}>
          {fechaLarga(notice.createdAt || notice.startDate)}
          {notice.endDate && notice.endDate !== notice.startDate ? ` · vigente hasta el ${fechaLarga(notice.endDate)}` : ''}
        </div>
      </div>
      {pdf && <PdfViewer archivo={pdf} onClose={() => setPdf(null)} />}
    </article>
  );
}

function AccionBoton({ icon, label, onClick, color, filled = false, pop = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={icon === 'favorite' ? filled : undefined}
      className={`tappable flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent ${pop ? 'pc-pop' : ''}`}
    >
      <Icon name={icon} size={26} filled={filled} weight={500} color={color} />
    </button>
  );
}

/** Mezcla de dos colores (a con peso t). */
function mezcla(a, b, t) {
  return `color-mix(in srgb, ${a} ${Math.round(t * 100)}%, ${b})`;
}

const ESTILOS = `
.pc-carrusel { scrollbar-width: none; }
.pc-carrusel::-webkit-scrollbar { display: none; }
.pc-corazon { animation: pc-corazon .8s ease both; filter: drop-shadow(0 4px 14px rgb(0 0 0 / .35)); }
@keyframes pc-corazon { 0% { transform: scale(.2); opacity: 0; } 20% { transform: scale(1.15); opacity: 1; } 35% { transform: scale(.95); } 50% { transform: scale(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: scale(1); } }
.pc-pop { animation: pc-pop .35s ease; }
@keyframes pc-pop { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .pc-corazon, .pc-pop { animation: none; } }
`;
