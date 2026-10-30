// src/hooks/useGrupoGuardado.js — Responsable: Alexis
// El grupo que el alumno eligió en Horario (se guarda en el celular) y se
// entera cuando lo cambian (evento "polimap:horario" o desde otra pestaña).
//   const grupo = useGrupoGuardado();   // objeto del horario o null
import { useEffect, useState } from 'react';
import { grupoPorCodigo } from '../lib/horario.js';

function leer() {
  try {
    return JSON.parse(localStorage.getItem('polimap.horario'))?.grupo ?? null;
  } catch {
    return null;
  }
}

export default function useGrupoGuardado() {
  const [codigo, setCodigo] = useState(leer);
  useEffect(() => {
    const cambio = () => setCodigo(leer());
    window.addEventListener('polimap:horario', cambio);
    window.addEventListener('storage', cambio);
    return () => {
      window.removeEventListener('polimap:horario', cambio);
      window.removeEventListener('storage', cambio);
    };
  }, []);
  return codigo ? grupoPorCodigo(codigo) : null;
}
