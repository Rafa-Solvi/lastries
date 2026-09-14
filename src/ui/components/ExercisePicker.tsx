// Buscador de ejercicios por nombre actual o nombre original en inglés (FR-025).
import { useMemo, useState } from "preact/hooks";
import { useAppState } from "../../data/store.ts";
import type { Exercise, Id } from "../../domain/types.ts";
import { normalizeName } from "../../domain/validation.ts";
import { DemoImage } from "./DemoImage.tsx";

export function matchesExercise(e: Exercise, query: string): boolean {
  const q = normalizeName(query);
  if (q === "") return true;
  return normalizeName(e.name).includes(q) || (e.originalName !== null && normalizeName(e.originalName).includes(q));
}

export function muscleNames(ids: Id[], groups: { id: Id; name: string }[]): string {
  return ids.map((id) => groups.find((g) => g.id === id)?.name ?? "?").join(", ");
}

interface Props {
  onPick: (exercise: Exercise) => void;
  onCancel?: () => void;
  limit?: number;
}

export function ExercisePicker({ onPick, onCancel, limit = 40 }: Props) {
  const exercises = useAppState((s) => s.exercises);
  const groups = useAppState((s) => s.muscleGroups);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const list = exercises.filter((e) => !e.archived && matchesExercise(e, query));
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list.slice(0, limit);
  }, [exercises, query, limit]);

  return (
    <div class="card stack">
      <div class="row-nowrap">
        <input
          type="search"
          placeholder="Buscar ejercicio (español o inglés)"
          value={query}
          autoFocus
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cerrar
          </button>
        )}
      </div>
      <ul class="list">
        {results.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              class="link"
              style={{ width: "100%", justifyContent: "flex-start", textAlign: "left", gap: "10px", padding: 0 }}
              onClick={() => onPick(e)}
            >
              {e.demos[0] ? <DemoImage demo={e.demos[0]} className="thumb" /> : <div class="thumb" />}
              <span>
                <span style={{ color: "var(--text)" }}>{e.name}</span>
                <br />
                <span class="muted">{muscleNames(e.primaryMuscleIds, groups)}</span>
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li class="muted">Sin resultados</li>}
      </ul>
    </div>
  );
}
