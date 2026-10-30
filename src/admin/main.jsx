// src/admin/main.jsx — Responsable: Alexis
// Punto de entrada del panel de reportes (admin.html).
// Es una página aparte de la app de los alumnos: no aparece en el menú
// y no registra el service worker (siempre trabaja con datos frescos).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp.jsx';
import '../styles/global.css';
import { aplicarApariencia } from '../lib/tema.js';

// Apariencia compartida con la app: tema, letra, contraste y movimiento (src/lib/tema.js).
aplicarApariencia();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>
);
