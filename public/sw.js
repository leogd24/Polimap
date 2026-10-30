// Service worker de POLIMAP: hace la app instalable y la deja abrir SIN INTERNET.
//
// - ARCHIVOS: todo lo de la app y el panel (JS, CSS, íconos, imágenes, worker
//   de PDF). "npm run build" escribe aquí la lista y la VERSION solito
//   (vite.config.js → listaSinInternet). En el repo se ven vacías: es normal.
// - Se guardan al instalar, así la app abre sin red desde la primera visita.
// - Lo que se va viendo también se guarda: horario oficial de tu grupo,
//   cuadritos del mapa (OpenStreetMap) y fotos de los avisos.
// - La API (/api/*.php) siempre va a la red; api.js guarda la última copia
//   de lo importante (avisos, edificios, FAQ, calendario) para usarla sin red.
const ARCHIVOS = [];
const VERSION = 'dev';
const CACHE = `polimap-${VERSION}`;
const CACHE_MAPA = 'polimap-mapa'; // cuadritos del mapa (no cambian con cada versión)
const MAX_CUADRITOS = 600;
// Letras e íconos (Google Fonts). Sin ellos, sin internet los íconos se verían como palabras.
const CACHE_FUENTES = 'polimap-fuentes';
const FUENTES = [
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,0&display=block',
];
// Con `npm run dev` (puerto 5173) NO se guarda nada en caché: así no estorba
// a Vite. Solo se registra ahí para probar las notificaciones.
const DEV = self.location.port === '5173';
const BASE = ['/', '/index.html', '/admin.html', '/manifest.webmanifest', '/favicon.png', '/img/logo-polimap.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  if (DEV) {
    self.skipWaiting();
    return;
  }
  const lista = [...new Set([...BASE, ...ARCHIVOS])];
  event.waitUntil(
    caches
      .open(CACHE)
      // Uno por uno: si algún archivo falla, los demás sí se guardan.
      .then((cache) => Promise.all(lista.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))))
      .then(guardarFuentes)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE, CACHE_MAPA, CACHE_FUENTES].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/** Descarga las hojas de Google Fonts y sus archivos de letra (si hay red). */
function guardarFuentes() {
  return caches.open(CACHE_FUENTES).then((cache) =>
    Promise.all(
      FUENTES.map((url) =>
        fetch(url, { mode: 'cors' })
          .then((r) => {
            if (!r.ok) return null;
            cache.put(url, r.clone());
            return r.text();
          })
          .then((css) => {
            const letras = [...(css || '').matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
            return Promise.all(letras.map((f) => cache.match(f).then((ya) => ya || cache.add(f))));
          })
          .catch(() => {})
      )
    )
  );
}

/** Guarda una copia en el caché (sin esperar). */
function guardar(nombre, request, response) {
  const copia = response.clone();
  caches.open(nombre).then((cache) => cache.put(request, copia));
}

/** Deja como máximo MAX_CUADRITOS en el caché del mapa (borra los más viejos). */
function recortarMapa() {
  caches.open(CACHE_MAPA).then((cache) =>
    cache.keys().then((keys) => Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_CUADRITOS)).map((k) => cache.delete(k))))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (DEV || request.method !== 'GET') return;
  const url = new URL(request.url);
  const mismoSitio = url.origin === self.location.origin;

  // Cuadritos del mapa: los ya vistos salen del caché (sirven sin internet).
  if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) {
    event.respondWith(
      caches.open(CACHE_MAPA).then((cache) =>
        cache.match(request).then(
          (guardado) =>
            guardado ||
            fetch(request).then((response) => {
              if (response.ok) {
                cache.put(request, response.clone()).then(recortarMapa);
              }
              return response;
            })
        )
      )
    );
    return;
  }
  // Google Fonts: del caché; si no está, de la red y se guarda.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_FUENTES).then((cache) =>
        cache.match(request, { ignoreVary: true }).then(
          (guardado) =>
            guardado ||
            fetch(request).then((response) => {
              if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }
  if (!mismoSitio) return;

  // Fotos y archivos de los avisos: red primero; sin red, la copia guardada.
  if (url.pathname.startsWith('/api/uploads/avisos/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) guardar(CACHE, request, response);
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || Response.error()))
    );
    return;
  }

  // El resto de la API SIEMPRE va a la red: si se guardara aquí, la app y el
  // panel mostrarían edificios y reportes viejos.
  if (url.pathname.startsWith('/api/')) return;

  // Abrir una página: red primero y, si no hay, la copia guardada
  // (admin.html para el panel, index.html para todo lo demás).
  if (request.mode === 'navigate') {
    const pagina = url.pathname.startsWith('/admin') ? '/admin.html' : '/index.html';
    const esPrincipal = ['/', '/index.html', '/admin', '/admin.html'].includes(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && esPrincipal) guardar(CACHE, pagina, response);
          return response;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true }).then((r) => r || caches.match(pagina)).then((r) => r || caches.match('/'))
        )
    );
    return;
  }

  // Archivos de la app: del caché; si no está, de la red y se guarda.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) guardar(CACHE, request, response);
          return response;
        })
    )
  );
});

// ---------------------------------------------------------------------
// Notificaciones push (avisos urgentes). Las manda api/avisos.php cifradas;
// el navegador las descifra y aquí solo se muestran.
// Datos: { title, body, url, tag, tipo }
// ---------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'POLIMAP';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Hay un aviso nuevo en POLIMAP.',
      icon: '/icons/icon-192.png',
      badge: '/favicon.png',
      tag: data.tag || 'polimap-aviso', // el mismo aviso reenviado reemplaza al anterior
      renotify: true,
      requireInteraction: data.tipo === 'urgente', // los urgentes se quedan hasta que los toquen
      vibrate: [120, 60, 120],
      data: { url: data.url || '/' },
    })
  );
});

// Al tocar la notificación: abre la app (o la trae al frente) en el aviso.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin && 'focus' in v) {
          v.navigate?.(url);
          return v.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
