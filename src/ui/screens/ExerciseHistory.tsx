// Historial de un ejercicio: series por fecha y evolución de series efectivas (FR-007, FR-022).
import { useState } from "preact/hooks";
import { deleteSet, updateSet } from "../../data/actions/training.ts";
import { useAppState } from "../../data/store.ts";
import { formatLong } from "../../domain/dates.ts";
import { exerciseProgress } from "../../domain/volume.ts";
import { formatNumber } from "../../domain/validation.ts";
import { LineChart } from "../components/LineChart.tsx";
import { SetEditor, type EditableSet } from "../components/SetEditor.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { SetLine } from "./Session.tsx";

export function ExerciseHistory({ params }: { params: Record<string, string> }) {
  const exerciseId = params.exerciseId!;
  const exercise = useAppState((s) => s.exercises.find((e) => e.id === exerciseId));
  const sessions = useAppState((s) => s.sessions);
  const [editing, setEditing] = useState<{ key: string; value: EditableSet } | null>(null);
  const { run, error } = useAction();

  const { points, best } = exerciseProgress(sessions, exerciseId);
  const withExercise = sessions
    .filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId && e.sets.length > 0))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  return (
    <div>
      <TopBar title={exercise?.name ?? "Historial"} fallback={`/exercises/${exerciseId}`} />
      {points.length === 0 ? (
        <p class="muted card">Todavía no hay series efectivas de este ejercicio.</p>
      ) : (
        <>
          <section class="card stack">
            <h2>Evolución</h2>
            <p class="muted">Por sesión, la serie efectiva de más peso. Sin calentamientos.</p>
            {best && (
              <p>
                Mejor serie: {formatNumber(best.weightKg, 2)} kg × {best.reps} ({formatLong(best.date)})
              </p>
            )}
            <h3>Peso (kg)</h3>
            <LineChart series={[{ label: "Peso", points: points.map((p) => ({ date: p.date, value: p.weightKg })) }]} />
            <h3>Repeticiones</h3>
            <LineChart decimals={0} series={[{ label: "Repeticiones", points: points.map((p) => ({ date: p.date, value: p.reps })) }]} />
          </section>
        </>
      )}
      {withExercise.map((s) => (
        <section key={s.id} class="card stack">
          <div class="spread">
            <strong>{formatLong(s.date)}</strong>
            <span class="muted">{s.routineName ?? "Sesión libre"}</span>
          </div>
          {s.exercises.map((e, ei) =>
            e.exerciseId !== exerciseId ? null : (
              <ul key={ei} class="list">
                {e.sets.map((w, k) => {
                  const key = `${s.id}:${ei}:${k}`;
                  return editing?.key === key ? (
                    <li key={key} class="stack">
                      <SetEditor value={editing.value} onChange={(v) => setEditing({ key, value: v })} />
                      <div class="row">
                        <button
                          type="button"
                          class="primary"
                          onClick={() =>
                            void run(async () => {
                              await updateSet(s.id, ei, k, editing.value);
                              setEditing(null);
                            })
                          }
                        >
                          Guardar
                        </button>
                        <button type="button" onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void run(async () => {
                              await deleteSet(s.id, ei, k);
                              setEditing(null);
                            })
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={key} class="spread">
                      <SetLine set={w} index={k} />
                      <button type="button" onClick={() => setEditing({ key, value: { ...w } })}>
                        Editar
                      </button>
                    </li>
                  );
                })}
              </ul>
            ),
          )}
        </section>
      ))}
      {error && <p class="field-error">{error}</p>}
    </div>
  );
}
