// Series efectivas por grupo muscular y semana (FR-023, FR-024). Sin objetivos ni valoración.
import { useMemo, useState } from "preact/hooks";
import { todayLocal, useAppState } from "../../data/store.ts";
import { addDays, formatShort } from "../../domain/dates.ts";
import { formatNumber } from "../../domain/validation.ts";
import { weeklyVolume, weekStart } from "../../domain/volume.ts";
import { TopBar } from "../components/TopBar.tsx";

export function WeeklyVolume() {
  const sessions = useAppState((s) => s.sessions);
  const exercises = useAppState((s) => s.exercises);
  const groups = useAppState((s) => s.muscleGroups);
  const [week, setWeek] = useState(weekStart(todayLocal()));

  const rows = useMemo(() => {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const v = weeklyVolume(sessions, byId, week);
    return [...v.entries()]
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ name: groups.find((g) => g.id === id)?.name ?? "?", n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "es"));
  }, [sessions, exercises, groups, week]);

  const isCurrent = week === weekStart(todayLocal());

  return (
    <div>
      <TopBar title="Volumen semanal" />
      <div class="card stack">
        <div class="spread">
          <button type="button" onClick={() => setWeek(addDays(week, -7))} aria-label="Semana anterior">
            ←
          </button>
          <strong>
            {formatShort(week)} – {formatShort(addDays(week, 6))}
          </strong>
          <button type="button" onClick={() => setWeek(addDays(week, 7))} aria-label="Semana siguiente">
            →
          </button>
        </div>
        {!isCurrent && (
          <button type="button" onClick={() => setWeek(weekStart(todayLocal()))}>
            Semana actual
          </button>
        )}
        <p class="muted">Series efectivas: 1 por grupo primario y 0,5 por grupo secundario. Sin calentamientos.</p>
      </div>
      <div class="card">
        {rows.length === 0 ? (
          <p class="muted">Sin series efectivas esta semana.</p>
        ) : (
          <table class="data">
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td class="num">{formatNumber(r.n, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
