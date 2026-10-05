// =====================================================================
// src/components/CampusMap.jsx
// Mapa interactivo de POLIMAP (Escuela Politécnica "Ing. Jorge Matute Remus")
// Responsable: Marcos — Mapa y geolocalización
//
// Qué hace este archivo:
//   1. Dibuja el mapa con Leaflet + OpenStreetMap, limitado al campus.
//   2. Pone un marcador por edificio (identificado por `number`, 1–10).
//   3. Al tocar un marcador abre una hoja inferior (bottom sheet) tipo Google Maps.
//   4. Botón dorado "Mi ubicación": GPS en tiempo real con punto azul que pulsa.
//   5. Botón "Cómo llegar": traza una línea desde tu ubicación hasta el edificio.
//
// Dependencias (una sola vez):  npm install leaflet@1.9 react-leaflet@4
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Colores: SOLO desde theme.js (paleta UdeG). Nada de hex sueltos aquí.
import { colors } from '../styles/theme.js';
// Los edificios se piden a api.js (si la API falla, api.js usa src/data/campusBuildings.js).
import { getBuildings } from '../lib/api.js';
// Ícono reutilizado del proyecto (Material Symbols).
import Icon from './Icon';

// ---------------------------------------------------------------------
// PASO 1. Configuración del campus (valores del proyecto)
// ---------------------------------------------------------------------
const CAMPUS = {
  // Centro: justo a la mitad de los 10 edificios (entre el 1 y el 10).
  centro: [20.746992, -103.380341],
  zoomInicial: 18,
  // Zoom mínimo 18: no deja alejar más allá del Poli.
  // Si intentan alejar de más, el mapa hace la animación de rebote y regresa.
  zoomMin: 18,
  zoomMax: 20,
  // Límites: [suroeste, noreste]. Un rectángulo alrededor de los 10 edificios
  // con un margen pequeño para que se vea solo el Poli.
  limites: [
    [20.7452, -103.3815],
    [20.7488, -103.3792],
  ],
};
const LIMITES = L.latLngBounds(CAMPUS.limites);

// ---------------------------------------------------------------------
// PASO 2. Coordenadas de los 10 edificios (medidas por Marcos)
// ---------------------------------------------------------------------
// Los edificios van de abajo (1) hacia arriba (10).
// Si la API o campusBuildings.js ya traen `lat`/`lng`, se usan esos;
// si no, se usan estos.
//
// Para CORREGIR un edificio: cambia sus números aquí.
// Para AGREGAR otro punto: añade una línea  numero: [lat, lng],
// usando un `number` que exista en campusBuildings.js.
const COORDENADAS_EDIFICIOS = {
  1: [20.746027, -103.380432],
  2: [20.746266, -103.380405],
  3: [20.746459, -103.380354],
  4: [20.746644, -103.380327],
  5: [20.74686, -103.380274],
  6: [20.747096, -103.380343],
  7: [20.747301, -103.380322],
  8: [20.747497, -103.380311],
  9: [20.74773, -103.380279],
  10: [20.747956, -103.38025],
};

// Tamaño de los marcadores de edificio (círculo con el número), en píxeles.
// ⬇️ CAMBIA SOLO ESTE NÚMERO para hacerlos más chicos o más grandes (antes era 36).
const TAMANO_PIN = 28;

// Velocidad promedio caminando (metros por segundo) para estimar minutos.
const VELOCIDAD_CAMINANDO = 1.3;

// ---------------------------------------------------------------------
// PASO 3. Funciones de ayuda
// ---------------------------------------------------------------------

// Distancia en metros entre dos puntos {lat, lng} (fórmula de Haversine).
function distanciaMetros(a, b) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function textoDistancia(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Modo demo para la exposición:
//   ?demo              → finge que estás en el centro del campus
//   ?demo=20.7466,-103.3799 → finge estar en ese punto
function leerModoDemo() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('demo')) return null;
  const valor = params.get('demo');
  if (valor) {
    const [lat, lng] = valor.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return { lat: CAMPUS.centro[0], lng: CAMPUS.centro[1] };
}

// Marcador de edificio: círculo con el número y una "colita" hacia abajo.
function iconoEdificio(numero, activo) {
  return L.divIcon({
    className: 'pm-pin-wrap', // reemplaza el estilo por defecto de Leaflet
    html: `<div class="pm-pin${activo ? ' is-active' : ''}"><span>${numero}</span></div>`,
    iconSize: [TAMANO_PIN, TAMANO_PIN + 8],
    iconAnchor: [TAMANO_PIN / 2, TAMANO_PIN + 6], // la punta de la colita toca la coordenada
  });
}

// Punto azul del usuario con pulso (las animaciones están en ESTILOS).
const ICONO_USUARIO = L.divIcon({
  className: 'pm-user-wrap',
  html: '<span class="pm-user__pulso"></span><span class="pm-user__punto"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// ---------------------------------------------------------------------
// PASO 4. Componentes internos (viven DENTRO de <MapContainer>)
// ---------------------------------------------------------------------

// Ajusta el tamaño del mapa cuando cambia su contenedor y escucha toques al mapa.
function ControlMapa({ onTocarMapa }) {
  const map = useMap();
  useMapEvents({ click: onTocarMapa });

  useEffect(() => {
    // Leaflet necesita recalcular su tamaño si el contenedor cambia (rotar el cel, etc.).
    const t = setTimeout(() => map.invalidateSize(), 0);
    const observador = new ResizeObserver(() => map.invalidateSize());
    observador.observe(map.getContainer());
    return () => {
      clearTimeout(t);
      observador.disconnect();
    };
  }, [map]);

  return null;
}

// Punto azul del usuario. Se mueve SUAVE entre lecturas del GPS
// (interpola durante 0.8 s en lugar de "brincar").
function UbicacionUsuario({ posicion }) {
  const map = useMap();
  const marcadorRef = useRef(null);
  const circuloRef = useRef(null);
  const animacionRef = useRef(null);

  useEffect(() => {
    // Sin posición (fuera del campus o GPS apagado): quitar el punto.
    if (!posicion) {
      cancelAnimationFrame(animacionRef.current);
      marcadorRef.current?.remove();
      circuloRef.current?.remove();
      marcadorRef.current = null;
      circuloRef.current = null;
      return;
    }

    const destino = L.latLng(posicion.lat, posicion.lng);

    // Primera lectura: crear el punto y el círculo de precisión.
    if (!marcadorRef.current) {
      marcadorRef.current = L.marker(destino, {
        icon: ICONO_USUARIO,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
      circuloRef.current = L.circle(destino, {
        radius: posicion.accuracy,
        color: colors.blue,
        weight: 1,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
      return;
    }

    // Lecturas siguientes: animar desde donde está hasta la nueva posición.
    circuloRef.current.setRadius(posicion.accuracy);
    const origen = marcadorRef.current.getLatLng();
    const inicio = performance.now();
    const duracion = 800;
    cancelAnimationFrame(animacionRef.current);

    const paso = (ahora) => {
      const t = Math.min((ahora - inicio) / duracion, 1);
      const suave = 1 - Math.pow(1 - t, 3); // desacelera al final
      const punto = L.latLng(
        origen.lat + (destino.lat - origen.lat) * suave,
        origen.lng + (destino.lng - origen.lng) * suave,
      );
      marcadorRef.current?.setLatLng(punto);
      circuloRef.current?.setLatLng(punto);
      if (t < 1) animacionRef.current = requestAnimationFrame(paso);
    };
    animacionRef.current = requestAnimationFrame(paso);
  }, [map, posicion]);

  // Al salir de la pantalla: limpiar.
  useEffect(
    () => () => {
      cancelAnimationFrame(animacionRef.current);
      marcadorRef.current?.remove();
      circuloRef.current?.remove();
    },
    [map],
  );

  return null;
}

// ---------------------------------------------------------------------
// PASO 5. Componente principal
// ---------------------------------------------------------------------
// Props:
//   focusNumber    → (opcional) número de edificio a abrir al entrar.
//                    Sirve para el botón "Ver en el mapa" de Gabo.
//   onOpenBuilding → (opcional) función(numero) para abrir la ficha completa.
//   alto           → alto del mapa. Por defecto toda la pantalla.
export default function CampusMap({ focusNumber = null, onOpenBuilding, alto = '100dvh' }) {
  const mapaRef = useRef(null);
  const hojaRef = useRef(null);
  const watchIdRef = useRef(null);
  const estadoCampusRef = useRef(null); // 'dentro' | 'fuera'
  const centrarAlLlegarRef = useRef(false);
  const rutaAjustadaRef = useRef(false);
  const timerAvisoRef = useRef(null);
  const ultimoSeleccionadoRef = useRef(null);

  const [edificios, setEdificios] = useState([]);
  const [seleccionadoNum, setSeleccionadoNum] = useState(null);
  const [posicion, setPosicion] = useState(null); // {lat, lng, accuracy} solo si está DENTRO
  const [rastreando, setRastreando] = useState(false);
  const [rutaActiva, setRutaActiva] = useState(false);
  const [aviso, setAviso] = useState(null); // {texto, tipo: 'info'|'ok'|'error'}
  const [alturaHoja, setAlturaHoja] = useState(0);

  const demo = useMemo(leerModoDemo, []);

  // --- Avisos flotantes (arriba de la pantalla) ---
  const mostrarAviso = useCallback((texto, tipo = 'info', ms = 4500) => {
    clearTimeout(timerAvisoRef.current);
    setAviso({ texto, tipo });
    if (ms) timerAvisoRef.current = setTimeout(() => setAviso(null), ms);
  }, []);

  // --- 5.1 Cargar edificios y asignar coordenadas ---
  useEffect(() => {
    let activo = true;
    Promise.resolve(getBuildings())
      .then((lista) => {
        if (!activo || !Array.isArray(lista)) return;
        const conCoordenadas = lista
          .map((b) => {
            const tieneCoords = b.lat != null && b.lng != null;
            const coords = tieneCoords
              ? [Number(b.lat), Number(b.lng)]
              : COORDENADAS_EDIFICIOS[b.number];
            if (!coords) return null; // sin coordenadas: no se dibuja
            // La ruta apunta a la entrada si existe; si no, al centro del edificio.
            const entrada =
              b.entrance?.lat != null
                ? [Number(b.entrance.lat), Number(b.entrance.lng)]
                : coords;
            return { ...b, coords, entrada };
          })
          .filter(Boolean);
        setEdificios(conCoordenadas);
      })
      .catch(() => mostrarAviso('No se pudieron cargar los edificios.', 'error'));
    return () => {
      activo = false;
    };
  }, [mostrarAviso]);

  // --- 5.2 Abrir un edificio desde fuera (botón "Ver en el mapa") ---
  useEffect(() => {
    if (focusNumber != null) setSeleccionadoNum(Number(focusNumber));
  }, [focusNumber]);

  const seleccionado = edificios.find((b) => b.number === seleccionadoNum) ?? null;
  if (seleccionado) ultimoSeleccionadoRef.current = seleccionado;
  // Mientras la hoja se cierra (animación) seguimos mostrando el último contenido.
  const contenidoHoja = seleccionado ?? ultimoSeleccionadoRef.current;

  // --- 5.3 Medir la hoja inferior (para no tapar el marcador ni los botones) ---
  useEffect(() => {
    const hoja = hojaRef.current;
    if (!hoja) return;
    const observador = new ResizeObserver(() => setAlturaHoja(hoja.offsetHeight));
    observador.observe(hoja);
    return () => observador.disconnect();
  }, []);
  const alturaVisible = seleccionado ? alturaHoja : 0;

  // --- 5.4 Centrar suavemente en el edificio elegido ---
  // Lo deja un poco ARRIBA del centro para que la hoja no lo tape.
  const numeroElegido = seleccionado?.number ?? null;
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || numeroElegido == null) return;
    const edificio = edificios.find((b) => b.number === numeroElegido);
    const id = requestAnimationFrame(() => {
      const zoom = Math.max(mapa.getZoom(), 18);
      const altoHoja = hojaRef.current?.offsetHeight ?? 0;
      const punto = mapa.project(edificio.coords, zoom).add([0, altoHoja / 2]);
      mapa.flyTo(mapa.unproject(punto, zoom), zoom, { duration: 0.6 });
    });
    return () => cancelAnimationFrame(id);
  }, [numeroElegido, edificios]);

  // --- 5.5 Recibir una lectura del GPS ---
  const recibirPosicion = useCallback(
    (lat, lng, accuracy) => {
      const dentro = LIMITES.contains([lat, lng]);
      if (dentro) {
        setPosicion({ lat, lng, accuracy });
        if (estadoCampusRef.current !== 'dentro') {
          mostrarAviso(demo ? 'DEMO · Estás en el campus' : 'Estás en el campus', 'ok');
        }
        if (centrarAlLlegarRef.current) {
          centrarAlLlegarRef.current = false;
          const mapa = mapaRef.current;
          mapa?.flyTo([lat, lng], Math.max(mapa.getZoom(), 18), { duration: 0.6 });
        }
      } else {
        // Fuera del campus no se dibuja el punto (el mapa está limitado al Poli).
        setPosicion(null);
        if (estadoCampusRef.current !== 'fuera') {
          mostrarAviso('Estás fuera del campus. El mapa solo muestra el Poli.', 'info', 6000);
        }
      }
      estadoCampusRef.current = dentro ? 'dentro' : 'fuera';
    },
    [demo, mostrarAviso],
  );

  const detenerUbicacion = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    estadoCampusRef.current = null;
    setRastreando(false);
    setPosicion(null);
  }, []);

  // --- 5.6 Encender el GPS (solo cuando el usuario lo pide) ---
  const iniciarUbicacion = useCallback(() => {
    // Modo demo: posición fija, sin pedir permiso.
    if (demo) {
      setRastreando(true);
      recibirPosicion(demo.lat, demo.lng, 10);
      return;
    }
    if (!window.isSecureContext) {
      mostrarAviso('La ubicación solo funciona en https o en localhost.', 'error', 7000);
      return;
    }
    if (!('geolocation' in navigator)) {
      mostrarAviso('Tu navegador no permite obtener la ubicación.', 'error', 7000);
      return;
    }
    if (watchIdRef.current !== null) return; // ya está encendido

    mostrarAviso('Buscando tu ubicación…', 'info', 0);
    setRastreando(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => recibirPosicion(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      (error) => {
        const mensajes = {
          1: 'Negaste el permiso de ubicación. Actívalo en el candado de la barra de direcciones y vuelve a tocar el botón.',
          2: 'No se pudo obtener tu ubicación. Revisa que el GPS esté encendido.',
          3: 'El GPS está tardando. Intenta en un lugar abierto.',
        };
        mostrarAviso(mensajes[error.code] ?? 'Error de ubicación.', 'error', 7000);
        if (error.code === 1) detenerUbicacion(); // sin permiso no tiene caso seguir
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, [demo, recibirPosicion, mostrarAviso, detenerUbicacion]);

  // Apagar el GPS al salir de la pantalla (ahorra batería).
  useEffect(
    () => () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      clearTimeout(timerAvisoRef.current);
    },
    [],
  );

  // --- 5.7 Botón dorado "Mi ubicación" ---
  const tocarMiUbicacion = () => {
    if (posicion) {
      const mapa = mapaRef.current;
      mapa?.flyTo([posicion.lat, posicion.lng], Math.max(mapa.getZoom(), 18), { duration: 0.6 });
      return;
    }
    centrarAlLlegarRef.current = true;
    if (rastreando && !demo) {
      mostrarAviso('Buscando tu ubicación…', 'info');
      return;
    }
    iniciarUbicacion();
  };

  // --- 5.8 "Cómo llegar": línea desde tu ubicación hasta el edificio ---
  const tocarComoLlegar = () => {
    if (rutaActiva) {
      setRutaActiva(false);
      return;
    }
    setRutaActiva(true);
    if (!rastreando) iniciarUbicacion();
    else if (!posicion) mostrarAviso('Necesitas estar dentro del campus para trazar la ruta.', 'info');
  };

  // Cuando hay ruta y ya tenemos tu posición, encuadrar ambos puntos UNA vez.
  useEffect(() => {
    if (!rutaActiva) {
      rutaAjustadaRef.current = false;
      return;
    }
    const mapa = mapaRef.current;
    if (!mapa || !posicion || !seleccionado || rutaAjustadaRef.current) return;
    rutaAjustadaRef.current = true;
    mapa.fitBounds(L.latLngBounds([[posicion.lat, posicion.lng], seleccionado.entrada]), {
      paddingTopLeft: [48, 96],
      paddingBottomRight: [48, alturaHoja + 32],
      maxZoom: 19,
    });
  }, [rutaActiva, posicion, seleccionado, alturaHoja]);

  // --- 5.9 Abrir / cerrar la hoja ---
  const elegirEdificio = (numero) => {
    setRutaActiva(false);
    setSeleccionadoNum(numero);
  };
  const cerrarHoja = useCallback(() => {
    setRutaActiva(false);
    setSeleccionadoNum(null);
  }, []);

  // Distancia en línea recta y minutos estimados caminando.
  const distancia =
    posicion && contenidoHoja
      ? distanciaMetros(posicion, { lat: contenidoHoja.entrada[0], lng: contenidoHoja.entrada[1] })
      : null;
  const minutos = distancia != null ? Math.max(1, Math.round(distancia / VELOCIDAD_CAMINANDO / 60)) : null;

  // ---------------------------------------------------------------------
  // PASO 6. Interfaz
  // ---------------------------------------------------------------------
  return (
    <div
      // `isolate` encierra las capas del mapa (Leaflet usa z-index muy altos)
      // para que la ficha del edificio y el asistente se abran ENCIMA del mapa.
      className="pm-mapa relative isolate w-full overflow-hidden"
      style={{
        height: alto,
        // Variables CSS tomadas de theme.js para usarlas en ESTILOS.
        '--pm-azul': colors.blue,
        '--pm-carmesi': colors.crimson,
        '--pm-oro': colors.gold,
        '--pm-pin': `${TAMANO_PIN}px`,
      }}
    >
      <style>{ESTILOS}</style>

      {/* Mapa */}
      <MapContainer
        ref={mapaRef}
        center={CAMPUS.centro}
        zoom={CAMPUS.zoomInicial}
        minZoom={CAMPUS.zoomMin}
        maxZoom={CAMPUS.zoomMax}
        maxBounds={LIMITES}
        // Viscosidad 0.85: deja arrastrar un poquito fuera del Poli y luego
        // regresa con animación (rebote). Con 1.0 se quedaría tieso, sin animación.
        maxBoundsViscosity={0.85}
        // Al pellizcar para alejar de más, rebota y regresa al zoom mínimo.
        bounceAtZoomLimits={true}
        zoomControl={false} // en el cel se usa pellizco para hacer zoom
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxNativeZoom={19} // OSM llega a 19; en 20 se amplía la imagen de 19
          maxZoom={CAMPUS.zoomMax}
        />

        <ControlMapa onTocarMapa={cerrarHoja} />
        <UbicacionUsuario posicion={posicion} />

        {/* Un marcador por edificio */}
        {edificios.map((b) => (
          <Marker
            key={b.number}
            position={b.coords}
            icon={iconoEdificio(b.number, b.number === seleccionadoNum)}
            zIndexOffset={b.number === seleccionadoNum ? 500 : 0}
            title={b.name || `Edificio ${b.number}`}
            eventHandlers={{ click: () => elegirEdificio(b.number) }}
          />
        ))}

        {/* Línea de "Cómo llegar" (línea recta, no sigue pasillos) */}
        {rutaActiva && posicion && seleccionado && (
          <Polyline
            positions={[[posicion.lat, posicion.lng], seleccionado.entrada]}
            pathOptions={{ color: colors.crimson, weight: 5, dashArray: '2 10', lineCap: 'round' }}
          />
        )}
      </MapContainer>

      {/* Aviso flotante arriba */}
      {aviso && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[1100] flex justify-center px-4">
          <div role="status" className={`pm-aviso pm-aviso--${aviso.tipo}`}>
            {demo && <span className="pm-demo">DEMO</span>}
            {aviso.texto}
          </div>
        </div>
      )}

      {/* Botón dorado "Mi ubicación" (sube cuando se abre la hoja) */}
      <button
        type="button"
        onClick={tocarMiUbicacion}
        aria-label="Mi ubicación"
        className={`pm-fab ${posicion ? 'is-on' : ''}`}
        style={{ bottom: alturaVisible + 28 }}
      >
        <Icon name={posicion ? 'my_location' : 'location_searching'} />
      </button>

      {/* Hoja inferior estilo Google Maps */}
      <section
        ref={hojaRef}
        className="pm-hoja"
        data-abierta={seleccionado ? 'true' : 'false'}
        aria-hidden={!seleccionado}
        aria-label={contenidoHoja ? `Información del edificio ${contenidoHoja.number}` : undefined}
      >
        <div className="pm-hoja__asa" aria-hidden="true" />
        {contenidoHoja && (
          <div className="flex flex-col gap-3 px-5 pb-5">
            <header className="flex items-start gap-3">
              {contenidoHoja.photo ? (
                <img
                  src={`${import.meta.env.BASE_URL}${contenidoHoja.photo}`}
                  alt=""
                  className="pm-hoja__foto"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <div
                  className="pm-hoja__numero"
                  style={{ background: colors[contenidoHoja.color] ?? colors.blue }}
                >
                  {contenidoHoja.number}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="pm-hoja__sub">Edificio {contenidoHoja.number}</p>
                <h2 className="pm-hoja__titulo">{contenidoHoja.name || `Edificio ${contenidoHoja.number}`}</h2>
                {contenidoHoja.summary && <p className="pm-hoja__resumen">{contenidoHoja.summary}</p>}
              </div>
              <button type="button" onClick={cerrarHoja} aria-label="Cerrar" className="pm-hoja__cerrar">
                <Icon name="close" />
              </button>
            </header>

            {contenidoHoja.description && <p className="pm-hoja__texto">{contenidoHoja.description}</p>}

            {distancia != null && (
              <p className="pm-hoja__meta">
                A {textoDistancia(distancia)} en línea recta · ~{minutos} min caminando
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={tocarComoLlegar} className="pm-btn pm-btn--principal">
                <Icon name={rutaActiva ? 'close' : 'directions_walk'} />
                {rutaActiva ? 'Quitar ruta' : 'Cómo llegar'}
              </button>
              {onOpenBuilding && (
                <button
                  type="button"
                  onClick={() => onOpenBuilding(contenidoHoja.number)}
                  className="pm-btn pm-btn--secundario"
                >
                  <Icon name="info" />
                  Ver ficha
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------
// PASO 7. Estilos propios del mapa
// ---------------------------------------------------------------------
// Leaflet dibuja los marcadores con HTML suelto, por eso estos estilos van en CSS
// y no en clases de Tailwind. Los colores salen de las variables --pm-* (theme.js).
const ESTILOS = `
.pm-mapa .leaflet-container { font: inherit; background: color-mix(in srgb, var(--pm-azul) 6%, white); }

/* Marcador de edificio */
.pm-pin-wrap { background: none; border: 0; }
.pm-pin {
  position: relative; width: var(--pm-pin); height: var(--pm-pin); border-radius: 50%;
  display: grid; place-items: center;
  background: var(--pm-azul); color: white; font-weight: 700; font-size: calc(var(--pm-pin) * .45);
  border: 2px solid white; box-shadow: 0 2px 5px rgb(0 0 0 / .35);
  transform-origin: 50% calc(var(--pm-pin) + 6px); transition: transform .2s ease, background .2s ease;
}
.pm-pin::after {
  content: ""; position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%);
  border: 5px solid transparent; border-top: 7px solid white;
}
.pm-pin.is-active { background: var(--pm-carmesi); transform: scale(1.2); }

/* Punto azul del usuario con pulso */
.pm-user-wrap { background: none; border: 0; }
.pm-user__punto, .pm-user__pulso { position: absolute; inset: 0; border-radius: 50%; }
.pm-user__punto { background: var(--pm-azul); border: 3px solid white; box-shadow: 0 1px 4px rgb(0 0 0 / .4); }
.pm-user__pulso { background: var(--pm-azul); opacity: .4; animation: pm-pulso 1.8s ease-out infinite; }
@keyframes pm-pulso { from { transform: scale(1); opacity: .45; } to { transform: scale(3.2); opacity: 0; } }

/* Aviso flotante */
.pm-aviso {
  pointer-events: auto; max-width: 28rem; padding: .6rem 1rem; border-radius: 999px;
  font-size: .9rem; line-height: 1.3; color: white; background: var(--pm-azul);
  box-shadow: 0 4px 14px rgb(0 0 0 / .25); display: flex; align-items: center; gap: .5rem;
}
.pm-aviso--error { background: var(--pm-carmesi); border-radius: 1rem; }
.pm-demo { font-size: .7rem; font-weight: 700; padding: .1rem .4rem; border-radius: .3rem; background: var(--pm-oro); color: var(--pm-azul); }

/* Botón dorado "Mi ubicación" */
.pm-fab {
  position: absolute; right: 16px; z-index: 1100; width: 52px; height: 52px; border-radius: 50%;
  display: grid; place-items: center; background: var(--pm-oro); color: var(--pm-azul);
  box-shadow: 0 4px 12px rgb(0 0 0 / .3); transition: bottom .28s cubic-bezier(.2,.8,.2,1);
  -webkit-tap-highlight-color: transparent;
}
.pm-fab:active { transform: scale(.94); }
.pm-fab.is-on { color: var(--pm-azul); outline: 3px solid white; }

/* Hoja inferior (bottom sheet) */
.pm-hoja {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 1100;
  max-height: 45%; overflow-y: auto; overscroll-behavior: contain;
  background: white; border-radius: 20px 20px 0 0;
  box-shadow: 0 -6px 24px rgb(0 0 0 / .18);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  transform: translateY(110%); transition: transform .28s cubic-bezier(.2,.8,.2,1);
}
.pm-hoja[data-abierta="true"] { transform: none; }
.pm-hoja__asa { width: 40px; height: 5px; border-radius: 3px; margin: 10px auto 12px; background: color-mix(in srgb, var(--pm-azul) 25%, white); }
.pm-hoja__foto, .pm-hoja__numero { width: 56px; height: 56px; border-radius: 14px; flex: none; object-fit: cover; }
.pm-hoja__numero { display: grid; place-items: center; color: white; font-size: 1.4rem; font-weight: 700; }
.pm-hoja__sub { font-size: .8rem; color: var(--pm-carmesi); font-weight: 600; }
.pm-hoja__titulo { font-size: 1.15rem; font-weight: 700; color: var(--pm-azul); line-height: 1.25; }
.pm-hoja__resumen { font-size: .9rem; opacity: .75; margin-top: .15rem; }
.pm-hoja__texto { font-size: .92rem; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.pm-hoja__meta { font-size: .85rem; color: var(--pm-azul); font-weight: 600; }
.pm-hoja__cerrar {
  flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
  background: color-mix(in srgb, var(--pm-azul) 8%, white); color: var(--pm-azul);
}

/* Botones de la hoja */
.pm-btn {
  flex: 1; min-height: 46px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  gap: .4rem; font-weight: 600; font-size: .95rem; -webkit-tap-highlight-color: transparent;
}
.pm-btn:active { transform: scale(.98); }
.pm-btn--principal { background: var(--pm-azul); color: white; }
.pm-btn--secundario { background: color-mix(in srgb, var(--pm-azul) 8%, white); color: var(--pm-azul); }

/* Accesibilidad: sin animaciones si el usuario lo pidió en su sistema */
@media (prefers-reduced-motion: reduce) {
  .pm-user__pulso { animation: none; }
  .pm-hoja, .pm-fab, .pm-pin { transition: none; }
}
`;
