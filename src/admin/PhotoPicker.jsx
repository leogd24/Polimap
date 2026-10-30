// src/admin/PhotoPicker.jsx — Responsable: Alexis
// Fotos de un aviso en el panel (hasta 5, como un carrusel de Instagram).
//   - "Agregar fotos": elige una o varias; cada una se achica con
//     compressImage() (de Katia) y se sube con uploadNoticePhoto().
//   - Flechas para cambiar el orden (la primera es la portada) y ✕ para quitar.
// Props: value (lista de URLs o nombres), onChange(lista), onError(mensaje)
import { useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import { compressImage } from '../lib/compressImage.js';
import { uploadNoticePhoto } from '../lib/api.js';

const MAX = 5;

export default function PhotoPicker({ value = [], onChange, onError }) {
  const input = useRef(null);
  const [subiendo, setSubiendo] = useState(0); // cuántas faltan

  async function agregar(files) {
    const lista = [...files].slice(0, MAX - value.length);
    if (files.length > lista.length) onError?.(`Máximo ${MAX} fotos por aviso.`);
    if (!lista.length) return;
    setSubiendo(lista.length);
    let nuevas = [...value];
    for (const f of lista) {
      try {
        if (!f.type.startsWith('image/')) throw new Error(`"${f.name}" no es una imagen`);
        const chica = await compressImage(f);
        const r = await uploadNoticePhoto(chica);
        nuevas = [...nuevas, r.url];
        onChange(nuevas);
      } catch (e) {
        onError?.(`No se pudo subir una foto: ${e.message}`);
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  }

  function mover(i, paso) {
    const j = i + paso;
    if (j < 0 || j >= value.length) return;
    const copia = [...value];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  }

  const src = (v) => (v.startsWith('/') || v.startsWith('http') ? v : `/api/uploads/avisos/${v}`);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: colors.textSecondary }}>
        <Icon name="photo_library" size={18} color={colors.textSecondary} />
        Fotos ({value.length}/{MAX}) <span className="font-normal" style={{ color: colors.textMuted }}>· la primera es la portada</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {value.map((v, i) => (
          <div key={v} className="relative h-[104px] w-[104px] overflow-hidden" style={{ borderRadius: 14, border: `1px solid ${colors.border}` }}>
            <img src={src(v)} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 px-[6px] py-[1px] text-[10px] font-black" style={{ backgroundColor: colors.blue, color: colors.white, borderRadius: 6 }}>
                PORTADA
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border-0"
              style={{ backgroundColor: alpha(colors.blueDeep, 0.75) }}
            >
              <Icon name="close" size={16} color={colors.white} />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <Flecha icon="chevron_left" label="Mover a la izquierda" onClick={() => mover(i, -1)} disabled={i === 0} />
              <Flecha icon="chevron_right" label="Mover a la derecha" onClick={() => mover(i, 1)} disabled={i === value.length - 1} />
            </div>
          </div>
        ))}
        {Array.from({ length: subiendo }, (_, i) => (
          <div
            key={`s${i}`}
            className="flex h-[104px] w-[104px] flex-col items-center justify-center gap-1 text-xs font-bold"
            style={{ borderRadius: 14, backgroundColor: colors.background, color: colors.textMuted }}
          >
            <Icon name="hourglass_top" size={22} color={colors.textMuted} />
            Subiendo…
          </div>
        ))}
        {value.length + subiendo < MAX && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="tappable flex h-[104px] w-[104px] flex-col items-center justify-center gap-1 text-xs font-bold"
            style={{ borderRadius: 14, border: `2px dashed ${colors.border}`, backgroundColor: colors.surface, color: colors.textSecondary }}
          >
            <Icon name="add_photo_alternate" size={26} color={colors.cyanDark} />
            Agregar fotos
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Flecha({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-full border-0"
      style={{ backgroundColor: alpha(colors.blueDeep, 0.6), opacity: disabled ? 0 : 1 }}
    >
      <Icon name={icon} size={18} color={colors.white} />
    </button>
  );
}
