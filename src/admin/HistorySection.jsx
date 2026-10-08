// src/admin/HistorySection.jsx — Responsable: Alexis
// Sección "Historial de cambios": los últimos 200 movimientos de todos los
// reportes (quién cambió qué y cuándo). Toca un folio para abrirlo.
import { useEffect, useState } from 'react';
import { colors } from '../styles/theme.js';
import { getReportHistory } from '../lib/api.js';
import Card from '../components/Card.jsx';
import HistoryList from './HistoryList.jsx';
import { SectionTitle, OutlineButton } from './ui.jsx';

export default function HistorySection({ onOpen, onMessage, refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyAdmins, setOnlyAdmins] = useState(false);

  useEffect(() => {
    setLoading(true);
    getReportHistory('todos')
      .then(setItems)
      .catch((error) => onMessage(`No se pudo cargar el historial: ${error.message}`))
      .finally(() => setLoading(false));
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = onlyAdmins ? items.filter((h) => h.accion !== 'creado') : items;

  return (
    <div>
      <SectionTitle title="Historial de cambios" subtitle="Últimos 200 movimientos de todos los reportes.">
        <OutlineButton icon="manage_accounts" active={onlyAdmins} onClick={() => setOnlyAdmins(!onlyAdmins)}>
          Solo cambios de administradores
        </OutlineButton>
      </SectionTitle>
      <Card className="p-5">
        {loading ? (
          <p className="m-0 text-sm" style={{ color: colors.textMuted }}>
            Cargando…
          </p>
        ) : (
          <HistoryList items={shown} showFolio onOpenFolio={onOpen} />
        )}
      </Card>
    </div>
  );
}
