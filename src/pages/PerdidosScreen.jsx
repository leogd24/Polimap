// src/pages/PerdidosScreen.jsx — Responsable: Alexis
// =====================================================================
// Objetos perdidos y encontrados (se abre desde Inicio → "Objetos perdidos").
//   - Pestañas: "Se perdió" / "Se encontró" / "Míos".
//   - Buscador y categorías (Electrónicos, Credencial, Llaves…).
//   - Cada publicación: foto, qué es, dónde y cuándo, dónde recogerlo
//     (si alguien lo encontró), "Escribir" (correo institucional, solo con
//     sesión y si el autor lo permitió) y "Ver en el mapa".
//   - "Publicar": hoja con foto (se comprime antes de subir), tipo,
//     categoría, edificio, lugar, fecha y "dónde lo dejé".
//   - Reportar (3 reportes la ocultan hasta que un admin la revise).
//   - En "Míos": "Ya lo encontré / Ya se entregó" y borrar.
//   - Todo se borra solo a los 30 días.
//
// Props: user (null = invitado), onBack, onRequestLogin, onShowOnMap(number)
// API: getLostItems, publishLostItem… en src/lib/api.js (api/perdidos.php).
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import Icon from '../components/Icon.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import Snackbar from '../components/Snackbar.jsx';
import PickerField from '../components/PickerField.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import FilledButton from '../components/FilledButton.jsx';
import { TextField, TextArea, Switch } from '../components/Inputs.jsx';
import { campusBuildings } from '../data/campusBuildings.js';
import { compressImage } from '../lib/compressImage.js';
import { haceCorto, fechaLarga } from '../lib/tiempo.js';
import { CATEGORIAS_PERDIDO, MOTIVOS_PERDIDO, ESTADOS_PERDIDO, categoriaPerdido, lugarPerdido } from '../lib/perdidos.js';
import {
  getLostItems,
  getMyLostItems,
  uploadLostPhoto,
  publishLostItem,
  resolveLostItem,
  reportLostItem,
  deleteLostItem,
} from '../lib/api.js';

const PESTANAS = [
  { key: 'perdido', label: 'Se perdió', icon: 'search' },
  { key: 'encontrado', label: 'Se encontró', icon: 'volunteer_activism' },
  { key: 'mios', label: 'Míos', icon: 'person' },
];

/** "publicado ahora" / "hace 3 h" */
function hace(iso) {
  const t = haceCorto(iso);
  return t === 'ahora' ? 'publicado ahora' : /^\d/.test(t) ? `hace ${t}` : `publicado el ${t}`;
}

const hoyLocal = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD

export default function PerdidosScreen({ user, onBack, onRequestLogin, onShowOnMap }) {
  const [pestana, setPestana] = useState('perdido');
  const [categoria, setCategoria] = useState('');
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState(''); // se manda al dejar de escribir
  const [items, setItems] = useState([]);
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error
  const [publicar, setPublicar] = useState(false);
  const [reportando, setReportando] = useState(null);
  const [mensaje, setMensaje] = useState('');

  // Espera 350 ms después de la última letra para buscar.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const cargar = useCallback(async () => {
    if (pestana === 'mios' && !user) {
      setItems([]);
      setEstado('listo');
      return;
    }
    setEstado('cargando');
    try {
      const r = pestana === 'mios' ? await getMyLostItems() : await getLostItems({ tipo: pestana, categoria, q: busqueda });
      setItems(r.items ?? []);
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [pestana, categoria, busqueda, user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirPublicar() {
    if (!user) {
      setMensaje('Inicia sesión con tu correo de la UdeG para publicar.');
      onRequestLogin?.();
      return;
    }
    setPublicar(true);
  }

  async function resolver(item) {
    try {
      const r = await resolveLostItem(item.id);
      setItems((l) => l.map((x) => (x.id === item.id ? r.item : x)));
      setMensaje(item.type === 'perdido' ? '¡Qué bueno que apareció!' : '¡Gracias por entregarlo!');
    } catch (e) {
      setMensaje(e.message);
    }
  }

  async function borrar(item) {
    if (!window.confirm(`¿Borrar "${item.title}"?`)) return;
    try {
      await deleteLostItem(item.id);
      setItems((l) => l.filter((x) => x.id !== item.id));
      setMensaje('Publicación borrada.');
    } catch (e) {
      setMensaje(e.message);
    }
  }

  const mios = pestana === 'mios';

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: colors.background }}>
      {/* Barra */}
      <header
        className="flex shrink-0 items-center gap-2 px-2"
        style={{ backgroundColor: colors.blue, color: colors.white, paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(60px + env(safe-area-inset-top))' }}
      >
        <button type="button" onClick={onBack} aria-label="Regresar" className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent">
          <Icon name="arrow_back" color={colors.white} />
        </button>
        <div className="min-w-0 flex-1 py-2">
          <h1 className="m-0 truncate text-lg font-extrabold">Objetos perdidos</h1>
          <div className="truncate text-[0.6875rem] font-medium">Perdiste o encontraste algo en el Poli</div>
        </div>
      </header>

      {/* Pestañas */}
      <div className="flex shrink-0 gap-1 p-2" role="tablist" aria-label="Qué ver" style={{ backgroundColor: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        {PESTANAS.map((p) => {
          const activa = p.key === pestana;
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setPestana(p.key)}
              className="tappable flex min-h-[44px] flex-1 items-center justify-center gap-1 border-0 text-sm font-extrabold"
              style={{ borderRadius: 12, backgroundColor: activa ? colors.blue : 'transparent', color: activa ? colors.white : colors.textSecondary }}
            >
              <Icon name={p.icon} size={18} color={activa ? colors.white : colors.textSecondary} />
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="app-scroll flex-1 px-[18px] pb-28 pt-3">
        {!mios && (
          <>
            <TextField value={q} onChange={setQ} placeholder="Buscar (ej. calculadora, credencial)" prefixIcon="search" inputProps={{ type: 'search', 'aria-label': 'Buscar objetos' }} />
            {/* Categorías */}
            <div className="perd-chips -mx-[18px] mt-3 flex gap-2 overflow-x-auto px-[18px] pb-1" role="group" aria-label="Categorías">
              <Chip activo={!categoria} onClick={() => setCategoria('')} icon="apps" label="Todo" />
              {CATEGORIAS_PERDIDO.map((c) => (
                <Chip key={c.value} activo={categoria === c.value} onClick={() => setCategoria(categoria === c.value ? '' : c.value)} icon={c.icon} label={c.label} />
              ))}
            </div>
          </>
        )}

        {mios && !user && (
          <Vacio icon="lock" titulo="Inicia sesión" texto="Para ver y publicar tus objetos perdidos entra con tu correo de la UdeG.">
            <FilledButton icon="login" onClick={onRequestLogin} className="mt-4">
              Iniciar sesión
            </FilledButton>
          </Vacio>
        )}

        {estado === 'cargando' && <p className="mt-6 text-center text-sm" style={{ color: colors.textSecondary }}>Cargando…</p>}
        {estado === 'error' && (
          <Vacio icon="wifi_off" titulo="No se pudo cargar" texto="Revisa tu internet e intenta otra vez.">
            <FilledButton icon="refresh" onClick={cargar} className="mt-4" background={colors.blue}>
              Reintentar
            </FilledButton>
          </Vacio>
        )}
        {estado === 'listo' && items.length === 0 && (user || !mios) && (
          <Vacio
            icon={mios ? 'inventory_2' : 'travel_explore'}
            titulo={mios ? 'Aún no publicas nada' : busqueda || categoria ? 'Sin resultados' : pestana === 'perdido' ? 'Nadie ha perdido nada' : 'Nadie ha encontrado nada'}
            texto={mios ? 'Si pierdes o encuentras algo, publícalo con el botón de abajo.' : busqueda || categoria ? 'Prueba con otra palabra o categoría.' : 'Si tú perdiste o encontraste algo, publícalo.'}
          />
        )}

        <div className="mt-3 flex flex-col gap-3">
          {estado === 'listo' &&
            items.map((it) => (
              <Tarjeta
                key={it.id}
                item={it}
                user={user}
                mios={mios}
                onMapa={it.building ? () => onShowOnMap?.(it.building) : null}
                onReportar={() => setReportando(it)}
                onResolver={() => resolver(it)}
                onBorrar={() => borrar(it)}
              />
            ))}
        </div>

        <p className="m-0 mt-6 text-center text-xs" style={{ color: colors.textSecondary }}>
          Las publicaciones se borran solas a los 30 días. No pongas teléfonos ni datos personales.
          {' '}Lo que encuentres también lo puedes entregar en Control Escolar (edificio 1).
        </p>
      </div>

      {/* Botón flotante */}
      <button
        type="button"
        onClick={abrirPublicar}
        className="tappable absolute right-4 flex h-14 items-center gap-2 rounded-full border-0 pl-4 pr-5 text-[0.9375rem] font-extrabold"
        style={{ bottom: 'calc(18px + env(safe-area-inset-bottom))', backgroundColor: colors.crimsonSolid, color: colors.white, boxShadow: `0 8px 20px ${alpha(colors.blueDeep, 0.3)}` }}
      >
        <Icon name="add" color={colors.white} />
        Publicar
      </button>

      {publicar && (
        <FormularioPublicar
          tipoInicial={pestana === 'encontrado' ? 'encontrado' : 'perdido'}
          onClose={() => setPublicar(false)}
          onPublicado={(item) => {
            setPublicar(false);
            setMensaje('¡Publicado! Te avisamos: se borra solo en 30 días.');
            if (pestana === 'mios' || pestana === item.type) setItems((l) => [item, ...l]);
            else setPestana(item.type);
          }}
        />
      )}
      <HojaReporte
        item={reportando}
        onClose={() => setReportando(null)}
        onListo={(texto) => {
          setReportando(null);
          setMensaje(texto);
        }}
      />
      {mensaje && <Snackbar message={mensaje} onDismiss={() => setMensaje('')} />}
      <style>{`.perd-chips{scrollbar-width:none}.perd-chips::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

function Chip({ activo, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="tappable flex min-h-[40px] shrink-0 items-center gap-1 whitespace-nowrap px-3 text-sm font-bold"
      style={{
        borderRadius: 999,
        border: `1px solid ${activo ? colors.ink : colors.border}`,
        backgroundColor: activo ? alpha(colors.cyan, 0.14) : colors.surface,
        color: colors.textPrimary,
      }}
    >
      <Icon name={icon} size={18} color={activo ? colors.ink : colors.textSecondary} />
      {label}
    </button>
  );
}

function Vacio({ icon, titulo, texto, children }) {
  return (
    <div className="mt-8 flex flex-col items-center px-4 text-center">
      <Icon name={icon} size={56} color={colors.textMuted} />
      <h2 className="m-0 mt-3 text-lg font-black">{titulo}</h2>
      <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary }}>
        {texto}
      </p>
      {children}
    </div>
  );
}

/** Una publicación. */
function Tarjeta({ item, user, mios, onMapa, onReportar, onResolver, onBorrar }) {
  const cat = categoriaPerdido(item.category);
  const encontrado = item.type === 'encontrado';
  const est = ESTADOS_PERDIDO[item.status] ?? ESTADOS_PERDIDO.activo;
  const lugar = lugarPerdido(item);
  const asunto = encodeURIComponent(`POLIMAP · ${item.title}`);

  return (
    <article className="overflow-hidden" style={{ borderRadius: 'var(--radius-card)', border: `1px solid ${colors.border}`, backgroundColor: colors.surface }} aria-label={item.title}>
      <div className="flex gap-3 p-3">
        {item.photo ? (
          <img src={item.photo} alt={item.title} className="h-24 w-24 shrink-0 object-cover" style={{ borderRadius: 14, backgroundColor: colors.blueTint }} loading="lazy" />
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center" style={{ borderRadius: 14, backgroundColor: alpha(cat.color, 0.12) }}>
            <Icon name={cat.icon} size={40} color={cat.color} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="px-2 py-[2px] text-[0.6875rem] font-black uppercase"
              style={{ borderRadius: 8, backgroundColor: encontrado ? colors.greenTint : colors.crimsonTint, color: encontrado ? colors.greenDark : colors.crimsonDark, letterSpacing: 0.3 }}
            >
              {encontrado ? 'Encontrado' : 'Perdido'}
            </span>
            {mios && (
              <span className="px-2 py-[2px] text-[0.6875rem] font-black" style={{ borderRadius: 8, backgroundColor: est.bg, color: est.fg }}>
                {est.label}
              </span>
            )}
            {/* Reportar: arriba a la derecha para no amontonar los botones de abajo */}
            {user && !item.mine && !mios && (
              <button type="button" onClick={onReportar} aria-label="Reportar publicación" title="Reportar" className="tappable -mr-1 -mt-1 ml-auto flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent">
                <Icon name="flag" size={20} color={colors.textSecondary} />
              </button>
            )}
          </div>
          <h3 className="m-0 mt-1 text-base font-black leading-tight">{item.title}</h3>
          {lugar && (
            <div className="mt-1 flex items-center gap-1 text-xs font-bold" style={{ color: colors.textSecondary }}>
              <Icon name="location_on" size={14} color={colors.textSecondary} />
              <span className="truncate">{lugar}</span>
            </div>
          )}
          <div className="mt-[2px] text-xs" style={{ color: colors.textSecondary }}>
            {encontrado ? 'Se encontró' : 'Se perdió'} el {fechaLarga(`${item.date}T12:00:00`)} · {hace(item.createdAt)}
          </div>
        </div>
      </div>
      {item.description && (
        <p className="m-0 px-3 pb-2 text-sm" style={{ color: colors.textSecondary, lineHeight: 1.4 }}>
          {item.description}
        </p>
      )}
      {encontrado && item.handover && (
        <div className="mx-3 mb-2 flex items-start gap-2 p-2 text-sm" style={{ borderRadius: 12, backgroundColor: colors.greenTint, color: colors.greenDark }}>
          <Icon name="where_to_vote" size={18} color={colors.greenDark} />
          <span>
            <b>Dónde recogerlo:</b> {item.handover}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
        {item.author && !mios && (
          <span className="mr-auto flex min-w-0 items-center gap-2 text-xs font-bold" style={{ color: colors.textSecondary }}>
            <UserAvatar user={item.author} size={24} />
            <span className="truncate">{item.author.nombre}</span>
          </span>
        )}
        {mios ? (
          <>
            {item.status === 'activo' && (
              <Boton icon="task_alt" onClick={onResolver} fuerte>
                {encontrado ? 'Ya se entregó' : 'Ya lo encontré'}
              </Boton>
            )}
            <Boton icon="delete" onClick={onBorrar}>
              Borrar
            </Boton>
          </>
        ) : (
          <>
            {onMapa && (
              <Boton icon="map" onClick={onMapa}>
                Mapa
              </Boton>
            )}
            {item.contact && (
              <a
                href={`mailto:${item.contact}?subject=${asunto}`}
                className="tappable flex min-h-[40px] items-center gap-1 px-3 text-sm font-extrabold no-underline"
                style={{ borderRadius: 12, backgroundColor: colors.blue, color: colors.white }}
              >
                <Icon name="mail" size={18} color={colors.white} />
                Escribir
              </a>
            )}
          </>
        )}
      </div>
      {!user && !mios && (
        <div className="px-3 pb-3 text-xs" style={{ color: colors.textSecondary }}>
          Inicia sesión para ver quién lo publicó y escribirle.
        </div>
      )}
    </article>
  );
}

function Boton({ icon, onClick, children, fuerte = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable flex min-h-[40px] items-center gap-1 px-3 text-sm font-extrabold"
      style={{
        borderRadius: 12,
        border: fuerte ? 'none' : `1px solid ${colors.border}`,
        backgroundColor: fuerte ? colors.greenSolid : colors.surface,
        color: fuerte ? colors.white : colors.textPrimary,
      }}
    >
      <Icon name={icon} size={18} color={fuerte ? colors.white : colors.textSecondary} />
      {children}
    </button>
  );
}

/** Hoja para publicar. */
function FormularioPublicar({ tipoInicial, onClose, onPublicado }) {
  const [f, setF] = useState({
    tipo: tipoInicial,
    titulo: '',
    descripcion: '',
    categoria: null,
    edificio: null,
    lugar: '',
    entrega: '',
    fecha: hoyLocal(),
    mostrarCorreo: true,
  });
  const [foto, setFoto] = useState(null); // { archivo, url }
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const inputFoto = useRef(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const encontrado = f.tipo === 'encontrado';
  const minFecha = new Date(Date.now() - 60 * 86400000).toLocaleDateString('en-CA');

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    try {
      const chica = await compressImage(archivo);
      const r = await uploadLostPhoto(chica);
      setFoto({ archivo: r.archivo, url: URL.createObjectURL(chica) });
    } catch (err) {
      setError(err.message || 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  async function enviar() {
    if (f.titulo.trim().length < 3) {
      setError('Escribe qué es (al menos 3 letras).');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const r = await publishLostItem({ ...f, categoria: f.categoria ?? 'otro', foto: foto?.archivo ?? null, entrega: encontrado ? f.entrega : '' });
      onPublicado(r.item);
    } catch (err) {
      setError(err.message || 'No se pudo publicar. Revisa tu internet.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Publicar"
      subtitle="Lo verán los alumnos del Poli"
      icon="travel_explore"
      footer={
        <FilledButton icon={enviando ? 'hourglass_top' : 'send'} onClick={enviar} className="w-full" style={{ opacity: enviando || subiendo ? 0.6 : 1 }}>
          {enviando ? 'Publicando…' : 'Publicar'}
        </FilledButton>
      }
    >
      <div className="grid gap-3">
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="¿Qué pasó?">
          {[
            { v: 'perdido', label: 'Lo perdí', icon: 'search' },
            { v: 'encontrado', label: 'Lo encontré', icon: 'volunteer_activism' },
          ].map((o) => {
            const activo = f.tipo === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => set('tipo')(o.v)}
                className="tappable flex min-h-[52px] items-center justify-center gap-2 text-sm font-extrabold"
                style={{ borderRadius: 14, border: `1.5px solid ${activo ? colors.ink : colors.border}`, backgroundColor: activo ? alpha(colors.cyan, 0.12) : colors.surface, color: colors.textPrimary }}
              >
                <Icon name={o.icon} size={20} color={activo ? colors.ink : colors.textSecondary} />
                {o.label}
              </button>
            );
          })}
        </div>

        {/* Foto */}
        <div className="flex items-center gap-3">
          {foto ? (
            <span className="relative">
              <img src={foto.url} alt="Foto elegida" className="h-20 w-20 object-cover" style={{ borderRadius: 14 }} />
              <button type="button" onClick={() => setFoto(null)} aria-label="Quitar foto" className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-0" style={{ backgroundColor: colors.blueDeep }}>
                <Icon name="close" size={16} color={colors.white} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="tappable flex h-20 w-20 flex-col items-center justify-center gap-1 text-xs font-bold"
              style={{ borderRadius: 14, border: `1.5px dashed ${colors.border}`, backgroundColor: colors.background, color: colors.textSecondary }}
            >
              <Icon name={subiendo ? 'hourglass_top' : 'add_a_photo'} color={colors.textSecondary} />
              {subiendo ? 'Subiendo' : 'Foto'}
            </button>
          )}
          <p className="m-0 flex-1 text-xs" style={{ color: colors.textSecondary }}>
            Opcional. {encontrado ? 'Tip: no muestres datos de la credencial o del celular; con la foto basta para que su dueño lo reconozca.' : 'Una foto parecida ayuda a que lo reconozcan.'}
          </p>
          <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={elegirFoto} aria-label="Elegir foto" />
        </div>

        <TextField value={f.titulo} onChange={set('titulo')} placeholder="¿Qué es? (ej. Calculadora Casio gris)" prefixIcon="sell" inputProps={{ maxLength: 80, 'aria-label': 'Qué es' }} />
        <PickerField
          value={f.categoria}
          onChange={set('categoria')}
          placeholder="Categoría"
          prefixIcon="category"
          title="Categoría"
          options={CATEGORIAS_PERDIDO.map((c) => ({ value: c.value, label: c.label, icon: c.icon, color: c.color }))}
        />
        <TextArea value={f.descripcion} onChange={set('descripcion')} placeholder="Detalles para reconocerlo (color, marca, calcomanías…)" minRows={3} maxLength={500} />
        <PickerField
          value={f.edificio}
          onChange={set('edificio')}
          placeholder="Edificio (opcional)"
          prefixIcon="apartment"
          title="¿En qué edificio?"
          clearable
          options={campusBuildings.map((b) => ({ value: b.number, label: `Edificio ${b.number}`, description: b.name, icon: b.icon, color: b.color, badge: b.number }))}
        />
        <TextField value={f.lugar} onChange={set('lugar')} placeholder="Lugar (ej. Aula A05, cafetería, canchas)" prefixIcon="location_on" inputProps={{ maxLength: 100, 'aria-label': 'Lugar' }} />
        <label className="flex items-center gap-3 text-sm font-bold">
          <Icon name="event" color={colors.textSecondary} />
          <span className="flex-1">{encontrado ? '¿Cuándo lo encontraste?' : '¿Cuándo lo perdiste?'}</span>
          <input
            type="date"
            value={f.fecha}
            min={minFecha}
            max={hoyLocal()}
            onChange={(e) => set('fecha')(e.target.value)}
            className="px-3 py-2"
            style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
          />
        </label>
        {encontrado && (
          <TextField value={f.entrega} onChange={set('entrega')} placeholder="¿Dónde lo dejaste? (ej. Control Escolar)" prefixIcon="where_to_vote" inputProps={{ maxLength: 120, 'aria-label': 'Dónde recogerlo' }} />
        )}
        <div className="flex items-center gap-3 p-3" style={{ borderRadius: 14, backgroundColor: colors.background }}>
          <span className="min-w-0 flex-1 text-sm">
            <b>Mostrar mi correo institucional</b>
            <span className="block text-xs" style={{ color: colors.textSecondary }}>
              Solo lo ven alumnos con sesión, para escribirte.
            </span>
          </span>
          <Switch value={f.mostrarCorreo} onChange={set('mostrarCorreo')} label="Mostrar mi correo institucional" />
        </div>
        {error && (
          <div className="text-sm font-bold" role="alert" style={{ color: colors.crimsonDark }}>
            {error}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/** Hoja para reportar una publicación. */
function HojaReporte({ item, onClose, onListo }) {
  const [enviando, setEnviando] = useState(false);
  async function reportar(motivo) {
    setEnviando(true);
    try {
      const r = await reportLostItem(item.id, motivo);
      onListo(r.yaReportado ? 'Ya la habías reportado.' : 'Gracias. Un administrador la revisará.');
    } catch (e) {
      onListo(e.message);
    } finally {
      setEnviando(false);
    }
  }
  return (
    <BottomSheet open={Boolean(item)} onClose={onClose} title="Reportar publicación" subtitle={item?.title} icon="flag" iconColor={colors.crimsonDark}>
      <div className="flex flex-col gap-2">
        {MOTIVOS_PERDIDO.map((m) => (
          <button
            key={m.value}
            type="button"
            disabled={enviando}
            onClick={() => reportar(m.value)}
            className="tappable flex min-h-[48px] items-center gap-3 px-3 text-left text-sm font-bold"
            style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, color: colors.textPrimary }}
          >
            <Icon name={m.icon} size={20} color={colors.textSecondary} />
            {m.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
