// Rutinas (FR-014, FR-015).
import { useState } from "preact/hooks";
import {
  activeSession,
  deleteRoutine,
  saveRoutine,
  startSessionFromRoutine,
  validateRoutineItem,
} from "../../data/actions/training.ts";
import { useAppState } from "../../data/store.ts";
import type { Routine, RoutineItem } from "../../domain/types.ts";
import { ExercisePicker } from "../components/ExercisePicker.tsx";
import { NumberField } from "../components/NumberField.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { navigate } from "../router.ts";

export function Routines() {
  const routines = useAppState((s) => s.routines);
  const hasActive = useAppState((s) => s.sessions.some((x) => x.endedAt === null));
  const exercises = useAppState((s) => s.exercises);
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  const { run, error } = useAction();

  if (editing) {
    return (
      <div>
        <TopBar title={editing === "new" ? "Nueva rutina" : "Editar rutina"} fallback="/routines" />
        <RoutineEditor routine={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      </div>
    );
  }

  const sorted = [...routines].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return (
    <div>
      <TopBar title="Rutinas">
        <button type="button" class="primary" onClick={() => setEditing("new")}>
          Nueva
        </button>
      </TopBar>
      {error && <p class="field-error">{error}</p>}
      {sorted.length === 0 && <p class="muted card">Todavía no hay rutinas.</p>}
      {sorted.map((r) => (
        <div key={r.id} class="card stack">
          <div class="spread">
            <h2>{r.name}</h2>
            <button type="button" onClick={() => setEditing(r)}>
              Editar
            </button>
          </div>
          <ul class="list">
            {r.items.map((it, i) => (
              <li key={i} class="spread">
                <span>{exercises.find((e) => e.id === it.exerciseId)?.name ?? "?"}</span>
                <span class="muted num">
                  {it.targetSets} × {it.repsMin}–{it.repsMax} @ {it.targetRir}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            class="primary"
            disabled={hasActive}
            onClick={() =>
              void run(async () => {
                await startSessionFromRoutine(r.id);
                navigate("/session");
              })
            }
          >
            Iniciar sesión
          </button>
        </div>
      ))}
      {hasActive && activeSession() && (
        <p class="muted">
          Hay una sesión en curso. <a href="#/session">Abrir sesión</a>
        </p>
      )}
    </div>
  );
}

function RoutineEditor({ routine, onDone }: { routine: Routine | null; onDone: () => void }) {
  const exercises = useAppState((s) => s.exercises);
  const [name, setName] = useState(routine?.name ?? "");
  const [items, setItems] = useState<RoutineItem[]>(routine?.items ?? []);
  const [picking, setPicking] = useState(false);
  const { run, error } = useAction();

  const update = (i: number, patch: Partial<RoutineItem>) =>
    setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    setItems(next);
  };

  const intField = (label: string, value: number, onValue: (n: number) => void) => (
    <NumberField label={label} integer value={value} onValue={(v) => v !== null && onValue(v)} />
  );

  return (
    <div class="stack">
      <div class="card">
        <label>
          Nombre
          <input value={name} maxLength={60} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      {items.map((it, i) => {
        const err = validateRoutineItem(it);
        return (
          <div key={i} class="card stack">
            <div class="spread">
              <strong>{exercises.find((e) => e.id === it.exerciseId)?.name ?? "?"}</strong>
              <span class="row-nowrap">
                <button type="button" onClick={() => move(i, -1)} aria-label="Subir">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} aria-label="Bajar">
                  ↓
                </button>
                <button type="button" onClick={() => setItems(items.filter((_, k) => k !== i))}>
                  Quitar
                </button>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              {intField("Series", it.targetSets, (n) => update(i, { targetSets: n }))}
              {intField("Rep. mín", it.repsMin, (n) => update(i, { repsMin: n }))}
              {intField("Rep. máx", it.repsMax, (n) => update(i, { repsMax: n }))}
              {intField("RIR", it.targetRir, (n) => update(i, { targetRir: n }))}
            </div>
            {err && <p class="field-error">{err}</p>}
          </div>
        );
      })}
      {picking ? (
        <ExercisePicker
          onCancel={() => setPicking(false)}
          onPick={(e) => {
            setItems([...items, { exerciseId: e.id, targetSets: 3, repsMin: 8, repsMax: 12, targetRir: 2 }]);
            setPicking(false);
          }}
        />
      ) : (
        <button type="button" onClick={() => setPicking(true)}>
          Añadir ejercicio
        </button>
      )}
      {error && <p class="field-error">{error}</p>}
      <div class="row">
        <button
          type="button"
          class="primary"
          onClick={() =>
            void run(async () => {
              await saveRoutine({ id: routine?.id ?? null, name, items });
              onDone();
            })
          }
        >
          Guardar
        </button>
        <button type="button" onClick={onDone}>
          Cancelar
        </button>
        {routine && (
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await deleteRoutine(routine.id);
                onDone();
              })
            }
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
