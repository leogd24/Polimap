// =====================================================================
// src/components/CampusPathEditor.jsx
// Herramienta para TRAZAR los pasillos del Poli (Marcos — Mapa)
//
// Se abre con:  http://localhost:5173/?trazar   → pestaña Mapa
// Solo la usa el equipo; los alumnos nunca la ven.
//
// Herramientas:
//   Pasillo   → toca el mapa para poner puntos; se van uniendo en cadena.
//               Toca un punto que ya existe para unirte a él (cruces).
//               Toca el punto dorado (el seleccionado) para cortar la cadena.
//   Escaleras → toca un tramo para marcarlo/desmarcarlo como escaleras.
//   Entrada   → elige el edificio y toca el punto donde está su puerta.
//   Borrar    → toca un punto o un tramo para quitarlo.
//   "Punto aquí" → agrega un punto donde estás parado (GPS).
//   "Grabar recorrido" → camina por los pasillos con el celular y la línea se
//                  traza SOLA con el GPS. Al pasar por donde ya caminaste, se
//                  une con esa línea (queda un cruce). Escaleras y entradas se
//                  marcan después a mano. Necesita https (versión publicada).
//
// Al terminar: "Copiar" y pegar todo en src/data/campusPaths.js.
// Lo que trazas se guarda en este navegador mientras trabajas (si recargas
// no se pierde), pero lo que cuenta es lo que pegues en el archivo.
// =====================================================================

import { useEffect, useRef, useState } from 'react';
import { Circle, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { colors } from '../styles/theme.js';
import Icon from './Icon';

const CLAVE_BORRADOR = 'polimap-trazar-pasillos';

// Distancia (en metros) para considerar que tocaste un punto que ya existe
// en vez de crear uno nuevo encima.
const RADIO_IMAN = 4;

// "Grabar recorrido" (ajusta estos números si la línea sale muy chueca):
const GRABAR = {
  precisionMaxima: 20, // ignora lecturas del GPS peores que ±20 m
  cadaMetros: 5, // pone un punto cada 5 m caminados
  promedioDe: 3, // promedia las últimas 3 lecturas para quitar el "temblor"
  imanCruce: 7, // si pasas a menos de 7 m de una línea que ya existe, se une a ella
  rectoGrados: 15, // si sigues casi derecho (menos de 15°), alarga el tramo en vez de poner otro punto
};

function leerBorrador() {
  try {
    const texto = localStorage.getItem(CLAVE_BORRADOR);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

function guardarBorrador(datos) {
  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento (modo incógnito): se trabaja igual, solo no se guarda.
  }
}

function copiaLimpia(pasillos) {
  return {
    nodos: (pasillos?.nodos ?? []).map(([lat, lng]) => [Number(lat), Number(lng)]),
    tramos: (pasillos?.tramos ?? []).map((t) => [...t]),
    entradas: Object.fromEntries(Object.entries(pasillos?.entradas ?? {}).map(([k, v]) => [k, [].concat(v)])),
  };
}

// Texto COMPLETO de src/data/campusPaths.js listo para pegar.
function textoArchivo({ nodos, tramos, entradas }) {
  const r6 = (n) => Number(n.toFixed(6));
  const lineasNodos = nodos.map(([lat, lng], i) => `    [${r6(lat)}, ${r6(lng)}], // ${i}`).join('\n');
  const lineasTramos = tramos
    .map(([a, b, tipo]) => (tipo === 'escaleras' ? `    [${a}, ${b}, 'escaleras'],` : `    [${a}, ${b}],`))
    .join('\n');
  const lineasEntradas = Object.keys(entradas)
    .sort((a, b) => a - b)
    .map((k) => {
      const puertas = [].concat(entradas[k]);
      return `    ${k}: ${puertas.length === 1 ? puertas[0] : `[${puertas.join(', ')}]`},`;
    })
    .join('\n');
  return `// =====================================================================
// src/data/campusPaths.js
// Pasillos del Poli: por dónde se puede CAMINAR (Marcos — Mapa)
//
// Con esto el botón "Cómo llegar" calcula la ruta más corta siguiendo los
// pasillos, como Google Maps, en lugar de una línea recta.
//
// ⚠️ NO lo escribas a mano: ábrelo con la herramienta de trazado
//    http://localhost:5173/?trazar  → pestaña Mapa
//    traza los pasillos, toca "Copiar" y pega TODO aquí, reemplazando este archivo.
//
// Cómo está armado:
//   nodos    → puntos [lat, lng] (esquinas, cruces y entradas). Su número es su lugar en la lista.
//   tramos   → pasillos que unen dos nodos: [desde, hasta]
//              Si el tramo tiene escaleras: [desde, hasta, 'escaleras']
//              (la ruta accesible los evita).
//   entradas → en qué nodo está la puerta de cada edificio: { numeroEdificio: nodo }
//   provisional → true mientras sea una red de prueba (dibujada sin medir).
// Trazado con ?trazar el ${new Date().toLocaleDateString('es-MX')}.
// =====================================================================

export const PASILLOS = {
  provisional: false,
  nodos: [
${lineasNodos}
  ],
  tramos: [
${lineasTramos}
  ],
  entradas: {
${lineasEntradas}
  },
};
`;
}

// Rumbo de a hacia b en grados (0 = norte, 90 = este).
function rumbo(a, b) {
  const dy = b[0] - a[0];
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

// Distancia rápida en metros (solo para el "imán").
function metros(a, b) {
  const dy = (b[0] - a[0]) * 111320;
  const dx = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

// ---------------------------------------------------------------------
// Hook con todo el estado de la herramienta
// ---------------------------------------------------------------------
export function useEditorPasillos(pasillosDelArchivo, activo) {
  const [datos, setDatos] = useState(() => copiaLimpia((activo && leerBorrador()) || pasillosDelArchivo));
  const [historial, setHistorial] = useState([]);
  const [herramienta, setHerramienta] = useState('pasillo'); // pasillo | escaleras | entrada | borrar
  const [seleccionado, setSeleccionado] = useState(null); // nodo donde sigue la cadena
  const [edificio, setEdificio] = useState(1); // para la herramienta Entrada
  const [mensaje, setMensaje] = useState('');
  const [textoCopiar, setTextoCopiar] = useState(null); // si el portapapeles falla
  // Grabar recorrido
  const [grabando, setGrabando] = useState(false);
  const [gps, setGps] = useState(null); // última lectura { lat, lng, accuracy }
  const [grabados, setGrabados] = useState([]); // nodos creados en esta grabación
  const lecturasRef = useRef([]); // últimas lecturas buenas (para promediar)

  useEffect(() => {
    if (activo) guardarBorrador(datos);
  }, [activo, datos]);

  // Todo cambio pasa por aquí para poder deshacer (guarda hasta 50 pasos).
  const cambiar = (fn) => {
    setHistorial((h) => [...h.slice(-49), datos]);
    setDatos(fn(datos));
  };

  const deshacer = () => {
    if (!historial.length) return;
    setDatos(historial[historial.length - 1]);
    setHistorial(historial.slice(0, -1));
    setSeleccionado(null);
  };

  const existeTramo = (d, a, b) => d.tramos.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  // Agrega un punto (o usa uno cercano) y lo une con el seleccionado.
  const agregarPunto = (latlng) => {
    const p = [latlng.lat, latlng.lng];
    // Si tocaste muy cerca de un punto que ya existe, se usa ese.
    const cercano = datos.nodos.findIndex((n) => metros(n, p) < RADIO_IMAN);
    if (cercano >= 0) {
      tocarNodo(cercano);
      return;
    }
    const nuevo = datos.nodos.length;
    cambiar((d) => ({
      ...d,
      nodos: [...d.nodos, p],
      tramos: seleccionado != null ? [...d.tramos, [seleccionado, nuevo]] : d.tramos,
    }));
    setSeleccionado(nuevo);
  };

  const borrarNodo = (i) => {
    // Al quitar un punto, los que van después bajan un número.
    const re = (n) => (n > i ? n - 1 : n);
    cambiar((d) => ({
      nodos: d.nodos.filter((_, k) => k !== i),
      tramos: d.tramos.filter(([a, b]) => a !== i && b !== i).map(([a, b, t]) => (t ? [re(a), re(b), t] : [re(a), re(b)])),
      entradas: Object.fromEntries(
        Object.entries(d.entradas)
          .map(([k, lista]) => [k, lista.filter((n) => n !== i).map(re)])
          .filter(([, lista]) => lista.length),
      ),
    }));
    setSeleccionado(null);
  };

  function tocarNodo(i) {
    if (herramienta === 'borrar') return borrarNodo(i);
    if (herramienta === 'entrada') {
      // Tocar una puerta la agrega; tocarla otra vez la quita.
      // Así un edificio puede tener 2 puertas (como el 2 y el 9).
      const lista = datos.entradas[edificio] ?? [];
      const yaEsta = lista.includes(i);
      const nueva = yaEsta ? lista.filter((n) => n !== i) : [...lista, i];
      cambiar((d) => {
        const entradas = { ...d.entradas, [edificio]: nueva };
        if (!nueva.length) delete entradas[edificio];
        return { ...d, entradas };
      });
      setMensaje(
        yaEsta
          ? `Puerta quitada del edificio ${edificio}.`
          : `Puerta del edificio ${edificio} lista. ¿Tiene otra? Tócala; si no, elige el siguiente edificio.`,
      );
      return;
    }
    if (herramienta !== 'pasillo') return;
    if (seleccionado === i) {
      setSeleccionado(null); // cortar la cadena
    } else if (seleccionado == null) {
      setSeleccionado(i);
    } else {
      if (!existeTramo(datos, seleccionado, i)) cambiar((d) => ({ ...d, tramos: [...d.tramos, [seleccionado, i]] }));
      setSeleccionado(i);
    }
  }

  const tocarTramo = (k) => {
    if (herramienta === 'borrar') {
      cambiar((d) => ({ ...d, tramos: d.tramos.filter((_, j) => j !== k) }));
    } else if (herramienta === 'escaleras') {
      cambiar((d) => ({
        ...d,
        tramos: d.tramos.map((t, j) => (j === k ? (t[2] === 'escaleras' ? [t[0], t[1]] : [t[0], t[1], 'escaleras']) : t)),
      }));
    }
  };

  const tocarMapa = (latlng) => {
    if (herramienta === 'pasillo') agregarPunto(latlng);
    else if (herramienta === 'entrada') setMensaje('Toca un PUNTO del pasillo para ponerle la entrada.');
  };

  const elegirHerramienta = (h) => {
    setHerramienta(h);
    setSeleccionado(null);
    setMensaje('');
  };

  const empezarDeCero = () => {
    if (!window.confirm('¿Borrar todo lo trazado y empezar de cero?')) return;
    cambiar(() => ({ nodos: [], tramos: [], entradas: {} }));
    setSeleccionado(null);
  };

  const volverAlArchivo = () => {
    if (!window.confirm('¿Descartar el borrador y cargar lo que está en campusPaths.js?')) return;
    cambiar(() => copiaLimpia(pasillosDelArchivo));
    setSeleccionado(null);
  };

  const copiar = async () => {
    const texto = textoArchivo(datos);
    try {
      await navigator.clipboard.writeText(texto);
      setMensaje('¡Copiado! Pégalo en src/data/campusPaths.js reemplazando todo.');
    } catch {
      setTextoCopiar(texto); // se muestra en un cuadro para copiarlo a mano
    }
  };

  // -------------------------------------------------------------------
  // Grabar recorrido con el GPS
  // -------------------------------------------------------------------
  // 1) Mientras graba, el GPS se mantiene encendido y la pantalla no se apaga.
  useEffect(() => {
    if (!grabando) return undefined;
    let pantalla = null;
    navigator.wakeLock?.request('screen').then((w) => (pantalla = w)).catch(() => {});
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (error) => {
        setMensaje(error.code === 1 ? 'Sin permiso de ubicación: actívalo en el candado de la barra.' : 'El GPS no responde; sal a un lugar abierto.');
        if (error.code === 1) setGrabando(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      pantalla?.release().catch(() => {});
    };
  }, [grabando]);

  // 2) Cada lectura nueva del GPS decide si se pone un punto.
  useEffect(() => {
    if (!grabando || !gps) return;
    if (gps.accuracy > GRABAR.precisionMaxima) {
      setMensaje(`GPS impreciso (±${Math.round(gps.accuracy)} m). Espera un momento o sal de techo…`);
      return;
    }
    // Promedio de las últimas lecturas: la línea sale menos temblorosa.
    const lecturas = [...lecturasRef.current, [gps.lat, gps.lng]].slice(-GRABAR.promedioDe);
    lecturasRef.current = lecturas;
    const p = [
      lecturas.reduce((t, l) => t + l[0], 0) / lecturas.length,
      lecturas.reduce((t, l) => t + l[1], 0) / lecturas.length,
    ];
    setMensaje(`Grabando · ±${Math.round(gps.accuracy)} m · ${grabados.length} puntos`);

    // Primer punto de la grabación: empieza aquí (o en una línea cercana).
    if (seleccionado == null) {
      const cerca = datos.nodos.findIndex((n) => metros(n, p) < GRABAR.imanCruce);
      if (cerca >= 0) setSeleccionado(cerca);
      else agregarNodoGrabado(p, null);
      return;
    }

    const ultimo = datos.nodos[seleccionado];
    if (metros(ultimo, p) < GRABAR.cadaMetros) return; // todavía no caminas lo suficiente

    // ¿Pasaste junto a una línea que ya existe? Unirse a ese punto (cruce).
    const cruce = datos.nodos.findIndex(
      (n, i) => i !== seleccionado && !grabados.slice(-3).includes(i) && metros(n, p) < GRABAR.imanCruce,
    );
    if (cruce >= 0) {
      if (!existeTramo(datos, seleccionado, cruce)) cambiar((d) => ({ ...d, tramos: [...d.tramos, [seleccionado, cruce]] }));
      setSeleccionado(cruce);
      return;
    }

    // ¿Vas casi derecho? Entonces se alarga el último tramo en vez de poner otro punto.
    const previo = grabados.length >= 2 ? grabados[grabados.length - 2] : null;
    const esDeEstaGrabacion = grabados[grabados.length - 1] === seleccionado;
    const esSoloDePaso = datos.tramos.filter(([a, b]) => a === seleccionado || b === seleccionado).length === 1;
    const esEntrada = Object.values(datos.entradas).flat().includes(seleccionado);
    if (previo != null && esDeEstaGrabacion && esSoloDePaso && !esEntrada) {
      const giro = Math.abs(((rumbo(datos.nodos[previo], ultimo) - rumbo(ultimo, p) + 540) % 360) - 180);
      if (giro < GRABAR.rectoGrados) {
        cambiar((d) => ({ ...d, nodos: d.nodos.map((n, i) => (i === seleccionado ? p : n)) }));
        return;
      }
    }

    agregarNodoGrabado(p, seleccionado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps]);

  function agregarNodoGrabado(p, desde) {
    const nuevo = datos.nodos.length;
    cambiar((d) => ({
      ...d,
      nodos: [...d.nodos, p],
      tramos: desde != null ? [...d.tramos, [desde, nuevo]] : d.tramos,
    }));
    setSeleccionado(nuevo);
    setGrabados((g) => [...g, nuevo]);
  }

  const alternarGrabacion = () => {
    if (grabando) {
      setGrabando(false);
      setSeleccionado(null);
      setMensaje(`Grabación detenida: ${grabados.length} puntos nuevos. Revisa la línea y corrige con Borrar o Deshacer.`);
      return;
    }
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      setMensaje('Para grabar se necesita https: abre la versión publicada en el celular.');
      return;
    }
    setHerramienta('pasillo');
    setSeleccionado(null);
    setGrabados([]);
    lecturasRef.current = [];
    setGps(null);
    setMensaje('Buscando GPS… empieza a caminar por el pasillo.');
    setGrabando(true);
  };

  return {
    activo,
    grabando,
    gps,
    alternarGrabacion,
    datos,
    herramienta,
    seleccionado,
    edificio,
    mensaje,
    textoCopiar,
    puedeDeshacer: historial.length > 0,
    setEdificio,
    setTextoCopiar,
    elegirHerramienta,
    tocarMapa,
    tocarNodo,
    tocarTramo,
    agregarPunto,
    deshacer,
    empezarDeCero,
    volverAlArchivo,
    copiar,
  };
}

// ---------------------------------------------------------------------
// Lo que se dibuja DENTRO del mapa (puntos y tramos)
// ---------------------------------------------------------------------
export function EditorCapas({ editor }) {
  const { datos, seleccionado, herramienta } = editor;
  // Qué edificio(s) tienen su puerta en cada punto: { nodo: '8 y 9' }
  const entradaDe = {};
  Object.entries(datos.entradas).forEach(([k, lista]) =>
    lista.forEach((n) => (entradaDe[n] = entradaDe[n] ? `${entradaDe[n]} y ${k}` : k)),
  );

  return (
    <>
      {/* Mientras graba: dónde te ubica el GPS y qué tan preciso es */}
      {editor.grabando && editor.gps && (
        <>
          <Circle
            center={[editor.gps.lat, editor.gps.lng]}
            radius={editor.gps.accuracy}
            pathOptions={{ color: colors.blue, weight: 1, fillOpacity: 0.1 }}
            interactive={false}
          />
          <CircleMarker
            center={[editor.gps.lat, editor.gps.lng]}
            radius={7}
            pathOptions={{ color: 'white', weight: 3, fillColor: colors.blue, fillOpacity: 1 }}
            interactive={false}
          />
        </>
      )}
      {datos.tramos.map(([a, b, tipo], k) =>
        datos.nodos[a] && datos.nodos[b] ? (
          <Polyline
            key={`t${k}-${a}-${b}-${tipo ?? ''}`}
            positions={[datos.nodos[a], datos.nodos[b]]}
            pathOptions={{
              color: tipo === 'escaleras' ? colors.gold : colors.crimson,
              weight: 6,
              dashArray: tipo === 'escaleras' ? '4 8' : null,
              lineCap: 'round',
            }}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => editor.tocarTramo(k) }}
          />
        ) : null,
      )}
      {datos.nodos.map((n, i) => {
        const esEntrada = entradaDe[i] != null;
        return (
          <CircleMarker
            key={`n${i}-${n[0]}-${n[1]}-${seleccionado === i}-${esEntrada}`}
            center={n}
            radius={seleccionado === i ? 10 : esEntrada ? 8 : 6}
            pathOptions={{
              color: 'white',
              weight: 2,
              fillOpacity: 1,
              fillColor: seleccionado === i ? colors.gold : esEntrada ? colors.blue : colors.crimson,
            }}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => editor.tocarNodo(i) }}
          >
            {esEntrada && (
              <Tooltip permanent direction="top" offset={[0, -8]} className="pm-traza-etiqueta">
                Entrada {entradaDe[i]}
              </Tooltip>
            )}
            {herramienta === 'borrar' && !esEntrada && <Tooltip direction="top">Punto {i}</Tooltip>}
          </CircleMarker>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------
// Panel de botones (arriba del mapa)
// ---------------------------------------------------------------------
const HERRAMIENTAS = [
  { id: 'pasillo', icono: 'timeline', texto: 'Pasillo' },
  { id: 'escaleras', icono: 'stairs', texto: 'Escaleras' },
  { id: 'entrada', icono: 'door_front', texto: 'Entrada' },
  { id: 'borrar', icono: 'delete', texto: 'Borrar' },
];

const AYUDA = {
  pasillo: 'Toca el mapa para poner puntos en cadena. Toca un punto existente para unirte. Toca el dorado para cortar.',
  escaleras: 'Toca un tramo para marcarlo como escaleras (punteado dorado). Otra vez para quitarlo.',
  entrada: 'Elige el edificio y toca el punto de su puerta (si tiene dos, toca las dos). Tócala otra vez para quitarla.',
  borrar: 'Toca un punto o un tramo para quitarlo.',
};

export function EditorPanel({ editor, posicion }) {
  const { datos } = editor;
  const conEntrada = Object.keys(datos.entradas).length;

  return (
    <div className="pm-traza">
      {/* Estilo del botón Grabar (lo demás del panel está en CampusMap.jsx) */}
      <style>{ESTILO_GRABAR}</style>
      <div className="pm-traza__titulo">
        <Icon name="edit_road" size={20} />
        <strong>Trazar pasillos</strong>
        <span>
          {datos.nodos.length} puntos · {datos.tramos.length} tramos · entradas {conEntrada}/10
        </span>
      </div>

      <div className="pm-traza__fila">
        {HERRAMIENTAS.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`pm-traza__chip ${editor.herramienta === h.id ? 'is-on' : ''}`}
            onClick={() => editor.elegirHerramienta(h.id)}
          >
            <Icon name={h.icono} size={18} />
            {h.texto}
          </button>
        ))}
      </div>

      {editor.herramienta === 'entrada' && (
        <label className="pm-traza__fila pm-traza__edificio">
          Edificio:
          <select value={editor.edificio} onChange={(e) => editor.setEdificio(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {datos.entradas[n] != null ? '✓' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="pm-traza__ayuda">{editor.mensaje || AYUDA[editor.herramienta]}</p>

      {/* Grabar recorrido: la línea se traza sola mientras caminas */}
      <button
        type="button"
        className={`pm-traza__grabar ${editor.grabando ? 'is-on' : ''}`}
        onClick={editor.alternarGrabacion}
      >
        <Icon name={editor.grabando ? 'stop_circle' : 'radio_button_checked'} size={20} />
        {editor.grabando ? 'Detener grabación' : 'Grabar recorrido caminando'}
      </button>

      <div className="pm-traza__fila">
        {editor.herramienta === 'pasillo' && !editor.grabando && (
          <button
            type="button"
            className="pm-traza__chip"
            disabled={!posicion}
            onClick={() => editor.agregarPunto({ lat: posicion.lat, lng: posicion.lng })}
            title={posicion ? 'Agregar un punto donde estás' : 'Activa "Mi ubicación" primero'}
          >
            <Icon name="add_location_alt" size={18} />
            Punto aquí
          </button>
        )}
        <button type="button" className="pm-traza__chip" disabled={!editor.puedeDeshacer} onClick={editor.deshacer}>
          <Icon name="undo" size={18} />
          Deshacer
        </button>
        <button type="button" className="pm-traza__chip pm-traza__chip--principal" onClick={editor.copiar}>
          <Icon name="content_copy" size={18} />
          Copiar
        </button>
        <button type="button" className="pm-traza__chip" onClick={editor.volverAlArchivo} title="Cargar campusPaths.js">
          <Icon name="restart_alt" size={18} />
        </button>
        <button type="button" className="pm-traza__chip" onClick={editor.empezarDeCero} title="Empezar de cero">
          <Icon name="delete_sweep" size={18} />
        </button>
      </div>

      {/* Si el navegador no dejó copiar solo, se muestra el texto para copiarlo a mano */}
      {editor.textoCopiar && (
        <div className="pm-traza__copiar">
          <p>Selecciona todo (Ctrl + A), cópialo (Ctrl + C) y pégalo en src/data/campusPaths.js:</p>
          <textarea readOnly value={editor.textoCopiar} onFocus={(e) => e.target.select()} />
          <button type="button" className="pm-traza__chip" onClick={() => editor.setTextoCopiar(null)}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

const ESTILO_GRABAR = `
.pm-traza__grabar {
  display: flex; align-items: center; justify-content: center; gap: .4rem; min-height: 42px; border-radius: 999px;
  font-weight: 700; font-size: .9rem; color: white; background: var(--pm-azul);
}
.pm-traza__grabar.is-on { background: var(--pm-carmesi); animation: pm-grabando 1.4s ease-in-out infinite; }
@keyframes pm-grabando { 0%, 100% { opacity: 1; } 50% { opacity: .7; } }
`;
