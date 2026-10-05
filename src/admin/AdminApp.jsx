// src/admin/AdminApp.jsx — Responsable: Alexis
// Panel para administrar los reportes comunitarios (https://polimap.ct.ws/admin.html).
//
// Paso a paso:
//   1. Pide la clave de administrador (el admin_token de api/config.php).
//   2. Trae TODOS los reportes con getAllReports() de src/lib/api.js.
//   3. Muestra contadores por estado, filtros y la lista en tarjetas.
//   4. Al tocar un reporte abre ReportDetail para cambiar su estado.
//
// La clave se guarda solo en sessionStorage: al cerrar la pestaña se borra.
// La seguridad real está en el servidor: sin la clave correcta la API
// responde 401 y no entrega nada.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { colors } from '../styles/theme.js';
import { getAllReports, getBuildings } from '../lib/api.js';
import Card from '../components/Card.jsx';
import FilledButton from '../components/FilledButton.jsx';
import Icon from '../components/Icon.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import BrandStripe from '../components/BrandStripe.jsx';
import Snackbar from '../components/Snackbar.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TextField, SelectField } from '../components/Inputs.jsx';
import ReportDetail from './ReportDetail.jsx';
import StateChip from './StateChip.jsx';
import { CATEGORIES, STATES, stateInfo, categoryInfo, formatDate, locationText } from './reportMeta.js';

const TOKEN_KEY = 'polimap.adminToken';

/** sessionStorage puede fallar (modo privado): nunca debe romper el panel. */
function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
function saveToken(value) {
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sin almacenamiento: habrá que escribir la clave cada vez.
  }
}

export default function AdminApp() {
  const [token, setToken] = useState(readToken);
  const [reports, setReports] = useState([]);
  const [buildingNames, setBuildingNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedFolio, setSelectedFolio] = useState(null);

  // Filtros
  const [stateFilter, setStateFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [search, setSearch] = useState('');

  // 1) Cargar reportes con la clave actual -----------------------------------
  const loadReports = useCallback(
    async (currentToken) => {
      if (!currentToken) return;
      setLoading(true);
      try {
        const data = await getAllReports(currentToken);
        setReports(data);
        setLoginError('');
        saveToken(currentToken);
      } catch (error) {
        if (error.status === 401) {
          // Clave incorrecta: regresamos a la pantalla de entrada.
          saveToken('');
          setToken('');
          setLoginError('Clave incorrecta. Revisa el admin_token de api/config.php.');
        } else {
          setMessage(`No se pudieron cargar los reportes: ${error.message}`);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadReports(token);
  }, [token, loadReports]);

  // Nombres de edificios para mostrar "Edificio 1 · Atención a alumnos".
  useEffect(() => {
    getBuildings().then((list) => {
      const names = {};
      list.forEach((b) => {
        names[b.number] = b.name;
      });
      setBuildingNames(names);
    });
  }, []);

  // 2) Contadores y lista filtrada ------------------------------------------
  const counts = useMemo(() => {
    const result = { total: reports.length };
    STATES.forEach((s) => {
      result[s.key] = reports.filter((r) => r.estado === s.key).length;
    });
    return result;
  }, [reports]);

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (stateFilter && r.estado !== stateFilter) return false;
      if (categoryFilter && r.categoria !== categoryFilter) return false;
      if (!text) return true;
      return [r.folio, r.descripcion, r.zona, locationText(r, buildingNames)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(text));
    });
  }, [reports, stateFilter, categoryFilter, search, buildingNames]);

  const selected = reports.find((r) => r.folio === selectedFolio) || null;

  // Cuando ReportDetail guarda un cambio, actualizamos ese reporte en la lista.
  function handleSaved(updated) {
    setReports((list) => list.map((r) => (r.folio === updated.folio ? { ...r, ...updated } : r)));
    setMessage(`${updated.folio} actualizado a "${stateInfo(updated.estado).label}".`);
  }

  function logout() {
    saveToken('');
    setToken('');
    setReports([]);
  }

  // 3) Pantallas ------------------------------------------------------------
  if (!token) {
    return <LoginScreen error={loginError} onSubmit={(value) => setToken(value)} />;
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: colors.background }}>
      <Header loading={loading} onRefresh={() => loadReports(token)} onLogout={logout} />

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-5">
        <StatsRow counts={counts} active={stateFilter} onSelect={setStateFilter} />

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_260px]">
          <TextField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por folio, descripción o lugar"
            prefixIcon="search"
          />
          <SelectField
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Todas las categorías"
            prefixIcon="category"
            options={Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label }))}
          />
        </div>

        <p className="mb-3 mt-5 text-sm" style={{ color: colors.textSecondary }}>
          {loading ? 'Cargando reportes…' : `Mostrando ${visible.length} de ${reports.length} reportes`}
        </p>

        {!loading && visible.length === 0 ? (
          <div className="py-10">
            <EmptyState
              icon="inbox"
              title={reports.length === 0 ? 'Aún no hay reportes' : 'Sin resultados'}
              body={
                reports.length === 0
                  ? 'Cuando alguien envíe un reporte desde la app aparecerá aquí.'
                  : 'Prueba con otro filtro o búsqueda.'
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((report) => (
              <ReportCard
                key={report.folio}
                report={report}
                location={locationText(report, buildingNames)}
                onOpen={() => setSelectedFolio(report.folio)}
              />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <ReportDetail
          report={selected}
          token={token}
          location={locationText(selected, buildingNames)}
          onClose={() => setSelectedFolio(null)}
          onSaved={handleSaved}
          onError={setMessage}
        />
      )}

      {message && <Snackbar message={message} onDismiss={() => setMessage('')} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla de entrada
// ---------------------------------------------------------------------------
function LoginScreen({ error, onSubmit }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }

  return (
    <div className="flex min-h-full items-center justify-center p-5" style={{ backgroundColor: colors.blue }}>
      <Card className="w-full max-w-[400px]">
        <BrandStripe height={6} />
        <form onSubmit={submit} className="p-7">
          <div className="flex flex-col items-center text-center">
            <PolimapLogo size={72} dark />
            <h1 className="m-0 mt-4 text-2xl font-black">Panel de reportes</h1>
            <p className="m-0 mt-1 text-sm" style={{ color: colors.textSecondary }}>
              Solo para el equipo que atiende las incidencias del campus.
            </p>
          </div>

          <label className="mt-6 block text-sm font-bold" htmlFor="admin-token">
            Clave de administrador
          </label>
          {/* Campo de contraseña con el mismo estilo que Inputs.jsx */}
          <div
            className="mt-2 flex items-center"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 'var(--radius-input)',
              border: focused ? `1.5px solid ${colors.blue}` : `1px solid ${colors.border}`,
              padding: focused ? '0.5px' : '1px',
            }}
          >
            <span className="pl-3">
              <Icon name="key" color={colors.textSecondary} />
            </span>
            <input
              id="admin-token"
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="min-w-0 flex-1 bg-transparent px-3 py-4 outline-none"
            />
          </div>
          {error && (
            <p className="m-0 mt-2 text-xs" style={{ color: colors.crimson }}>
              {error}
            </p>
          )}

          {/* Enter dentro del campo también envía el formulario */}
          <FilledButton icon="login" className="mt-5 w-full" onClick={submit}>
            Entrar
          </FilledButton>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Encabezado azul
// ---------------------------------------------------------------------------
function Header({ loading, onRefresh, onLogout }) {
  return (
    <header style={{ backgroundColor: colors.blue, color: colors.white }}>
      <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-4 py-4">
        <PolimapLogo size={42} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black leading-tight">Panel de reportes</div>
          <div className="text-xs opacity-80">POLIMAP · Escuela Politécnica</div>
        </div>
        <HeaderButton icon={loading ? 'hourglass_top' : 'refresh'} label="Actualizar" onClick={onRefresh} />
        <HeaderButton icon="logout" label="Salir" onClick={onLogout} />
      </div>
      <BrandStripe height={5} />
    </header>
  );
}

function HeaderButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="tappable flex min-h-[44px] items-center gap-1 rounded-xl border-0 px-3 text-sm font-bold"
      style={{ backgroundColor: 'transparent', color: colors.white }}
    >
      <Icon name={icon} size={22} color={colors.white} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Contadores por estado (también sirven de filtro)
// ---------------------------------------------------------------------------
function StatsRow({ counts, active, onSelect }) {
  const items = [{ key: null, label: 'Todos', icon: 'inbox', bg: colors.surface, fg: colors.textPrimary }, ...STATES];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((item) => {
        const isActive = active === item.key;
        const count = item.key ? counts[item.key] : counts.total;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item.key)}
            className="tappable flex flex-col items-start gap-1 p-4 text-left"
            style={{
              backgroundColor: item.bg,
              color: item.fg,
              borderRadius: 'var(--radius-tile)',
              border: isActive ? `2px solid ${colors.gold}` : `1px solid ${colors.border}`,
            }}
          >
            <Icon name={item.icon} size={22} color={item.fg} />
            <span className="text-2xl font-black">{count}</span>
            <span className="text-xs font-bold">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de un reporte en la lista
// ---------------------------------------------------------------------------
function ReportCard({ report, location, onOpen }) {
  const category = categoryInfo(report.categoria);
  return (
    <button type="button" onClick={onOpen} className="tappable block w-full border-0 bg-transparent p-0 text-left">
      <Card className="flex h-full gap-3 p-3">
        {/* Miniatura: la foto o el ícono de la categoría */}
        <div
          className="flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden"
          style={{ backgroundColor: category.bg, borderRadius: 16 }}
        >
          {report.foto ? (
            <img src={report.foto} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Icon name={category.icon} size={34} color={category.fg} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-black" style={{ color: colors.blue }}>
              {report.folio}
            </span>
            <StateChip estado={report.estado} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm font-bold">
            <Icon name={category.icon} size={16} color={category.fg} />
            {category.label}
          </div>
          <p
            className="m-0 mt-1 line-clamp-2 text-sm"
            style={{ color: colors.textSecondary, lineHeight: 1.35 }}
          >
            {report.descripcion}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: colors.textMuted }}>
            <span className="inline-flex items-center gap-1">
              <Icon name="location_on" size={14} color={colors.textMuted} />
              {location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="schedule" size={14} color={colors.textMuted} />
              {formatDate(report.createdAt)}
            </span>
          </div>
        </div>
      </Card>
    </button>
  );
}
