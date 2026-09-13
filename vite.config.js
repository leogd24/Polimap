import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Permite abrir la app desde el celular en la misma red WiFi.
    host: true,
    port: 5173,
  },
});
