// src/admin/FilePicker.jsx — Responsable: Alexis
// Archivos adjuntos de un aviso en el panel (hasta 5): PDF, Word, Excel y
// PowerPoint de hasta 10 MB cada uno.
//   - "Adjuntar archivos": elige uno o varios; se suben con uploadNoticeFile().
//     Antes de subir se revisa el tipo y el peso aquí mismo (la API lo
//     vuelve a revisar con el contenido real del archivo).
//   - Flechas para cambiar el orden, ✕ para quitar y, si es PDF, "Ver"
//     para revisarlo en el mismo visor que usan los alumnos.
// Props: value (lista de { archivo, name, ext, size, url, download }),
//        onChange(lista), onError(mensaje)
import { useRef, useState } from 'react';
import { colors } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import PdfViewer from '../components/PdfViewer.jsx';
import { uploadNoticeFile } from '../lib/api.js';
import { ACEPTA, EXTENSIONES, MAX_ARCHIVOS, MAX_MB_ARCHIVO, extension, pesoBonito, tipoArchivo } from '../lib/archivos.js';

export default function FilePicker({ value = [], onChange, onError }) {
  const input = useRef(null);
  const [subiendo, setSubiendo] = useState([]); // nombres que se están subiendo
  const [pdf, setPdf] = useState(null);
  const [encima, setEncima] = useState(false); // arrastrando archivos encima

  async function agregar(files) {
    const lista = [...files].slice(0, MAX_ARCHIVOS - value.length - subiendo.length);
    if (files.length > lista.length) onError?.(`Máximo ${MAX_ARCHIVOS} archivos por aviso.`);
    let nuevos = [...value];
    for (const f of lista) {
      // Revisión rápida antes de gastar datos subiéndolo.
      if (!EXTENSIONES.includes(extension(f.name))) {
        onError?.(`"${f.name}" no se puede adjuntar. Solo PDF, Word, Excel o PowerPoint.`);
        continue;
      }
      if (f.size > MAX_MB_ARCHIVO * 1024 * 1024) {
        onError?.(`"${f.name}" pesa ${pesoBonito(f.size)}; el máximo es ${MAX_MB_ARCHIVO} MB.`);
        continue;
      }
      setSubiendo((l) => [...l, f.name]);
      try {
        const r = await uploadNoticeFile(f);
        nuevos = [...nuevos, r];
        onChange(nuevos);
      } catch (e) {
        onError?.(`No se pudo subir "${f.name}": ${e.message}`);
      } finally {
        setSubiendo((l) => {
          const i = l.indexOf(f.name);
          return i < 0 ? l : [...l.slice(0, i), ...l.slice(i + 1)];
        });
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

  const lleno = value.length + subiendo.length >= MAX_ARCHIVOS;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: colors.textSecondary }}>
        <Icon name="attach_file" size={18} color={colors.textSecondary} />
        Archivos ({value.length}/{MAX_ARCHIVOS})
        <span className="font-normal" style={{ color: colors.textMuted }}>
          · PDF, Word, Excel o PowerPoint de hasta {MAX_MB_ARCHIVO} MB
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {value.map((f, i) => {
          const t = tipoArchivo(f.ext);
          return (
            <div key={f.archivo || f.url} className="flex items-center gap-3 p-2" style={{ borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.surface }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ backgroundColor: t.tint, borderRadius: 10 }}>
                <Icon name={t.icon} size={22} color={t.dark} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{f.name}</div>
                <div className="text-xs" style={{ color: colors.textMuted }}>
                  {t.label} · {pesoBonito(f.size)}
                </div>
              </div>
              {f.ext === 'pdf' && (
                <button
                  type="button"
                  onClick={() => setPdf(f)}
                  className="tappable flex h-8 items-center gap-1 border-0 px-3 text-xs font-bold"
                  style={{ borderRadius: 999, backgroundColor: colors.blueTint, color: colors.ink }}
                >
                  <Icon name="visibility" size={16} color={colors.ink} />
                  Ver
                </button>
              )}
              <MiniBoton icon="arrow_upward" label="Subir en la lista" onClick={() => mover(i, -1)} disabled={i === 0} />
              <MiniBoton icon="arrow_downward" label="Bajar en la lista" onClick={() => mover(i, 1)} disabled={i === value.length - 1} />
              <MiniBoton icon="close" label={`Quitar ${f.name}`} onClick={() => onChange(value.filter((x) => x !== f))} danger />
            </div>
          );
        })}

        {subiendo.map((nombre, i) => (
          <div key={`${nombre}-${i}`} className="flex items-center gap-3 p-2 text-sm" style={{ borderRadius: 14, backgroundColor: colors.background, color: colors.textMuted }}>
            <span className="flex h-10 w-10 items-center justify-center">
              <Icon name="hourglass_top" size={22} color={colors.textMuted} />
            </span>
            <span className="min-w-0 flex-1 truncate">Subiendo {nombre}…</span>
          </div>
        ))}

        {!lleno && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setEncima(true);
            }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => {
              e.preventDefault();
              setEncima(false);
              agregar(e.dataTransfer.files);
            }}
            className="tappable flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold"
            style={{
              borderRadius: 14,
              border: `2px dashed ${encima ? colors.blue : colors.border}`,
              backgroundColor: encima ? colors.blueTint : colors.surface,
              color: colors.textSecondary,
            }}
          >
            <Icon name="upload_file" size={24} color={colors.crimson} />
            Adjuntar archivos
            <span className="hidden font-normal sm:inline" style={{ color: colors.textMuted }}>
              (o arrástralos aquí)
            </span>
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACEPTA}
        multiple
        hidden
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = '';
        }}
      />
      {pdf && <PdfViewer archivo={pdf} onClose={() => setPdf(null)} />}
    </div>
  );
}

function MiniBoton({ icon, label, onClick, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0"
      style={{ backgroundColor: danger ? colors.crimsonTint : colors.background, opacity: disabled ? 0.3 : 1 }}
    >
      <Icon name={icon} size={18} color={danger ? colors.crimsonDark : colors.textSecondary} />
    </button>
  );
}
