import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Dónde corre la API PHP en tu compu (XAMPP).
// Si clonaste el repo en C:\xampp\htdocs\Polimap, la API está en
// http://localhost/Polimap/api/  → deja este valor como está.
// Si lo tienes en otra carpeta de htdocs, cambia '/Polimap' por su nombre.
const XAMPP_TARGET = 'http://localhost';
const XAMPP_FOLDER = '/Polimap';

// ---------------------------------------------------------------------
// Sin internet: al terminar "npm run build" se escribe en dist/sw.js la lista
// de TODOS los archivos de la app (JS, CSS, íconos, imágenes, worker de PDF)
// para que el service worker los guarde desde la primera visita.
// La versión del caché cambia sola cuando cambia algún archivo.
// No se incluyen las imágenes oficiales de horarios (pesan 7 MB): esas se
// guardan solas cuando abres la de tu grupo.
// ---------------------------------------------------------------------
function listaSinInternet() {
  return {
    name: 'polimap-sin-internet',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url));
      const sw = path.join(dist, 'sw.js');
      if (!fs.existsSync(sw)) return;
      const archivos = [];
      const recorrer = (dir) => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          const ruta = path.join(dir, f.name);
          const rel = '/' + path.relative(dist, ruta).split(path.sep).join('/');
          if (f.isDirectory()) {
            if (rel !== '/horarios') recorrer(ruta);
          } else if (rel !== '/sw.js' && !rel.endsWith('.map') && !f.name.startsWith('.')) {
            archivos.push(rel);
          }
        }
      };
      recorrer(dist);
      archivos.sort();
      const huella = createHash('sha1');
      for (const a of archivos) huella.update(a).update(fs.readFileSync(path.join(dist, a)));
      const version = huella.digest('hex').slice(0, 10);
      const codigo = fs
        .readFileSync(sw, 'utf8')
        .replace(/const ARCHIVOS = \[[^\]]*\];/, `const ARCHIVOS = ${JSON.stringify(archivos)};`)
        .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
      fs.writeFileSync(sw, codigo);
    },
  };
}

// "npm run build" hace dos pasadas para que cada página sea UN solo archivo
// JavaScript (y uno de CSS), sin trozos que se descarguen después:
//   vite build               → la app (index.html), borra dist/ antes
//   vite build --mode panel  → el panel (admin.html), se agrega a dist/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), listaSinInternet()],
  build: {
    emptyOutDir: mode !== 'panel',
    // Cada página es UN archivo grande a propósito (sin descargas aparte): sin aviso.
    chunkSizeWarningLimit: 3000,
    // Navegadores mínimos: los de Vite, pero con Safari 15 (iPhone con iOS 15+)
    // en vez de 14. pdf.js (vista previa de PDF en Avisos) no se puede
    // convertir para Safari 14 y sin esto "npm run build" falla.
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari15'],
    rollupOptions: {
      input:
        mode === 'panel'
          ? fileURLToPath(new URL('./admin.html', import.meta.url))
          : fileURLToPath(new URL('./index.html', import.meta.url)),
      output: {
        // Todo en un solo archivo .js por página.
        inlineDynamicImports: true,
        // El "worker" de pdf.js viene como .mjs; se publica como .js para que
        // el hosting lo mande con tipo JavaScript (si no, no abren los PDF).
        assetFileNames: (info) =>
          (info.names?.[0] ?? info.name ?? '').endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  // Lo mismo para "npm run dev" (Vite pre-empaqueta pdf.js con esbuild).
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
  },
  server: {
    // Permite abrir la app desde el celular en la misma red WiFi.
    host: true,
    port: 5173,
    // Proxy: cuando React pide /api/edificios.php, Vite lo reenvía a
    // http://localhost/Polimap/api/edificios.php. Así no hay problemas de CORS
    // y el mismo código funciona igual cuando la app ya está publicada.
    proxy: {
      '/api': {
        target: XAMPP_TARGET,
        changeOrigin: true,
        rewrite: (path) => XAMPP_FOLDER + path,
      },
    },
  },
}));
