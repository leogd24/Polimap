// src/admin/AdminApp.jsx — Responsable: Alexis
// Panel de administración v2 (https://polimap.ct.ws/admin.html).
//
// Paso a paso:
//   1. Pregunta a la API si hay sesión (getSession). Si no hay, o la cuenta
//      no es administradora, muestra AdminLogin (contraseña, Google o código).
//   2. Con sesión de admin: carga todos los reportes y los edificios.
//   3. Cada 30 s vuelve a pedir los reportes (si la pestaña está visible).
//      Si llegaron nuevos: los marca como NUEVO, avisa y, si está activado,
//      suena un "ding".
//   4. Menú lateral con 6 secciones (la de Accesos solo para el maestro).
//      La sección elegida queda en la dirección (#mapa, #avisos…).
//
// La seguridad real está en el servidor: sin sesión de admin la API
// responde 401/403 y no entrega nada.
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { getSession, logout, getAllReports, getBuildings, updateReport } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import Snackbar from '../components/Snackbar.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import AdminLogin from './AdminLogin.jsx';
import Sidebar, { SECTIONS } from './Sidebar.jsx';
import DashboardSection from './DashboardSection.jsx';
import StatsSection from './StatsSection.jsx';
import NoticesSection from './NoticesSection.jsx';
import HistorySection from './HistorySection.jsx';
import AccessSection from './AccessSection.jsx';
import ReportDetail from './ReportDetail.jsx';
import { EMPTY_FILTERS, stateInfo, locationText, timeAgo } from './reportMeta.js';

// El mapa trae Leaflet (pesado): se descarga solo al abrir esa sección.
const MapSection = lazy(() => import('./MapSection.jsx'));

const REFRESH_MS = 30000;
const SOUND_KEY = 'polimap.admin.sonido';

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}
function saveSound(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    // Sin almacenamiento: solo no se recuerda.
  }
}

/** "Ding" corto con Web Audio (sin archivos de sonido). */
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // El navegador no deja sonar sin que el usuario haya tocado algo antes.
  }
}

function sectionFromHash() {
  const key = window.location.hash.replace('#', '');
  return SECTIONS.some((s) => s.key === key) ? key : 'tablero';
}

export default function AdminApp() {
  // --- Sesión ---------------------------------------------------------------
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionError, setSessionError] = useState('');

  const loadSession = useCallback(() => {
    getSession()
      .then((data) => {
        setSession(data);
        setUser(data.usuario?.permisos?.admin ? data.usuario : null);
        if (data.usuario && !data.usuario.permisos?.admin) {
          setSessionError(`La cuenta ${data.usuario.correo} no es administradora. Entra con un correo autorizado.`);
        }
      })
      .catch((error) => setSessionError(error.message));
  }, []);

  useEffect(loadSession, [loadSession]);

  useEffect(() => {
    const onClosed = () => {
      setUser(null);
      loadSession();
    };
    window.addEventListener('polimap:sesion-cerrada', onClosed);
    return () => window.removeEventListener('polimap:sesion-cerrada', onClosed);
  }, [loadSession]);

  async function handleLogout() {
    await logout();
    setUser(null);
    setSessionError('');
    loadSession();
  }

  if (!session && !sessionError) {
    return <Loading />;
  }
  if (!user) {
    return (
      <AdminLogin
        session={session ?? {}}
        hint={sessionError || undefined}
        onLoggedIn={(u) => {
          setSessionError('');
          setUser(u);
        }}
      />
    );
  }
  return <Panel user={user} onLogout={handleLogout} />;
}

// ---------------------------------------------------------------------------
// Panel con sesión
// ---------------------------------------------------------------------------
function Panel({ user, onLogout }) {
  const [section, setSection] = useState(sectionFromHash);
  const [drawer, setDrawer] = useState(false);
  const [reports, setReports] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedFolio, setSelectedFolio] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sound, setSound] = useState(readSound);
  const [newFolios, setNewFolios] = useState(() => new Set());
  const [historyKey, setHistoryKey] = useState(0);
  const knownFolios = useRef(null); // folios que ya conocíamos (null = primera carga)
  const [, setTick] = useState(0); // re-dibuja "hace X s"

  // 1) Cargar reportes (y detectar nuevos) -----------------------------------
  const loadReports = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await getAllReports();
        setReports(data);
        setLastUpdate(new Date());

        const folios = new Set(data.map((r) => r.folio));
        if (knownFolios.current) {
          const fresh = data.filter((r) => !knownFolios.current.has(r.folio)).map((r) => r.folio);
          if (fresh.length) {
            setNewFolios((prev) => new Set([...prev, ...fresh]));
            setMessage(fresh.length === 1 ? `Llegó un reporte nuevo: ${fresh[0]}` : `Llegaron ${fresh.length} reportes nuevos`);
            if (sound) playDing();
          }
        }
        knownFolios.current = folios;
      } catch (error) {
        if (error.status !== 401) setMessage(`No se pudieron cargar los reportes: ${error.message}`);
      } finally {
        setLoading(false);
      }
    },
    [sound]
  );

  useEffect(() => {
    loadReports();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Actualizar solo cada 30 s, cuando la pestaña está a la vista --------
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadReports(true);
      setTick((t) => t + 1);
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && loadReports(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadReports]);

  useEffect(() => {
    getBuildings().then(setBuildings);
  }, []);

  // "Actualizado hace X s" se redibuja cada 5 s.
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // 3) Sección en la dirección (#mapa) ---------------------------------------
  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  function go(key) {
    window.location.hash = key;
    setSection(key);
    setDrawer(false);
    window.scrollTo(0, 0);
  }

  // 4) Datos derivados ----------------------------------------------------------
  const buildingNames = useMemo(() => Object.fromEntries(buildings.map((b) => [b.number, b.name])), [buildings]);
  const pending = reports.filter((r) => r.estado === 'recibido').length;

  // Título de la pestaña con los pendientes: "(3) Panel POLIMAP".
  useEffect(() => {
    document.title = `${pending ? `(${pending}) ` : ''}Panel POLIMAP`;
  }, [pending]);

  const selected = reports.find((r) => r.folio === selectedFolio) || null;

  function openReport(folio) {
    setSelectedFolio(folio);
    setNewFolios((prev) => {
      if (!prev.has(folio)) return prev;
      const next = new Set(prev);
      next.delete(folio);
      return next;
    });
  }

  // Cuando ReportDetail guarda, actualizamos ese reporte en la lista.
  function handleSaved(updated) {
    setReports((list) => list.map((r) => (r.folio === updated.folio ? { ...r, ...updated } : r)));
    setMessage(`${updated.folio} guardado (${stateInfo(updated.estado).label}).`);
    setHistoryKey((k) => k + 1);
  }

  // Arrastrar en el Kanban: cambia en pantalla de inmediato y, si la API
  // falla, lo regresa a como estaba.
  async function moveReport(folio, estado) {
    const before = reports.find((r) => r.folio === folio);
    setReports((list) => list.map((r) => (r.folio === folio ? { ...r, estado } : r)));
    try {
      const result = await updateReport(folio, { estado });
      setReports((list) => list.map((r) => (r.folio === folio ? { ...r, ...result } : r)));
      setMessage(`${folio} → ${stateInfo(estado).label}`);
      setHistoryKey((k) => k + 1);
    } catch (error) {
      setReports((list) => list.map((r) => (r.folio === folio ? before : r)));
      setMessage(`No se pudo mover ${folio}: ${error.message}`);
    }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    saveSound(next);
    if (next) playDing(); // también sirve para "desbloquear" el audio del navegador
  }

  const shared = { reports, buildings, buildingNames, filters, onFiltersChange: setFilters, onOpen: openReport };
  const current = SECTIONS.find((s) => s.key === section && (!s.maestro || user.permisos.maestro)) ? section : 'tablero';
  const sidebarProps = { user, current, onSelect: go, pending, onLogout, sound, onToggleSound: toggleSound };

  return (
    <div className="min-h-full lg:pl-[290px]" style={{ backgroundColor: colors.background }}>
      {/* Menú lateral fijo en computadora */}
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar {...sidebarProps} />
      </div>

      {/* Cajón en celular */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex lg:hidden" style={{ backgroundColor: alpha('#000000', 0.45) }} onClick={() => setDrawer(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <Sidebar {...sidebarProps} />
          </div>
        </div>
      )}

      {/* Barra superior: solo en celular (en computadora todo está en el menú y en el Tablero) */}
      <header
        className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 lg:hidden"
        style={{ backgroundColor: alpha(colors.background, 0.92), backdropFilter: 'blur(8px)', borderBottom: `1px solid ${colors.border}` }}
      >
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Abrir menú"
          className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0 lg:hidden"
          style={{ backgroundColor: colors.surface }}
        >
          <Icon name="menu" color={colors.textPrimary} />
        </button>
        <span className="lg:hidden">
          <PolimapLogo size={34} />
        </span>
        {/* En el Tablero el estado ya sale junto al título; aquí solo en las otras secciones */}
        <span
          className={`items-center gap-2 text-xs ${current === 'tablero' ? 'hidden' : 'inline-flex'}`}
          style={{ color: colors.textSecondary }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: loading ? colors.gold : colors.green }}
            aria-hidden="true"
          />
          {loading ? 'Actualizando…' : lastUpdate ? `Actualizado ${timeAgo(lastUpdate.toISOString())}` : ''}
        </span>
        <span className="flex-1" />
        <TopButton icon={sound ? 'notifications_active' : 'notifications_off'} label={sound ? 'Sonido activado' : 'Sonido apagado'} onClick={toggleSound} />
        <TopButton icon="refresh" label="Actualizar" onClick={() => loadReports()} />
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 lg:px-8 lg:pt-7">
        {current === 'tablero' && (
          <DashboardSection
            {...shared}
            onMove={moveReport}
            newFolios={newFolios}
            loading={loading}
            lastUpdate={lastUpdate}
            onRefresh={() => loadReports()}
            onGoTo={go}
            user={user}
          />
        )}
        {current === 'mapa' && (
          <Suspense fallback={<p style={{ color: colors.textMuted }}>Cargando mapa…</p>}>
            <MapSection {...shared} />
          </Suspense>
        )}
        {current === 'estadisticas' && <StatsSection {...shared} />}
        {current === 'avisos' && <NoticesSection onMessage={setMessage} />}
        {current === 'historial' && <HistorySection onOpen={openReport} onMessage={setMessage} refreshKey={historyKey} />}
        {current === 'accesos' && <AccessSection onMessage={setMessage} />}
      </main>

      {selected && (
        <ReportDetail
          key={`${selected.folio}-${selected.updatedAt}`}
          report={selected}
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

function TopButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="tappable flex h-11 w-11 items-center justify-center rounded-full border-0"
      style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <Icon name={icon} size={22} color={colors.textSecondary} />
    </button>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center" style={{ backgroundColor: colors.blueDeep }}>
      <PolimapLogo size={72} />
    </div>
  );
}
