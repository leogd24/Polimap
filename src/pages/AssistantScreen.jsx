import { useEffect, useRef, useState } from 'react';
import { colors, alpha } from '../styles/theme.js';
import { faqEntries } from '../data/faqEntries.js';
import { campusBuildings } from '../data/campusBuildings.js';
import { getBuildings, getFaq } from '../lib/api.js';
import { answerQuestion, STARTER_SUGGESTIONS } from '../lib/assistantBot.js';
import Icon from '../components/Icon.jsx';
import PolimapLogo from '../components/PolimapLogo.jsx';
import { TextField } from '../components/Inputs.jsx';

// Pestañas de MainShell a las que puede mandar el asistente.
// ⚠️ Deben coincidir con el orden de `destinations` en MainShell.jsx
// (0 Inicio, 1 Mapa, 2 Edificios, 3 Reportar, 4 Horario).
const TABS = {
  reportar: { index: 3, label: 'Ir a Reportar', icon: 'add_alert' },
  horario: { index: 4, label: 'Ir a Mi horario', icon: 'calendar_month' },
};

// Cuánto "piensa" el bot antes de contestar (solo para que se sienta natural).
const TYPING_MS = 450;

const WELCOME = {
  id: 0,
  from: 'bot',
  text:
    'Hola, soy el asistente de POLIMAP. Pregúntame por trámites, servicios, edificios, salones o dónde está un maestro (ahora o a cierta hora). Solo contesto temas del Poli.',
  building: null,
  tab: null,
  suggestions: STARTER_SUGGESTIONS,
};

/// Asistente de consultas tipo chat (Gabo).
/// La lógica para contestar está en src/lib/assistantBot.js.
///
/// Props:
///   onBack       → cerrar el asistente.
///   onShowOnMap  → (opcional) función(numeroEdificio). Si existe, aparece el
///                  botón "Ver en el mapa" debajo de las respuestas.
///   onNavigate   → (opcional) función(indicePestaña). Si existe, aparecen los
///                  botones "Ir a Mi horario" / "Ir a Reportar".
export default function AssistantScreen({ onBack, onShowOnMap, onNavigate }) {
  // Arranca con los datos locales y luego intenta traer los de la API.
  const [faq, setFaq] = useState(faqEntries);
  const [buildings, setBuildings] = useState(campusBuildings);
  const [messages, setMessages] = useState([WELCOME]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);

  const nextId = useRef(1);
  const timer = useRef(null);
  const endRef = useRef(null);

  // 1. Datos: API → si falla, api.js regresa los locales.
  useEffect(() => {
    let active = true;
    getFaq().then((data) => active && Array.isArray(data) && data.length && setFaq(data));
    getBuildings().then((data) => active && Array.isArray(data) && data.length && setBuildings(data));
    return () => {
      active = false;
      clearTimeout(timer.current);
    };
  }, []);

  // 2. Bajar hasta el último mensaje cada vez que llega uno nuevo.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typing]);

  // 3. Enviar una pregunta (del campo de texto o de un botón sugerido).
  const send = (text) => {
    const question = text.trim();
    if (!question || typing) return;

    setMessages((previous) => [...previous, { id: nextId.current++, from: 'user', text: question }]);
    setDraft('');
    setTyping(true);

    timer.current = setTimeout(() => {
      const reply = answerQuestion(question, { faq, buildings });
      setMessages((previous) => [...previous, { id: nextId.current++, from: 'bot', ...reply }]);
      setTyping(false);
    }, TYPING_MS);
  };

  const restart = () => {
    clearTimeout(timer.current);
    setTyping(false);
    setDraft('');
    setMessages([WELCOME]);
  };

  const lastBotId = [...messages].reverse().find((m) => m.from === 'bot')?.id;

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
        <div className="ml-2 min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold">Asistente POLIMAP</div>
          <div className="text-[0.6875rem] font-medium" style={{ color: alpha(colors.white, 0.75) }}>
            Solo temas del Poli
          </div>
        </div>
        <button
          type="button"
          onClick={restart}
          title="Nueva conversación"
          aria-label="Nueva conversación"
          className="tappable flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44 }}
        >
          <Icon name="restart_alt" color={colors.white} />
        </button>
      </header>

      {/* Conversación */}
      <div className="app-scroll min-h-0 flex-1 px-[14px] pt-4 pb-2" aria-live="polite">
        {/* En computadora el chat no pasa de 720 px de ancho (centrado). */}
        <div className="mx-auto w-full max-w-[720px]">
          {messages.map((message) =>
            message.from === 'user' ? (
              <UserBubble key={message.id} text={message.text} />
            ) : (
              <BotBubble
                key={message.id}
                message={message}
                isLast={message.id === lastBotId && !typing}
                onSuggestion={send}
                onShowOnMap={onShowOnMap}
                onNavigate={onNavigate}
              />
            )
          )}
          {typing && <TypingBubble />}
          <div ref={endRef} />
        </div>
      </div>

      {/* Campo para escribir */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
        className="shrink-0 px-[14px] pt-2"
        style={{
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: colors.background,
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              value={draft}
              onChange={setDraft}
              placeholder="Ej. ¿Dónde saco mi kardex?"
              prefixIcon="chat_bubble"
              filled={false}
              inputProps={{
                'aria-label': 'Escribe tu pregunta',
                enterKeyHint: 'send',
                autoComplete: 'off',
                maxLength: 200,
              }}
            />
          </div>
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!draft.trim() || typing}
            className="tappable flex shrink-0 items-center justify-center rounded-full border-0"
            style={{
              width: 52,
              height: 52,
              backgroundColor: draft.trim() && !typing ? colors.crimson : colors.border,
            }}
          >
            <Icon name="send" color={colors.white} />
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------
// Burbujas
// ---------------------------------------------------------------------

function UserBubble({ text }) {
  return (
    <div className="mb-3 flex justify-end">
      <div
        className="max-w-[82%] px-4 py-[10px] text-[0.9375rem] font-semibold"
        style={{
          backgroundColor: colors.blue,
          color: colors.white,
          borderRadius: '20px 20px 6px 20px',
          lineHeight: 1.4,
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function BotBubble({ message, isLast, onSuggestion, onShowOnMap, onNavigate }) {
  const tab = message.tab ? TABS[message.tab] : null;
  const showSuggestions = isLast && message.suggestions?.length > 0;

  return (
    <div className="mb-3 flex items-end gap-2">
      <PolimapLogo size={30} />
      <div className="min-w-0 max-w-[86%]">
        <div
          className="px-4 py-3"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '20px 20px 20px 6px',
          }}
        >
          {/* Dónde está (si la respuesta tiene edificio) */}
          {message.building && (
            <div className="mb-1 flex items-center gap-1 text-[0.8125rem] font-extrabold" style={{ color: colors.crimsonDark }}>
              <Icon name="location_on" size={18} color={colors.crimsonDark} />
              <span className="min-w-0">{message.building.name}</span>
            </div>
          )}

          <p className="m-0 whitespace-pre-line text-[0.9375rem]" style={{ color: colors.textPrimary, lineHeight: 1.45 }}>
            {message.text}
          </p>

          {/* Botones de acción */}
          {((message.building && onShowOnMap) || (tab && onNavigate)) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.building && onShowOnMap && (
                <ActionButton icon="map" label="Ver en el mapa" onClick={() => onShowOnMap(message.building.number)} />
              )}
              {tab && onNavigate && (
                <ActionButton icon={tab.icon} label={tab.label} onClick={() => onNavigate(tab.index)} />
              )}
            </div>
          )}
        </div>

        {/* Preguntas sugeridas (solo en el último mensaje del bot) */}
        {showSuggestions && (
          <div className="mt-2">
            {message.suggestionsTitle && (
              <div className="mb-1 pl-1 text-xs font-bold" style={{ color: colors.textSecondary }}>
                {message.suggestionsTitle}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {message.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestion(suggestion)}
                  className="tappable rounded-full px-3 py-2 text-left text-[0.8125rem] font-bold"
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.ink,
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable flex items-center gap-1 rounded-full border-0 px-3 py-2 text-[0.8125rem] font-extrabold"
      style={{ backgroundColor: colors.blueTint, color: colors.ink }}
    >
      <Icon name={icon} size={18} color={colors.ink} />
      {label}
    </button>
  );
}

function TypingBubble() {
  return (
    <div className="mb-3 flex items-end gap-2" aria-label="El asistente está escribiendo">
      <PolimapLogo size={30} />
      <div
        className="flex items-center gap-1 px-4 py-[14px]"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '20px 20px 20px 6px',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block rounded-full"
            style={{
              width: 7,
              height: 7,
              backgroundColor: colors.textMuted,
              animation: `pm-typing 1s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
        <style>{'@keyframes pm-typing{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}'}</style>
      </div>
    </div>
  );
}
