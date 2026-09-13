import { useState } from 'react';
import { colors } from '../styles/theme.js';
import { scheduleCareers, groupsForCareer, scheduleDays } from '../data/schedules.js';
import Card, { Divider } from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SelectField } from '../components/Inputs.jsx';

/// Equivalente de screens/schedule_screen.dart
export default function ScheduleScreen() {
  const [career, setCareer] = useState(null);
  const [groupCode, setGroupCode] = useState(null);

  const groups = career === null ? [] : groupsForCareer(career);
  const group = groups.find((item) => item.code === groupCode) ?? null;

  return (
    <div className="app-scroll flex-1 px-[18px] pt-3 pb-7">
      <SelectField
        value={career}
        onChange={(value) => {
          setCareer(value);
          setGroupCode(null);
        }}
        placeholder="Selecciona tu carrera"
        prefixIcon="school"
        options={scheduleCareers.map((item) => ({ value: item, label: item }))}
      />

      <div className="mt-3">
        <SelectField
          value={groupCode}
          onChange={setGroupCode}
          placeholder={career === null ? 'Primero elige la carrera' : 'Selecciona tu grupo y turno'}
          prefixIcon="groups"
          disabled={groups.length === 0}
          options={groups.map((item) => ({
            value: item.code,
            label: `${item.code} · ${item.group} · ${item.shift}`,
          }))}
        />
      </div>

      <div className="mt-[18px]">
        {group === null ? (
          <div className="pt-10">
            <EmptyState
              icon="calendar_month"
              filled={false}
              title="Elige tu carrera y grupo"
              body="Aquí aparecerá tu horario de clases de la semana."
            />
          </div>
        ) : (
          <Schedule group={group} />
        )}
      </div>
    </div>
  );
}

function Schedule({ group }) {
  const days = scheduleDays
    .map((day) => ({ day, classes: group.sessions.filter((session) => session.day === day) }))
    .filter((entry) => entry.classes.length > 0);

  return (
    <>
      <div
        className="flex items-center px-4 py-[14px]"
        style={{ backgroundColor: colors.blue, borderRadius: 'var(--radius-tile)' }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-lg" style={{ color: colors.white, fontWeight: 900 }}>
            {group.code}
          </div>
          <div className="mt-[2px] text-xs" style={{ color: colors.blueTint }}>
            {group.group} · {group.shift}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg" style={{ color: colors.gold, fontWeight: 900 }}>
            {group.weeklyHours} h
          </div>
          <div className="text-[11px]" style={{ color: colors.blueTint }}>
            a la semana
          </div>
        </div>
      </div>

      <div className="h-4" />

      {days.map(({ day, classes }) => (
        <div key={day} className="mb-3">
          <DayCard day={day} classes={classes} />
        </div>
      ))}

      <p
        className="mt-[6px] mb-0 text-center text-[11px]"
        style={{ color: colors.textMuted }}
      >
        Horarios del calendario 2026B. Verifica cambios con tu coordinación.
      </p>
    </>
  );
}

function DayCard({ day, classes }) {
  return (
    <Card>
      <div className="px-4 pt-[14px] pb-[10px]">
        <span className="text-[15px]" style={{ fontWeight: 900, color: colors.blue }}>
          {day}
        </span>
      </div>
      {classes.map((session, index) => (
        <div key={`${session.start}-${session.subject}-${index}`}>
          <Divider />
          <div className="flex items-start px-4 py-3">
            <div className="w-[54px] shrink-0">
              <div className="text-[13px] font-extrabold">{session.start}</div>
              <div className="text-xs" style={{ color: colors.textMuted }}>
                {session.end}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold" style={{ lineHeight: 1.25 }}>
                {session.subject}
              </div>
              <div className="mt-[3px] text-xs font-bold" style={{ color: colors.crimson }}>
                {session.room}
              </div>
              <div
                className="mt-[2px]"
                style={{ fontSize: 11.5, color: colors.textSecondary, lineHeight: 1.25 }}
              >
                {session.teacher}
              </div>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}
