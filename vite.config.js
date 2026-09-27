import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dónde corre la API PHP en tu compu (XAMPP).
// Si clonaste el repo en C:\xampp\htdocs\Polimap, la API está en
// http://localhost/Polimap/api/  → deja este valor como está.
// Si lo tienes en otra carpeta de htdocs, cambia '/Polimap' por su nombre.
const XAMPP_TARGET = 'http://localhost';
const XAMPP_FOLDER = '/Polimap';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
