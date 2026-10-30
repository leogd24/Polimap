// src/hooks/useNoticesFeed.js — Responsable: Alexis
// Estado de los avisos (posts) para Inicio y para la pantalla de Avisos:
//   notices        lista (fijados y urgentes primero, como los manda la API)
//   loading        true la primera vez
//   like(notice)   me gusta / ya no (se ve al instante y se confirma con la API)
//   setCount(id,n) actualiza el número de comentarios (lo avisa la hoja de comentarios)
//   setPoll(id,p)  guarda la encuesta después de votar
//   reload()       volver a pedir
import { useCallback, useEffect, useState } from 'react';
import { getNotices, likeNotice } from '../lib/api.js';

export default function useNoticesFeed() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const lista = await getNotices();
    setNotices(Array.isArray(lista) ? lista : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    // Si cambia el grupo en Horario, vuelven a pedirse (por los avisos de ese grupo).
    window.addEventListener('polimap:horario', reload);
    return () => window.removeEventListener('polimap:horario', reload);
  }, [reload]);

  const cambiar = (id, cambios) => setNotices((l) => l.map((n) => (n.id === id ? { ...n, ...cambios } : n)));

  async function like(notice) {
    // Primero se ve el cambio (rápido) y luego se confirma con lo que diga la API.
    const antes = { liked: notice.liked, likes: notice.likes };
    cambiar(notice.id, { liked: !notice.liked, likes: notice.likes + (notice.liked ? -1 : 1) });
    try {
      const r = await likeNotice(notice.id);
      cambiar(notice.id, { liked: r.liked, likes: r.likes });
    } catch {
      cambiar(notice.id, antes);
    }
  }

  const setCount = useCallback((id, n) => cambiar(id, { comments: n }), []);

  const setPoll = useCallback((id, poll) => cambiar(id, { poll }), []);

  return { notices, loading, like, setCount, setPoll, reload };
}
