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
//   5. Botón "Cómo llegar": ruta a pie POR LOS PASILLOS (src/data/campusPaths.js),
//      con indicaciones paso a paso, opción sin escaleras, te sigue mientras
//      caminas, se recalcula si te desvías y avisa cuando llegas.
//   6. Edificios en 3D (cajitas con relieve) y gotas estilo Google Maps con brinco.
//   7. Si estás fuera del Poli: el mapa se pinta de rojo 4 s con un aviso al centro.
//   8. ?trazar → herramienta para dibujar los pasillos (CampusPathEditor.jsx).
//   9. "Venitas": los pasillos se ven siempre como líneas verdes delgadas.
//  10. Lugares que no son edificios (canchas, cafetería) desde campusLugares.js.
//  11. Se adapta al modo claro/oscuro de la app (colores de theme.css).
//
// Dependencias (una sola vez):  npm install leaflet@1.9 react-leaflet@4
// =====================================================================

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Colores: SOLO desde theme.js (paleta UdeG). Nada de hex sueltos aquí.
import { colors } from '../styles/theme.js';
// Los edificios se piden a api.js (si la API falla, api.js usa src/data/campusBuildings.js).
import { getBuildings } from '../lib/api.js';
// Ícono reutilizado del proyecto (Material Symbols).
import Icon from './Icon';
// Pasillos del Poli y el cálculo de rutas a pie.
import { PASILLOS } from '../data/campusPaths.js';
import { LUGARES_EXTRA } from '../data/campusLugares.js';
import { crearRed, calcularRuta, nodoMasCercano, distancia as metrosEntre } from '../lib/campusRouting.js';
// Herramienta para trazar los pasillos (solo con ?trazar).
import { useEditorPasillos, EditorCapas, EditorPanel } from './CampusPathEditor.jsx';

// ---------------------------------------------------------------------
// PASO 1. Configuración del campus (valores del proyecto)
// ---------------------------------------------------------------------
export const CAMPUS = {
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
export const COORDENADAS_EDIFICIOS = {
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

// ---------------------------------------------------------------------
// PASO 2b. Edificios en 3D
// ---------------------------------------------------------------------
// Cada edificio se dibuja como una cajita: la "planta" (rectángulo en el piso),
// las paredes y el techo levantado. Las medidas van en METROS.
//   largo → de izquierda a derecha (oeste-este)
//   fondo → de abajo hacia arriba (sur-norte)
//   pisos → cuántos pisos tiene (hace la cajita más alta)
//   giro  → grados para girar el rectángulo si el edificio está chueco
// Todos usan MEDIDAS_3D_DEFECTO, salvo los que pongas en MEDIDAS_3D.
const MEDIDAS_3D_DEFECTO = { largo: 38, fondo: 11, pisos: 2, giro: 0 };
// Ejemplo para ajustar uno:  4: { largo: 45, pisos: 3 },
//
// EDIFICIOS CON FORMA RARA (como el 2): se arman con varias cajitas pegadas
// usando `partes`. Cada parte tiene su largo y fondo, y se recorre con:
//   este  → metros a la derecha (+) o a la izquierda (-) del punto del edificio
//   norte → metros hacia arriba (+) o hacia abajo (-)
// El giro y los pisos se comparten entre todas las partes.
const MEDIDAS_3D = {
  1: { giro: -8 },
  2: {
    giro: -9,
    partes: [
      { largo: 30, fondo: 14, este: -5, norte: 0 }, // bloque grande
      { largo: 10, fondo: 10, este: 15, norte: 1 }, // bloque chico (derecha)
    ],
  },
  3: { giro: -10 },
  4: { giro: -10 },
  5: { giro: -10 },
  6: { giro: -4 },
  7: { giro: -10 },
  8: { giro: -8 },
  9: { largo: 32, fondo: 17, giro: -9 },
  10: { largo: 32, fondo: 17, giro: -9 },
};
const METROS_POR_PISO = 3.5;
// Hacia dónde "sube" el techo para dar el efecto 3D (perspectiva).
// norte: qué tanto sube; este: qué tanto se ladea a la derecha.
const PERSPECTIVA = { norte: 0.55, este: 0.15 };

// Tamaño de los marcadores de edificio, en píxeles:
//   TAMANO_PIN  → bolita 3D con el número (edificios NO seleccionados)
//   TAMANO_GOTA → ancho de la gota estilo Google Maps (edificio SELECCIONADO)
// ⬇️ Cambia estos números para hacerlos más chicos o más grandes.
const TAMANO_PIN = 28;
const TAMANO_GOTA = 26;

// "Cómo llegar":
const METROS_LLEGADA = 15; // a esta distancia de la entrada se considera que llegaste
const ALTO_BARRA_NAV = 84; // alto aproximado de la barra de arriba durante la navegación
const MODO_TRAZAR = new URLSearchParams(window.location.search).has('trazar');

// Lugares que no son edificios (canchas, cafetería…), listos para el mapa.
// Se manejan igual que un edificio, pero su `number` es su id ('canchas') y no
// tienen cajita 3D ni ficha.
const LUGARES_MAPA = LUGARES_EXTRA.map((l) => ({
  ...l,
  number: l.id,
  esLugar: true,
  entrada: l.coords,
  geo: { cajas: [], cima: l.coords },
}));

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

// Arrastrar con el dedo (o con el mouse) una hoja hacia arriba o hacia abajo.
// Regresa las props para la zona que se agarra y cuánto se ha movido (dy).
//   onArriba → se soltó después de jalar hacia arriba
//   onAbajo  → se soltó después de jalar hacia abajo
//   onToque  → fue solo un toque (sin arrastrar)
// Un jalón rápido cuenta aunque sea corto, como en Google Maps.
function useArrastre({ onArriba, onAbajo, onToque, umbral = 60 }) {
  const inicioRef = useRef(null);
  const [dy, setDy] = useState(0);

  const soltar = (e) => {
    const inicio = inicioRef.current;
    if (!inicio) return;
    inicioRef.current = null;
    setDy(0);
    const movido = e.clientY - inicio.y;
    const rapido = performance.now() - inicio.t < 250 && Math.abs(movido) > 25;
    if (movido > umbral || (rapido && movido > 0)) onAbajo?.();
    else if (movido < -umbral || (rapido && movido < 0)) onArriba?.();
    else if (Math.abs(movido) < 6) onToque?.();
  };

  return {
    dy,
    props: {
      onPointerDown: (e) => {
        // Los botones (como la X) funcionan normal; no empiezan un arrastre.
        if (e.button > 0 || e.target.closest('button')) return;
        inicioRef.current = { y: e.clientY, t: performance.now() };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        if (inicioRef.current) setDy(e.clientY - inicioRef.current.y);
      },
      onPointerUp: soltar,
      onPointerCancel: () => {
        inicioRef.current = null;
        setDy(0);
      },
    },
  };
}

// Mueve un punto [lat, lng] cierta cantidad de metros al este y al norte.
function moverMetros([lat, lng], este, norte) {
  const metrosPorGrado = 111320;
  return [
    lat + norte / metrosPorGrado,
    lng + este / (metrosPorGrado * Math.cos((lat * Math.PI) / 180)),
  ];
}

// Calcula los puntos de las cajitas 3D de un edificio.
// Regresa: cajas (cada una con piso, techo y paredes) y cima (donde va el pin).
function geometria3D(numero, centro) {
  const m = { ...MEDIDAS_3D_DEFECTO, ...MEDIDAS_3D[numero] };
  const giro = (m.giro * Math.PI) / 180;
  const altura = m.pisos * METROS_POR_PISO;
  // El techo es el mismo rectángulo, recorrido hacia "arriba" según la altura.
  const subeEste = altura * PERSPECTIVA.este;
  const subeNorte = altura * PERSPECTIVA.norte;
  const girar = ([x, y]) => [x * Math.cos(giro) - y * Math.sin(giro), x * Math.sin(giro) + y * Math.cos(giro)];

  // Si no tiene `partes`, es una sola cajita con el largo y fondo normales.
  const partes = m.partes ?? [{ largo: m.largo, fondo: m.fondo, este: 0, norte: 0 }];

  const cajas = partes.map((parte) => {
    const cx = parte.este ?? 0;
    const cy = parte.norte ?? 0;
    // Esquinas del rectángulo (en metros desde el punto del edificio), ya giradas.
    const esquinas = [
      [cx - parte.largo / 2, cy - parte.fondo / 2],
      [cx + parte.largo / 2, cy - parte.fondo / 2],
      [cx + parte.largo / 2, cy + parte.fondo / 2],
      [cx - parte.largo / 2, cy + parte.fondo / 2],
    ].map(girar);
    const piso = esquinas.map(([x, y]) => moverMetros(centro, x, y));
    const techo = esquinas.map(([x, y]) => moverMetros(centro, x + subeEste, y + subeNorte));
    // Cada pared une un lado del piso con el mismo lado del techo.
    const paredes = piso.map((p, k) => {
      const l = (k + 1) % 4;
      return [p, piso[l], techo[l], techo[k]];
    });
    return { piso, techo, paredes };
  });

  const cima = moverMetros(centro, subeEste, subeNorte);
  return { cajas, cima };
}

// Cómo se llama cada cosa del mapa (edificio o lugar como las canchas).
//   nombreCorto → "Edificio 3" / "Late servir"
//   nombreMeta  → para "Llegas a ___": "la entrada del Edificio 3" / "las canchas"
//   aLaMeta     → para "¡Llegaste ___!": "al Edificio 3" / "a las canchas"
const nombreCorto = (b) => (b.esLugar ? b.name : `Edificio ${b.number}`);
const nombreMeta = (b) => (b.esLugar ? b.destino : `la entrada del Edificio ${b.number}`);
const aLaMeta = (b) => (b.esLugar ? `a ${b.destino}` : `al Edificio ${b.number}`);

// Evita que un nombre con < o & rompa el HTML del marcador.
function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Marcador de cada edificio:
//   - Normal: la bolita 3D con el número (la de antes).
//   - Seleccionado: cambia a la gota estilo Google Maps (carmesí con punto oscuro),
//     con el nombre a un lado; brinca y sale una onda dorada.
const ALTO_GOTA = Math.round(TAMANO_GOTA * 1.55);
function iconoEdificio(edificio, activo) {
  if (!activo) {
    return L.divIcon({
      className: 'pm-pin-wrap', // reemplaza el estilo por defecto de Leaflet
      html: `<div class="pm-pin">
          <span class="pm-pin__sombra"></span>
          <span class="pm-pin__cuerpo">${
            edificio.esLugar
              ? `<span class="material-symbols-rounded pm-pin__icono">${escaparHtml(edificio.icono)}</span>`
              : `<span>${edificio.number}</span>`
          }</span>
        </div>`,
      iconSize: [TAMANO_PIN, TAMANO_PIN + 10],
      iconAnchor: [TAMANO_PIN / 2, TAMANO_PIN + 6], // la punta de la colita toca el techo
    });
  }
  const nombre = escaparHtml(edificio.name || `Edificio ${edificio.number}`);
  const etiqueta = edificio.esLugar || nombre.startsWith('Edificio') ? nombre : `${edificio.number} · ${nombre}`;
  return L.divIcon({
    className: 'pm-pin-wrap', // reemplaza el estilo por defecto de Leaflet
    html: `<div class="pm-gota${activo ? ' is-active' : ''}">
        <span class="pm-gota__onda"></span>
        <span class="pm-gota__sombra"></span>
        <svg class="pm-gota__forma" viewBox="0 0 26 40" aria-hidden="true">
          <path d="M13 1C6.4 1 1 6.3 1 12.9c0 8.7 10.2 19.6 11.1 25.6.1.6.5.9.9.9s.8-.3.9-.9C14.8 32.5 25 21.6 25 12.9 25 6.3 19.6 1 13 1z"/>
          <circle cx="13" cy="13" r="4.6"/>
        </svg>
        <span class="pm-gota__nombre">${etiqueta}</span>
      </div>`,
    iconSize: [TAMANO_GOTA, ALTO_GOTA],
    iconAnchor: [TAMANO_GOTA / 2, ALTO_GOTA - 1], // la punta toca el techo del edificio
  });
}

// Iconito de rampa (silla de ruedas) sobre las rampas.
const ICONO_RAMPA = L.divIcon({
  className: 'pm-pin-wrap',
  html: '<div class="pm-rampa"><span class="material-symbols-rounded">accessible</span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Banderita en la entrada del edificio cuando hay ruta.
const ICONO_META = L.divIcon({
  className: 'pm-pin-wrap',
  html: '<div class="pm-meta"><span class="material-symbols-rounded">flag</span></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

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
function ControlMapa({ onTocarMapa, onArrastrar }) {
  const map = useMap();
  useMapEvents({ click: onTocarMapa, dragstart: onArrastrar });

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
//                    Sirve para el botón "Ver en el mapa" del asistente.
//   focusKey       → (opcional) cambia en cada clic de "Ver en el mapa" para que
//                    se vuelva a abrir aunque sea el mismo edificio.
//   onOpenBuilding → (opcional) función(numero) para abrir la ficha completa.
//   alto           → alto del mapa. Por defecto toda la pantalla.
export default function CampusMap({ focusNumber = null, focusKey, onOpenBuilding, alto = '100dvh' }) {
  const mapaRef = useRef(null);
  const hojaRef = useRef(null);
  const watchIdRef = useRef(null);
  const estadoCampusRef = useRef(null); // 'dentro' | 'fuera'
  const centrarAlLlegarRef = useRef(false);
  const rutaAjustadaRef = useRef(false);
  const timerAvisoRef = useRef(null);
  const ultimoSeleccionadoRef = useRef(null);
  const seleccionadoNumRef = useRef(null);
  const timerCambioRef = useRef(null);
  const timerFueraRef = useRef(null);

  const [edificios, setEdificios] = useState([]);
  const [seleccionadoNum, setSeleccionadoNum] = useState(null);
  const [posicion, setPosicion] = useState(null); // {lat, lng, accuracy} solo si está DENTRO
  const [rastreando, setRastreando] = useState(false);
  const [rutaActiva, setRutaActiva] = useState(false);
  const [aviso, setAviso] = useState(null); // {texto, tipo: 'info'|'ok'|'error'}
  const [alturaHoja, setAlturaHoja] = useState(0);
  const [alertaFuera, setAlertaFuera] = useState(false); // mapa en rojo 4 s
  // Navegación ("Cómo llegar")
  const [sinEscaleras, setSinEscaleras] = useState(false); // ruta accesible
  const [seguir, setSeguir] = useState(false); // el mapa te sigue mientras caminas
  const [verPasos, setVerPasos] = useState(false); // lista completa de indicaciones
  const nodosRutaRef = useRef(null); // ruta anterior, para saber si se recalculó
  seleccionadoNumRef.current = seleccionadoNum;

  // Red de pasillos (se arma una sola vez) y herramienta de trazado.
  const red = useMemo(() => crearRed(PASILLOS), []);
  // Dónde poner el iconito de cada rampa: una rampa son 2 tramos seguidos
  // (A → medio → B); el ícono va en el punto de en medio. Si es de un solo
  // tramo, va a la mitad del tramo.
  const puntosRampa = useMemo(() => {
    const rampas = red.tramos.filter((t) => t.tipo === 'rampa');
    const cuantas = {};
    rampas.forEach((t) => {
      cuantas[t.a] = (cuantas[t.a] ?? 0) + 1;
      cuantas[t.b] = (cuantas[t.b] ?? 0) + 1;
    });
    const puntos = [];
    rampas.forEach((t) => {
      const otros = red.vecinos[t.b].filter((v) => v.tramo.tipo !== 'rampa').length;
      if (cuantas[t.b] === 2 && otros === 0) puntos.push(red.nodos[t.b]); // punto de en medio
      else if (cuantas[t.a] !== 2 && cuantas[t.b] !== 2) {
        puntos.push([(red.nodos[t.a][0] + red.nodos[t.b][0]) / 2, (red.nodos[t.a][1] + red.nodos[t.b][1]) / 2]);
      }
    });
    return puntos;
  }, [red]);
  const editor = useEditorPasillos(PASILLOS, MODO_TRAZAR);

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
            const geo = geometria3D(b.number, coords);
            return { ...b, coords, entrada, geo };
          })
          .filter(Boolean);
        setEdificios([...conCoordenadas, ...LUGARES_MAPA]);
      })
      .catch(() => {
        setEdificios(LUGARES_MAPA); // al menos los lugares
        mostrarAviso('No se pudieron cargar los edificios.', 'error');
      });
    return () => {
      activo = false;
    };
  }, [mostrarAviso]);

  // --- 5.2 Abrir / cerrar la hoja ---
  // Si ya hay un edificio abierto y tocas OTRO, la hoja primero se cierra
  // y 0.3 s después se vuelve a abrir con el nuevo (así se nota el cambio).
  const elegirEdificio = useCallback((numero) => {
    clearTimeout(timerCambioRef.current);
    setRutaActiva(false);
    setVerPasos(false);
    const actual = seleccionadoNumRef.current;
    if (actual != null && actual !== numero) {
      setSeleccionadoNum(null);
      timerCambioRef.current = setTimeout(() => setSeleccionadoNum(numero), 300);
    } else {
      setSeleccionadoNum(numero);
    }
  }, []);
  const cerrarHoja = useCallback(() => {
    clearTimeout(timerCambioRef.current);
    setRutaActiva(false);
    setSeleccionadoNum(null);
  }, []);

  // Abrir un edificio desde el asistente (botón "Ver en el mapa").
  useEffect(() => {
    if (focusNumber != null) elegirEdificio(Number(focusNumber));
  }, [focusNumber, focusKey, elegirEdificio]);

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

  // La tira de navegación (abajo, durante "Cómo llegar") también se mide.
  const bandejaRef = useRef(null);
  const [alturaBandeja, setAlturaBandeja] = useState(0);
  useEffect(() => {
    const bandeja = bandejaRef.current;
    if (!rutaActiva || !bandeja) return undefined;
    const observador = new ResizeObserver(() => setAlturaBandeja(bandeja.offsetHeight));
    observador.observe(bandeja);
    return () => observador.disconnect();
  }, [rutaActiva]);

  // Cuánto ocupa lo de abajo (para subir el botón dorado y centrar el mapa).
  const alturaVisible = rutaActiva ? alturaBandeja : seleccionado ? alturaHoja : 0;

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
      const punto = mapa.project(edificio.geo.cima, zoom).add([0, altoHoja / 2]);
      mapa.flyTo(mapa.unproject(punto, zoom), zoom, { duration: 0.6 });
    });
    return () => cancelAnimationFrame(id);
  }, [numeroElegido, edificios]);

  const detenerUbicacion = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    estadoCampusRef.current = null;
    setRastreando(false);
    setPosicion(null);
  }, []);

  // Fuera del Poli: apaga el GPS, pinta el mapa de rojo con un aviso al centro
  // y a los 4 segundos todo vuelve a la normalidad.
  const avisarFuera = useCallback(() => {
    detenerUbicacion();
    setRutaActiva(false);
    centrarAlLlegarRef.current = false;
    clearTimeout(timerAvisoRef.current);
    setAviso(null);
    clearTimeout(timerFueraRef.current);
    setAlertaFuera(true);
    timerFueraRef.current = setTimeout(() => setAlertaFuera(false), 4000);
  }, [detenerUbicacion]);

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
        estadoCampusRef.current = 'dentro';
      } else {
        // Fuera del campus: no se dibuja el punto y sale la alerta roja.
        avisarFuera();
      }
    },
    [demo, mostrarAviso, avisarFuera],
  );

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
      clearTimeout(timerCambioRef.current);
      clearTimeout(timerFueraRef.current);
    },
    [],
  );

  // --- 5.7 Botón dorado "Mi ubicación" ---
  const tocarMiUbicacion = () => {
    if (rutaActiva) setSeguir(true); // en navegación: vuelve a seguirte
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

  // --- 5.8 "Cómo llegar" ---
  const tocarComoLlegar = () => {
    if (rutaActiva) {
      terminarRuta();
      return;
    }
    nodosRutaRef.current = null;
    setVerPasos(false);
    setSeguir(false);
    setRutaActiva(true);
    if (!rastreando) iniciarUbicacion();
    else if (!posicion) mostrarAviso('Necesitas estar dentro del campus para trazar la ruta.', 'info');
  };
  function terminarRuta() {
    setRutaActiva(false);
    setSeguir(false);
    setVerPasos(false);
  }

  // Lugares para las indicaciones ("Gira a la derecha junto al Edificio 5").
  const lugares = useMemo(
    () => edificios.filter((b) => !b.esLugar).map((b) => ({ nombre: `Edificio ${b.number}`, punto: b.coords })),
    [edificios],
  );

  // A qué nodo de los pasillos hay que llegar: la(s) puerta(s) marcada(s) en
  // campusPaths.js; si no tiene, el punto de pasillo más cercano al edificio.
  // (Con dos puertas, `nodo` es una lista y la ruta va a la más cercana.)
  const destino = useMemo(() => {
    if (!contenidoHoja) return null;
    const puertas = [].concat(red.entradas[contenidoHoja.number] ?? []).filter((n) => red.nodos[n]);
    const nodo = puertas.length ? puertas : nodoMasCercano(red, contenidoHoja.entrada);
    return nodo == null ? null : { nodo, punto: red.nodos[[].concat(nodo)[0]] };
  }, [red, contenidoHoja]);

  // La ruta se recalcula cada vez que el GPS te mueve (es muy rápido).
  const ruta = useMemo(() => {
    if (!posicion || !contenidoHoja || !destino) return null;
    const origen = [posicion.lat, posicion.lng];
    const opciones = { lugares, nombreDestino: nombreMeta(contenidoHoja) };
    if (sinEscaleras) {
      const accesible = calcularRuta(red, origen, destino.nodo, { ...opciones, accesible: true });
      if (accesible) return accesible;
      // No hay forma de llegar sin escaleras: se da la normal con aviso.
      const normal = calcularRuta(red, origen, destino.nodo, opciones);
      return normal && { ...normal, sinOpcionAccesible: true };
    }
    return calcularRuta(red, origen, destino.nodo, opciones);
  }, [posicion, contenidoHoja, destino, red, lugares, sinEscaleras]);

  // Distancia y minutos: por los pasillos si hay ruta; si no, en línea recta.
  const distancia =
    ruta?.metros ??
    (posicion && contenidoHoja
      ? distanciaMetros(posicion, { lat: contenidoHoja.entrada[0], lng: contenidoHoja.entrada[1] })
      : null);
  const minutos = distancia != null ? Math.max(1, Math.round(distancia / VELOCIDAD_CAMINANDO / 60)) : null;

  // Al empezar: encuadrar toda la ruta UNA vez (vista general).
  useEffect(() => {
    if (!rutaActiva) {
      rutaAjustadaRef.current = false;
      return;
    }
    const mapa = mapaRef.current;
    if (!mapa || !posicion || !seleccionado || rutaAjustadaRef.current) return;
    rutaAjustadaRef.current = true;
    const puntos = ruta?.puntos ?? [[posicion.lat, posicion.lng], seleccionado.entrada];
    mapa.fitBounds(L.latLngBounds(puntos), {
      paddingTopLeft: [40, ALTO_BARRA_NAV + 40], // que no la tape la barra de arriba
      paddingBottomRight: [40, alturaBandeja + 40], // ni la tira de abajo
      maxZoom: 19,
    });
  }, [rutaActiva, posicion, seleccionado, alturaBandeja, ruta]);

  // (Va ANTES del efecto de abajo para que se ejecute primero.)
  // Cambiar a "sin escaleras" no es desviarse: no mostrar "Recalculando".
  useEffect(() => {
    nodosRutaRef.current = null;
  }, [sinEscaleras]);

  // Mientras caminas: seguirte, avisar si se recalculó y avisar al llegar.
  useEffect(() => {
    if (!rutaActiva || !posicion || !seleccionado) return;

    // ¿Llegaste?
    // La meta es el final de la ruta (la puerta elegida); sin ruta, la del edificio.
    const meta = ruta?.puntos.at(-1) ?? destino?.punto ?? seleccionado.entrada;
    if (metrosEntre([posicion.lat, posicion.lng], meta) < METROS_LLEGADA) {
      mostrarAviso(`¡Llegaste ${aLaMeta(seleccionado)}!`, 'ok', 6000);
      terminarRuta();
      return;
    }

    // ¿Te desviaste? Si la ruta nueva ya no es "lo que faltaba" de la anterior.
    if (ruta) {
      const antes = nodosRutaRef.current;
      const ahora = ruta.nodos;
      const esElMismoCamino = antes && antes.join(',').endsWith(ahora.join(','));
      if (antes && !esElMismoCamino) mostrarAviso('Recalculando ruta…', 'info', 2000);
      nodosRutaRef.current = ahora;
    }

    // Seguirte (dejando tu punto en medio de la barra de arriba y la tira de abajo).
    const mapa = mapaRef.current;
    if (seguir && mapa) {
      const zoom = Math.max(mapa.getZoom(), 19);
      const altoAbajo = bandejaRef.current?.offsetHeight ?? 0;
      const punto = mapa.project([posicion.lat, posicion.lng], zoom).add([0, (altoAbajo - ALTO_BARRA_NAV) / 2]);
      mapa.flyTo(mapa.unproject(punto, zoom), zoom, { duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicion, rutaActiva, ruta, seguir]);

  // Tocar el mapa: en ?trazar pone puntos; en DEMO con ruta, "caminas" hasta
  // donde tocaste (para la exposición); si no, cierra la hoja.
  const tocarMapa = (e) => {
    if (MODO_TRAZAR) return editor.tocarMapa(e.latlng);
    if (demo && rutaActiva) return recibirPosicion(e.latlng.lat, e.latlng.lng, 8);
    if (rutaActiva) return; // navegando: tocar el mapa no quita la ruta (se cancela con la X)
    cerrarHoja();
  };

  const siguientePaso = ruta?.pasos?.[0];

  // Arrastrar la hoja del edificio: abajo = cerrar, arriba = abrir la ficha completa.
  const arrastreHoja = useArrastre({
    onAbajo: cerrarHoja,
    onArriba: () => contenidoHoja && !contenidoHoja.esLugar && onOpenBuilding?.(contenidoHoja.number),
  });
  // Arrastrar la tira de navegación: arriba = ver pasos, abajo = esconderlos, toque = alternar.
  const arrastreBandeja = useArrastre({
    onArriba: () => setVerPasos(true),
    onAbajo: () => setVerPasos(false),
    onToque: () => setVerPasos((v) => !v),
    umbral: 40,
  });
  // Mientras arrastras la hoja, la hoja sigue al dedo (hacia arriba con "resistencia").
  const desplazamientoHoja = arrastreHoja.dy > 0 ? arrastreHoja.dy : arrastreHoja.dy * 0.35;
  const hojaVisible = !!seleccionado && !rutaActiva;

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
        '--pm-sombra': colors.blueDeep,
        '--pm-carmesi-osc': colors.crimsonDark,
        // Modo claro/oscuro: fondo de las ventanitas y color del texto.
        '--pm-fondo': colors.surface,
        '--pm-tinta': colors.ink,
        '--pm-venita': colors.green,
      }}
    >
      <style>{ESTILOS}</style>
      {/* Color de cada edificio 3D (sale de campusBuildings.js → color) */}
      <style>
        {edificios.map((b) => `.pm-3d--${b.number}{--c:${b.color ?? colors.blue}}`).join('')}
      </style>

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
          crossOrigin // así el service worker puede guardar los cuadritos y verlos sin internet
          maxNativeZoom={19} // OSM llega a 19; en 20 se amplía la imagen de 19
          maxZoom={CAMPUS.zoomMax}
        />

        <ControlMapa onTocarMapa={tocarMapa} onArrastrar={() => setSeguir(false)} />
        <UbicacionUsuario posicion={posicion} />

        {/* Venitas: los pasillos siempre visibles como líneas verdes delgadas
            (como CUCEA en Google Maps). Escaleras = punteado; rampa = más gruesa.
            Van ANTES de los edificios para que las cajitas 3D queden encima. */}
        {!MODO_TRAZAR &&
          red.tramos.map((t, i) => (
            <Polyline
              key={`v${i}`}
              positions={[red.nodos[t.a], red.nodos[t.b]]}
              pathOptions={{
                className: `pm-venita${t.tipo ? ` pm-venita--${t.tipo}` : ''}`,
                weight: t.tipo === 'rampa' ? 4 : 2.5,
                dashArray: t.escaleras ? '2 5' : null,
              }}
              interactive={false}
            />
          ))}
        {/* Rampas: un iconito ♿ en cada una (en su punto de en medio) */}
        {!MODO_TRAZAR &&
          puntosRampa.map((p, i) => <Marker key={`r${i}`} position={p} icon={ICONO_RAMPA} interactive={false} />)}

        {/* Edificios en 3D. Se dibujan de arriba (norte) hacia abajo para que
            los de enfrente tapen a los de atrás, como en la vida real. */}
        {[...edificios]
          .sort((a, b) => b.coords[0] - a.coords[0])
          .map((b) => {
            const activo = b.number === seleccionadoNum;
            const clase = `pm-3d--${b.number}${activo ? ' is-active' : ''}`;
            // En ?trazar los edificios no se pueden tocar (así no estorban al trazar).
            const alTocar = MODO_TRAZAR ? {} : { click: () => elegirEdificio(b.number) };
            return (
              // La key cambia con `activo` para que Leaflet aplique la clase nueva.
              <Fragment key={`${b.number}-${activo}`}>
                {/* Primero TODAS las paredes y luego los techos, para que en
                    edificios de varias partes ningún muro tape un techo. */}
                {b.geo.cajas.flatMap((caja) => caja.paredes).map((pared, i) => (
                  <Polygon
                    key={`p${i}`}
                    positions={pared}
                    // className va DIRECTO (no dentro de pathOptions): Leaflet solo pone
                    // la clase al crear la figura; si llega después, se queda azul por defecto.
                    className={`pm-3d-pared ${clase}`}
                    bubblingMouseEvents={false}
                    interactive={!MODO_TRAZAR}
                    eventHandlers={alTocar}
                  />
                ))}
                {b.geo.cajas.map((caja, i) => (
                  <Polygon
                    key={`t${i}`}
                    positions={caja.techo}
                    className={`pm-3d-techo ${clase}`}
                    bubblingMouseEvents={false}
                    interactive={!MODO_TRAZAR}
                    eventHandlers={alTocar}
                  />
                ))}
              </Fragment>
            );
          })}

        {/* Una gota estilo Google Maps por edificio, parada sobre el techo */}
        {!MODO_TRAZAR &&
          edificios.map((b) => (
            <Marker
              // La key cambia con `activo` para que se repita el brinco.
              key={`${b.number}-${b.number === seleccionadoNum}`}
              position={b.geo.cima}
              icon={iconoEdificio(b, b.number === seleccionadoNum)}
              zIndexOffset={b.number === seleccionadoNum ? 500 : 0}
              title={b.name || nombreCorto(b)}
              eventHandlers={{ click: () => elegirEdificio(b.number) }}
            />
          ))}

        {/* Ruta de "Cómo llegar": borde blanco + línea azul encima (como Google Maps).
            El primer pedacito (de ti al pasillo) va punteado. */}
        {rutaActiva && posicion && seleccionado && (
          <>
            {ruta ? (
              <>
                <Polyline positions={ruta.puntos.slice(1)} pathOptions={{ className: 'pm-ruta-borde', weight: 11 }} interactive={false} />
                <Polyline positions={ruta.puntos.slice(1)} pathOptions={{ className: 'pm-ruta', weight: 6 }} interactive={false} />
                <Polyline positions={ruta.puntos.slice(0, 2)} pathOptions={{ className: 'pm-ruta-acceso', weight: 4, dashArray: '1 9' }} interactive={false} />
              </>
            ) : (
              // Sin pasillos trazados hasta ahí: línea recta de respaldo.
              <Polyline
                positions={[[posicion.lat, posicion.lng], seleccionado.entrada]}
                pathOptions={{ className: 'pm-ruta-acceso', weight: 5, dashArray: '2 10' }}
                interactive={false}
              />
            )}
            <Marker position={ruta?.puntos.at(-1) ?? destino?.punto ?? seleccionado.entrada} icon={ICONO_META} interactive={false} />
          </>
        )}

        {/* Herramienta de trazado (?trazar) */}
        {MODO_TRAZAR && <EditorCapas editor={editor} />}
      </MapContainer>

      {/* Fuera del Poli: mapa en rojo + aviso al centro durante 4 s */}
      {alertaFuera && (
        <div className="pm-fuera" role="alert">
          <div className="pm-fuera__tarjeta">
            <Icon name="wrong_location" size={44} />
            <strong>No estás en el Poli</strong>
            <span>Tu ubicación está fuera del campus.</span>
          </div>
        </div>
      )}

      {MODO_TRAZAR && <EditorPanel editor={editor} posicion={posicion} />}

      {/* Aviso flotante arriba */}
      {aviso && (
        <div
          className="pointer-events-none absolute inset-x-0 top-3 z-[1100] flex justify-center px-4"
          // En ?trazar el panel ocupa la parte de arriba: el aviso baja.
          style={
            MODO_TRAZAR ? { top: 'auto', bottom: 96 } : rutaActiva ? { top: ALTO_BARRA_NAV + 16 } : undefined
          }
        >
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
      {/* Durante "Cómo llegar" se esconde para dejar ver la ruta. */}
      <section
        ref={hojaRef}
        className="pm-hoja"
        data-abierta={hojaVisible ? 'true' : 'false'}
        aria-hidden={!hojaVisible}
        aria-label={contenidoHoja ? `Información del edificio ${contenidoHoja.number}` : undefined}
        style={
          arrastreHoja.dy ? { transform: `translateY(${desplazamientoHoja}px)`, transition: 'none' } : undefined
        }
      >
        {/* Zona para agarrar: la rayita y el encabezado.
            Jala hacia abajo para cerrar, hacia arriba para ver la ficha. */}
        <div className="pm-arrastre" {...arrastreHoja.props}>
          <div className="pm-hoja__asa" aria-hidden="true" />
          {onOpenBuilding && !contenidoHoja?.esLugar && (
            <p className="pm-hoja__pista">
              {arrastreHoja.dy < -60 ? 'Suelta para ver la ficha' : 'Desliza hacia arriba para ver la ficha'}
            </p>
          )}
        </div>
        {contenidoHoja && (
          <div className="flex flex-col gap-3 px-5 pb-5">
            <header className="pm-arrastre flex items-start gap-3" {...arrastreHoja.props}>
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
                  style={{ background: contenidoHoja.color ?? (contenidoHoja.esLugar ? colors.grassDark : colors.blue) }}
                >
                  {contenidoHoja.esLugar ? <Icon name={contenidoHoja.icono} size={28} /> : contenidoHoja.number}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="pm-hoja__sub">{contenidoHoja.esLugar ? contenidoHoja.summary : `Edificio ${contenidoHoja.number}`}</p>
                <h2 className="pm-hoja__titulo">{contenidoHoja.name || nombreCorto(contenidoHoja)}</h2>
                {contenidoHoja.summary && !contenidoHoja.esLugar && (
                  <p className="pm-hoja__resumen">{contenidoHoja.summary}</p>
                )}
              </div>
              <button type="button" onClick={cerrarHoja} aria-label="Cerrar" className="pm-hoja__cerrar">
                <Icon name="close" />
              </button>
            </header>

            {contenidoHoja.description && <p className="pm-hoja__texto">{contenidoHoja.description}</p>}

            {/* Sin navegación: distancia y tiempo (por los pasillos si se puede) */}
            {!rutaActiva && distancia != null && (
              <p className="pm-hoja__meta">
                A {textoDistancia(distancia)} {ruta ? 'caminando' : 'en línea recta'} · ~{minutos} min
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={tocarComoLlegar} className="pm-btn pm-btn--principal" tabIndex={hojaVisible ? 0 : -1}>
                <Icon name="directions_walk" />
                Cómo llegar
              </button>
              {onOpenBuilding && !contenidoHoja.esLugar && (
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

      {/* ---------- Navegación ("Cómo llegar") ----------
          Arriba: la siguiente indicación y la X para cancelar.
          Abajo: una tira delgada con metros y minutos; al jalarla hacia arriba
          se ven los avisos, "Sin escaleras" y todos los pasos. */}
      {rutaActiva && contenidoHoja && (
        <>
          <div className="pm-navbar" role="status" aria-live="polite">
            <span className="pm-nav__icono">
              <Icon
                name={!posicion ? 'location_searching' : siguientePaso?.icono ?? 'straight'}
                size={30}
              />
            </span>
            <div className="min-w-0 flex-1">
              {!posicion ? (
                <strong>Buscando tu ubicación…</strong>
              ) : ruta ? (
                <>
                  <strong>{siguientePaso.texto}</strong>
                  {siguientePaso.metros > 0 && <span>{textoDistancia(siguientePaso.metros)}</span>}
                </>
              ) : (
                <>
                  <strong>Sigue la línea hacia {contenidoHoja.esLugar ? contenidoHoja.destino : `el Edificio ${contenidoHoja.number}`}</strong>
                  <span>Aún no hay pasillos trazados hasta aquí</span>
                </>
              )}
            </div>
            <button type="button" className="pm-navbar__cerrar" onClick={terminarRuta} aria-label="Cancelar ruta">
              <Icon name="close" />
            </button>
          </div>

          <section
            ref={bandejaRef}
            className="pm-bandeja"
            aria-label="Detalles de la ruta"
            style={
              arrastreBandeja.dy
                ? { transform: `translateY(${Math.max(arrastreBandeja.dy, -40)}px)`, transition: 'none' }
                : undefined
            }
          >
            <div
              className="pm-arrastre pm-bandeja__resumen"
              {...arrastreBandeja.props}
              role="button"
              tabIndex={0}
              aria-expanded={verPasos}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setVerPasos((v) => !v)}
            >
              <div className="pm-hoja__asa" aria-hidden="true" />
              <div className="flex items-center gap-2 px-5 pb-3">
                <div className="min-w-0 flex-1">
                  <strong>
                    {distancia != null ? `${textoDistancia(distancia)} · ${minutos} min` : 'Calculando…'}
                  </strong>
                  <span>
                    {nombreCorto(contenidoHoja)}
                    {ruta?.conEscaleras ? ' · con escaleras' : ''}
                  </span>
                </div>
                <Icon name={verPasos ? 'expand_more' : 'expand_less'} />
              </div>
            </div>

            {verPasos && (
              <div className="pm-bandeja__detalle">
                {ruta?.sinOpcionAccesible && (
                  <p className="pm-nav__aviso">
                    <Icon name="warning" size={18} /> No hay ruta sin escaleras hasta este edificio.
                  </p>
                )}
                {red.provisional && (
                  <p className="pm-nav__aviso">
                    <Icon name="construction" size={18} /> Pasillos de prueba: la ruta puede no ser exacta.
                  </p>
                )}
                {demo && <p className="pm-nav__aviso">DEMO: toca el mapa para "caminar" hasta ese punto.</p>}

                <div className="pm-nav__opciones">
                  <button
                    type="button"
                    className={`pm-chip ${sinEscaleras ? 'is-on' : ''}`}
                    aria-pressed={sinEscaleras}
                    onClick={() => setSinEscaleras((v) => !v)}
                  >
                    <Icon name="accessible_forward" size={18} />
                    Sin escaleras
                  </button>
                </div>

                {ruta && (
                  <ol className="pm-nav__lista">
                    {ruta.pasos.map((paso, i) => (
                      <li key={i}>
                        <Icon name={paso.icono} size={20} />
                        <span>{paso.texto}</span>
                        {paso.metros > 0 && <small>{textoDistancia(paso.metros)}</small>}
                      </li>
                    ))}
                  </ol>
                )}

                <button type="button" onClick={terminarRuta} className="pm-btn pm-btn--secundario">
                  <Icon name="close" />
                  Terminar ruta
                </button>
              </div>
            )}
          </section>
        </>
      )}
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

/* Edificios 3D: techo claro, paredes oscuras (color de cada edificio en --c) */
.pm-3d-techo, .pm-3d-pared { stroke: white; stroke-width: 1; stroke-opacity: .7; fill-opacity: 1; transition: fill .25s ease; }
.pm-3d-techo { fill: color-mix(in srgb, var(--c, var(--pm-azul)) 80%, white); }
.pm-3d-pared { fill: color-mix(in srgb, var(--c, var(--pm-azul)) 65%, var(--pm-sombra)); }
.pm-3d-techo.is-active { fill: color-mix(in srgb, var(--pm-oro) 75%, white); stroke: var(--pm-oro); stroke-width: 2; stroke-opacity: 1; }
.pm-3d-pared.is-active { fill: color-mix(in srgb, var(--pm-oro) 70%, var(--pm-sombra)); }

/* Marcador 3D de edificio */
.pm-pin-wrap { background: none; border: 0; }
.pm-pin { position: relative; width: var(--pm-pin); height: calc(var(--pm-pin) + 10px); }
.pm-pin__cuerpo {
  position: absolute; left: 0; top: 0; width: var(--pm-pin); height: var(--pm-pin); border-radius: 50%;
  display: grid; place-items: center; color: white; font-weight: 800; font-size: calc(var(--pm-pin) * .45);
  text-shadow: 0 1px 1px rgb(0 0 0 / .35);
  /* Relieve: luz arriba a la izquierda y sombra abajo a la derecha */
  background: radial-gradient(circle at 32% 28%,
    color-mix(in srgb, var(--pm-azul) 45%, white) 0%,
    var(--pm-azul) 55%,
    color-mix(in srgb, var(--pm-azul) 60%, var(--pm-sombra)) 100%);
  border: 2px solid white;
  box-shadow: inset 0 -3px 4px rgb(0 0 0 / .3), 0 3px 6px rgb(0 0 0 / .35);
  transform-origin: 50% calc(var(--pm-pin) + 6px);
  transition: transform .2s ease;
}
.pm-pin__cuerpo::after {
  content: ""; position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%);
  border: 5px solid transparent; border-top: 7px solid white;
}
/* Sombra ovalada en el "piso" (debajo de la punta) */
.pm-pin__sombra {
  position: absolute; left: 50%; top: calc(var(--pm-pin) + 3px); width: calc(var(--pm-pin) * .6); height: 6px;
  transform: translateX(-50%); border-radius: 50%; background: rgb(0 0 0 / .35); filter: blur(1.5px);
}
/* Onda expansiva dorada (solo se ve cuando el pin está activo) */
.pm-pin__onda {
  position: absolute; left: 50%; top: calc(var(--pm-pin) + 6px); width: 18px; height: 18px;
  margin: -9px 0 0 -9px; border-radius: 50%; border: 3px solid var(--pm-oro); opacity: 0; pointer-events: none;
}

/* Activo: carmesí, brinca y sale la onda */
.pm-pin.is-active .pm-pin__cuerpo {
  background: radial-gradient(circle at 32% 28%,
    color-mix(in srgb, var(--pm-carmesi) 45%, white) 0%,
    var(--pm-carmesi) 55%,
    color-mix(in srgb, var(--pm-carmesi) 60%, var(--pm-sombra)) 100%);
  animation: pm-brinco .7s cubic-bezier(.3,.7,.4,1) both;
}
.pm-pin.is-active .pm-pin__sombra { animation: pm-sombra-brinco .7s cubic-bezier(.3,.7,.4,1) both; }
.pm-pin.is-active .pm-pin__onda { animation: pm-onda 1s ease-out .15s 2; }
@keyframes pm-brinco {
  0%   { transform: translateY(0) scale(1); }
  30%  { transform: translateY(-18px) scale(1.25, 1.1); }
  55%  { transform: translateY(0) scale(1.35, .9); }
  75%  { transform: translateY(-5px) scale(1.2); }
  100% { transform: translateY(0) scale(1.25); }
}
@keyframes pm-sombra-brinco {
  0%, 100% { transform: translateX(-50%) scale(1); }
  30%      { transform: translateX(-50%) scale(.5); opacity: .5; }
}
@keyframes pm-onda {
  from { transform: scale(.5); opacity: .9; }
  to   { transform: scale(4.5); opacity: 0; }
}

/* Gota estilo Google Maps (mapa de alumnos) */
.pm-gota { position: relative; width: 100%; height: 100%; }
.pm-gota__forma {
  position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
  transform-origin: 50% 100%; filter: drop-shadow(0 2px 2px rgb(0 0 0 / .3));
  transition: transform .2s ease;
}
.pm-gota__forma path { fill: var(--pm-carmesi); stroke: var(--pm-carmesi-osc); stroke-width: 1.2; }
.pm-gota__forma circle { fill: var(--pm-carmesi-osc); }
.pm-gota__sombra {
  position: absolute; left: 50%; bottom: -3px; width: 60%; height: 5px; transform: translateX(-50%);
  border-radius: 50%; background: rgb(0 0 0 / .3); filter: blur(1.5px);
}
.pm-gota__onda {
  position: absolute; left: 50%; bottom: 0; width: 18px; height: 18px; margin: 0 0 -9px -9px;
  border-radius: 50%; border: 3px solid var(--pm-oro); opacity: 0; pointer-events: none;
}
/* Nombre a un lado, con contorno blanco para que se lea sobre el mapa */
.pm-gota__nombre {
  position: absolute; left: calc(100% + 3px); top: 4px; white-space: nowrap;
  font-size: 12px; font-weight: 700; line-height: 1.2; color: var(--pm-carmesi-osc);
  text-shadow: 0 0 2px var(--pm-fondo), 0 0 2px var(--pm-fondo), 0 0 3px var(--pm-fondo), 0 0 3px var(--pm-fondo);
  pointer-events: none; transition: font-size .2s ease;
}
.pm-gota.is-active .pm-gota__forma { animation: pm-gota-brinco .7s cubic-bezier(.3,.7,.4,1) both; }
.pm-gota.is-active .pm-gota__sombra { animation: pm-sombra-brinco .7s cubic-bezier(.3,.7,.4,1) both; }
.pm-gota.is-active .pm-gota__onda { animation: pm-onda 1s ease-out .15s 2; }
.pm-gota.is-active .pm-gota__nombre { font-size: 14px; left: calc(100% + 10px); }
@keyframes pm-gota-brinco {
  0%   { transform: translateY(0) scale(1); }
  30%  { transform: translateY(-16px) scale(1.3, 1.4); }
  55%  { transform: translateY(0) scale(1.5, 1.3); }
  75%  { transform: translateY(-4px) scale(1.4); }
  100% { transform: translateY(0) scale(1.4); }
}

/* Texto de las ventanitas: sigue el tema (claro u oscuro) */
.pm-hoja, .pm-bandeja, .pm-traza { color: var(--pm-tinta); }
.pm-btn--principal { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pm-tinta) 20%, transparent); }

/* Venitas (pasillos) y rampas */
.pm-venita { stroke: var(--pm-venita); stroke-opacity: .85; stroke-linecap: round; fill: none; }
.pm-venita--escaleras { stroke-opacity: .7; }
.pm-rampa {
  width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;
  background: var(--pm-venita); color: white; border: 1.5px solid white; box-shadow: 0 1px 3px rgb(0 0 0 / .3);
}
.pm-rampa .material-symbols-rounded { font-size: 13px; }
.pm-pin__icono { font-size: calc(var(--pm-pin) * .6); }

/* Ruta de "Cómo llegar" */
.pm-ruta-borde { stroke: white; stroke-linecap: round; stroke-linejoin: round; fill: none; }
.pm-ruta { stroke: var(--pm-azul); stroke-linecap: round; stroke-linejoin: round; fill: none; }
.pm-ruta-acceso { stroke: var(--pm-azul); stroke-linecap: round; fill: none; }
.pm-meta {
  width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  background: var(--pm-azul); color: white; border: 2px solid white; box-shadow: 0 2px 5px rgb(0 0 0 / .35);
}
.pm-meta .material-symbols-rounded { font-size: 16px; }

/* Zonas para arrastrar (la hoja del edificio y la tira de navegación) */
.pm-arrastre { touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
.pm-arrastre:active { cursor: grabbing; }
.pm-hoja__pista { margin: -6px 0 6px; text-align: center; font-size: .72rem; color: var(--pm-tinta); opacity: .6; }

/* Navegación: barra de arriba */
.pm-navbar {
  position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1100;
  display: flex; align-items: center; gap: .75rem; padding: .7rem .7rem .7rem .8rem; border-radius: 18px;
  background: var(--pm-azul); color: white; box-shadow: 0 6px 18px rgb(0 0 0 / .3);
  animation: pm-baja .3s cubic-bezier(.2,.8,.2,1) both;
}
.pm-navbar strong { display: block; font-size: 1.02rem; line-height: 1.25; }
.pm-navbar span { font-size: .85rem; opacity: .85; }
.pm-navbar__cerrar {
  flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: color-mix(in srgb, white 16%, transparent); color: white;
}
@keyframes pm-baja { from { transform: translateY(-120%); } to { transform: none; } }

/* Navegación: tira de abajo (se jala para ver los pasos) */
.pm-bandeja {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 1100;
  max-height: 55%; overflow-y: auto; overscroll-behavior: contain;
  background: var(--pm-fondo); border-radius: 20px 20px 0 0; box-shadow: 0 -6px 24px rgb(0 0 0 / .18);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  animation: pm-sube .3s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s ease;
}
.pm-bandeja__resumen { color: var(--pm-tinta); }
.pm-bandeja__resumen strong { display: block; font-size: 1.05rem; }
.pm-bandeja__resumen span { font-size: .82rem; opacity: .75; }
.pm-bandeja__detalle { display: flex; flex-direction: column; gap: .6rem; padding: 0 1.25rem 1.1rem; }
@keyframes pm-sube { from { transform: translateY(100%); } to { transform: none; } }

/* Panel de navegación (avisos, opciones y lista de pasos) */
.pm-nav { display: flex; flex-direction: column; gap: .5rem; }
.pm-nav__paso {
  display: flex; align-items: center; gap: .75rem; padding: .75rem; border-radius: 16px;
  background: var(--pm-azul); color: white;
}
.pm-nav__paso strong { display: block; font-size: 1.02rem; line-height: 1.25; }
.pm-nav__paso span { font-size: .85rem; opacity: .85; }
.pm-nav__icono { flex: none; width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: color-mix(in srgb, white 14%, transparent); }
.pm-nav__buscando, .pm-nav__aviso { display: flex; align-items: center; gap: .4rem; font-size: .85rem; color: var(--pm-tinta); }
.pm-nav__aviso { opacity: .85; }
.pm-nav__opciones { display: flex; flex-wrap: wrap; gap: .5rem; }
.pm-chip {
  display: inline-flex; align-items: center; gap: .3rem; min-height: 36px; padding: 0 .8rem; border-radius: 999px;
  font-size: .85rem; font-weight: 600; color: var(--pm-tinta);
  background: color-mix(in srgb, var(--pm-tinta) 8%, var(--pm-fondo)); border: 1.5px solid transparent;
}
.pm-chip.is-on { background: color-mix(in srgb, var(--pm-oro) 25%, var(--pm-fondo)); border-color: var(--pm-oro); }
.pm-nav__lista { display: flex; flex-direction: column; gap: .1rem; margin: 0; padding: 0; list-style: none; }
.pm-nav__lista li {
  display: flex; align-items: center; gap: .6rem; padding: .5rem .25rem; font-size: .9rem; color: var(--pm-tinta);
  border-bottom: 1px solid color-mix(in srgb, var(--pm-tinta) 10%, var(--pm-fondo));
}
.pm-nav__lista li span { flex: 1; }
.pm-nav__lista li small { opacity: .7; white-space: nowrap; }

/* Herramienta ?trazar */
.pm-traza {
  position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1150; display: flex; flex-direction: column; gap: .45rem;
  padding: .7rem; border-radius: 16px; background: var(--pm-fondo); color: var(--pm-tinta); box-shadow: 0 6px 20px rgb(0 0 0 / .25);
  max-height: 60%; overflow-y: auto;
}
.pm-traza__titulo { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; font-size: .95rem; }
.pm-traza__titulo span { font-size: .78rem; opacity: .75; }
.pm-traza__fila { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
.pm-traza__chip {
  display: inline-flex; align-items: center; gap: .25rem; min-height: 34px; padding: 0 .65rem; border-radius: 999px;
  font-size: .82rem; font-weight: 600; background: color-mix(in srgb, var(--pm-tinta) 8%, var(--pm-fondo)); color: var(--pm-tinta);
}
.pm-traza__chip:disabled { opacity: .4; }
.pm-traza__chip.is-on { background: var(--pm-azul); color: white; }
.pm-traza__chip--principal { background: var(--pm-carmesi); color: white; }
.pm-traza__edificio { font-size: .85rem; font-weight: 600; }
.pm-traza__edificio select { border: 1px solid color-mix(in srgb, var(--pm-tinta) 30%, var(--pm-fondo)); border-radius: 8px; padding: .2rem .4rem; }
.pm-traza__ayuda { font-size: .8rem; line-height: 1.35; margin: 0; }
.pm-traza__copiar { display: flex; flex-direction: column; gap: .35rem; font-size: .8rem; }
.pm-traza__copiar textarea { width: 100%; height: 140px; font-family: monospace; font-size: 11px; border: 1px solid color-mix(in srgb, var(--pm-tinta) 30%, var(--pm-fondo)); border-radius: 8px; }
.pm-traza-etiqueta { font-weight: 700; font-size: 11px; }

/* Fuera del Poli: capa roja sobre el mapa + tarjeta al centro (dura 4 s) */
.pm-fuera {
  position: absolute; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 24px;
  background: color-mix(in srgb, var(--pm-carmesi) 45%, transparent);
  animation: pm-fuera-capa 4s ease both; pointer-events: none;
}
.pm-fuera__tarjeta {
  display: flex; flex-direction: column; align-items: center; gap: .35rem; text-align: center;
  padding: 1.2rem 1.6rem; border-radius: 20px; background: var(--pm-fondo); color: var(--pm-carmesi);
  box-shadow: 0 10px 30px rgb(0 0 0 / .3); animation: pm-fuera-tarjeta .5s cubic-bezier(.3,.7,.4,1) both;
}
.pm-fuera__tarjeta strong { font-size: 1.25rem; font-weight: 800; }
.pm-fuera__tarjeta span:last-child { font-size: .9rem; color: var(--pm-tinta); }
@keyframes pm-fuera-capa { 0% { opacity: 0; } 8% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; } }
@keyframes pm-fuera-tarjeta {
  0% { transform: scale(.6); } 60% { transform: scale(1.08); }
  70% { transform: translateX(-8px); } 80% { transform: translateX(8px); }
  90% { transform: translateX(-4px); } 100% { transform: none; }
}

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
.pm-demo { font-size: .7rem; font-weight: 700; padding: .1rem .4rem; border-radius: .3rem; background: var(--pm-oro); color: var(--pm-sombra); }

/* Botón dorado "Mi ubicación" */
.pm-fab {
  position: absolute; right: 16px; z-index: 1100; width: 52px; height: 52px; border-radius: 50%;
  display: grid; place-items: center; background: var(--pm-oro); color: var(--pm-sombra);
  box-shadow: 0 4px 12px rgb(0 0 0 / .3); transition: bottom .28s cubic-bezier(.2,.8,.2,1);
  -webkit-tap-highlight-color: transparent;
}
.pm-fab:active { transform: scale(.94); }
.pm-fab.is-on { color: var(--pm-sombra); outline: 3px solid white; }

/* Hoja inferior (bottom sheet) */
.pm-hoja {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 1100;
  max-height: 45%; overflow-y: auto; overscroll-behavior: contain;
  background: var(--pm-fondo); border-radius: 20px 20px 0 0;
  box-shadow: 0 -6px 24px rgb(0 0 0 / .18);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  transform: translateY(110%); transition: transform .28s cubic-bezier(.2,.8,.2,1);
}
.pm-hoja[data-abierta="true"] { transform: none; }
.pm-hoja__asa { width: 40px; height: 5px; border-radius: 3px; margin: 10px auto 12px; background: color-mix(in srgb, var(--pm-tinta) 25%, var(--pm-fondo)); }
.pm-hoja__foto, .pm-hoja__numero { width: 56px; height: 56px; border-radius: 14px; flex: none; object-fit: cover; }
.pm-hoja__numero { display: grid; place-items: center; color: white; font-size: 1.4rem; font-weight: 700; }
.pm-hoja__sub { font-size: .8rem; color: var(--pm-carmesi-osc); font-weight: 600; }
.pm-hoja__titulo { font-size: 1.15rem; font-weight: 700; color: var(--pm-tinta); line-height: 1.25; }
.pm-hoja__resumen { font-size: .9rem; opacity: .75; margin-top: .15rem; }
.pm-hoja__texto { font-size: .92rem; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.pm-hoja__meta { font-size: .85rem; color: var(--pm-tinta); font-weight: 600; }
.pm-hoja__cerrar {
  flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
  background: color-mix(in srgb, var(--pm-tinta) 8%, var(--pm-fondo)); color: var(--pm-tinta);
}

/* Botones de la hoja */
.pm-btn {
  flex: 1; min-height: 46px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  gap: .4rem; font-weight: 600; font-size: .95rem; -webkit-tap-highlight-color: transparent;
}
.pm-btn:active { transform: scale(.98); }
.pm-btn--principal { background: var(--pm-azul); color: white; }
.pm-btn--secundario { background: color-mix(in srgb, var(--pm-tinta) 8%, var(--pm-fondo)); color: var(--pm-tinta); }

/* Accesibilidad: sin animaciones si el usuario lo pidió en su sistema */
@media (prefers-reduced-motion: reduce) {
  .pm-user__pulso { animation: none; }
  .pm-hoja, .pm-fab, .pm-pin__cuerpo, .pm-bandeja { transition: none; }
  .pm-navbar, .pm-bandeja { animation: none; }
  .pm-pin.is-active .pm-pin__cuerpo { animation: none; transform: scale(1.25); }
  .pm-pin.is-active .pm-pin__onda, .pm-pin.is-active .pm-pin__sombra { animation: none; }
  .pm-fuera__tarjeta { animation: none; }
  .pm-gota.is-active .pm-gota__forma { animation: none; transform: scale(1.4); }
  .pm-gota.is-active .pm-gota__onda, .pm-gota.is-active .pm-gota__sombra { animation: none; }
}
`;

// Para el panel de administración (src/admin/MapSection.jsx): el mismo
// mapa 3D de Marcos, con los mismos edificios y estilos.
export { geometria3D, ESTILOS as ESTILOS_MAPA };
