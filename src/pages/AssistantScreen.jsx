import { useState } from 'react';
import { colors } from '../styles/theme.js';
import { faqEntries } from '../data/faqEntries.js';
import Icon from '../components/Icon.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import { TextField } from '../components/Inputs.jsx';

/// Equivalente de screens/assistant_screen.dart
export default function AssistantScreen({ onBack }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  const normalized = query.toLowerCase().trim();
  const results = faqEntries.filter(
    (entry) =>
      normalized === '' ||
      entry.question.toLowerCase().includes(normalized) ||
      entry.answer.toLowerCase().includes(normalized)
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: colors.background }}>
      <header
        className="flex shrink-0 items-center px-2"
        style={{
          backgroundColor: colors.blue,
          color: colors.white,
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(64px + env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Regresar"
          className="tappable flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44 }}
        >
          <Icon name="arrow_back" color={colors.white} />
        </button>
        <span className="ml-2 text-xl font-extrabold">Asistente POLIMAP</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-[18px] mt-2 mb-4 flex items-center p-[18px]" style={{ backgroundColor: colors.blue, borderRadius: 24 }}>
          <PolimapLogo size={50} dark />
          <div className="ml-[14px] min-w-0">
            <div className="text-[17px]" style={{ color: colors.white, fontWeight: 900 }}>
              Hola, ¿qué estás buscando?
            </div>
            <div className="mt-[3px]" style={{ color: colors.blueTint }}>
              Escribe un trámite, servicio o lugar.
            </div>
          </div>
        </div>

        <div className="px-[18px]">
          <TextField
            value={query}
            onChange={setQuery}
            placeholder="Ej. ¿Dónde saco mi kardex?"
            prefixIcon="search"
            suffix={
              query === '' ? null : (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar"
                  className="tappable flex items-center justify-center pr-3"
                >
                  <Icon name="close" color={colors.textSecondary} />
                </button>
              )
            }
          />
        </div>

        <div className="h-[10px]" />

        {results.length === 0 ? (
          <div className="flex-1">
            <EmptyState
              icon="question_answer"
              filled={false}
              title="Aún no tengo esa respuesta"
              body="Intenta escribir el nombre del servicio o edificio."
            />
          </div>
        ) : (
          <div className="app-scroll flex-1 px-[18px] pt-[6px] pb-7">
            {results.map((entry, index) => (
              <div key={entry.question} className={index === 0 ? '' : 'mt-[10px]'}>
                <Card>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === entry.question ? null : entry.question)}
                    className="flex w-full items-center px-4 py-[14px] text-left"
                  >
                    <div
                      className="flex shrink-0 items-center justify-center rounded-full"
                      style={{ width: 40, height: 40, backgroundColor: colors.blueTint }}
                    >
                      <Icon name={entry.icon} size={21} color={colors.blue} />
                    </div>
                    <span className="ml-4 min-w-0 flex-1 font-extrabold">{entry.question}</span>
                    <Icon
                      name="expand_more"
                      color={expanded === entry.question ? colors.blue : colors.textSecondary}
                      style={{
                        transition: 'transform 200ms ease',
                        transform: expanded === entry.question ? 'rotate(180deg)' : 'none',
                      }}
                    />
                  </button>
                  {expanded === entry.question && (
                    <div
                      className="px-4 pb-4"
                      style={{ color: colors.textSecondary, lineHeight: 1.45 }}
                    >
                      {entry.answer}
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
