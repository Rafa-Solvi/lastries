// Catálogo de ejercicios y grupos musculares (FR-010 – FR-013, FR-025).
import { useMemo, useState } from "preact/hooks";
import {
  createExercise,
  createMuscleGroup,
  deleteExercise,
  deleteMuscleGroup,
  renameMuscleGroup,
  setExerciseArchived,
  updateExercise,
  type ExerciseInput,
} from "../../data/actions/training.ts";
import { ACCEPTED_MEDIA, addMedia, removeMediaIfOrphan } from "../../data/media.ts";
import { useAppState } from "../../data/store.ts";
import type { DemoRef, Exercise, Id } from "../../domain/types.ts";
import { DemoImage } from "../components/DemoImage.tsx";
import { matchesExercise, muscleNames } from "../components/ExercisePicker.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { navigate } from "../router.ts";

const PAGE = 60;

export function Exercises() {
  const exercises = useAppState((s) => s.exercises);
  const groups = useAppState((s) => s.muscleGroups);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Id | "">("");
  const [showArchived, setShowArchived] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [showGroups, setShowGroups] = useState(false);

  const list = useMemo(() => {
    const l = exercises.filter(
      (e) =>
        e.archived === showArchived &&
        matchesExercise(e, query) &&
        (group === "" || e.primaryMuscleIds.includes(group) || e.secondaryMuscleIds.includes(group)),
    );
    l.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return l;
  }, [exercises, query, group, showArchived]);

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div>
      <TopBar title="Ejercicios">
        <a class="btn primary" href="#/exercises/new">
          Nuevo
        </a>
      </TopBar>
      <div class="card stack">
        <input
          type="search"
          placeholder="Buscar (español o inglés)"
          value={query}
          onInput={(e) => {
            setQuery((e.currentTarget as HTMLInputElement).value);
            setLimit(PAGE);
          }}
        />
        <div class="row-nowrap">
          <select value={group} onChange={(e) => setGroup((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">Todos los grupos</option>
            {sortedGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <label class="row-nowrap" style={{ whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={showArchived} onChange={() => setShowArchived(!showArchived)} />
            Archivados
          </label>
        </div>
        <p class="muted">{list.length} ejercicios</p>
      </div>

      <ul class="list card">
        {list.slice(0, limit).map((e) => (
          <li key={e.id}>
            <a href={`#/exercises/${e.id}`} class="row-nowrap" style={{ textDecoration: "none", color: "inherit" }}>
              {e.demos[0] ? <DemoImage demo={e.demos[0]} className="thumb" /> : <div class="thumb" />}
              <span>
                {e.name}
                <br />
                <span class="muted">
                  {muscleNames(e.primaryMuscleIds, groups)}
                  {e.equipment ? ` · ${e.equipment}` : ""}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {list.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)} style={{ width: "100%" }}>
          Ver más
        </button>
      )}

      <div class="card stack" style={{ marginTop: "12px" }}>
        <div class="spread">
          <h2>Grupos musculares</h2>
          <button type="button" onClick={() => setShowGroups(!showGroups)}>
            {showGroups ? "Ocultar" : "Editar"}
          </button>
        </div>
        {showGroups && <MuscleGroupsEditor />}
      </div>
    </div>
  );
}

function MuscleGroupsEditor() {
  const groups = useAppState((s) => s.muscleGroups);
  const { run, error } = useAction();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: Id; name: string } | null>(null);
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return (
    <div class="stack">
      {error && <p class="field-error">{error}</p>}
      <ul class="list">
        {sorted.map((g) => (
          <li key={g.id} class="spread">
            {editing?.id === g.id ? (
              <>
                <input value={editing.name} onInput={(e) => setEditing({ id: g.id, name: (e.currentTarget as HTMLInputElement).value })} />
                <button type="button" onClick={() => void run(() => renameMuscleGroup(g.id, editing.name)).then(() => setEditing(null))}>
                  Guardar
                </button>
              </>
            ) : (
              <>
                <span>{g.name}</span>
                <span class="row-nowrap">
                  <button type="button" onClick={() => setEditing({ id: g.id, name: g.name })}>
                    Renombrar
                  </button>
                  <button type="button" onClick={() => void run(() => deleteMuscleGroup(g.id))}>
                    Eliminar
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <div class="row-nowrap">
        <input placeholder="Nuevo grupo" value={newName} onInput={(e) => setNewName((e.currentTarget as HTMLInputElement).value)} />
        <button type="button" onClick={() => void run(() => createMuscleGroup(newName)).then((g) => g && setNewName(""))}>
          Añadir
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalle / edición

export function ExerciseDetail({ params }: { params: Record<string, string> }) {
  const id = params.id!;
  const exercise = useAppState((s) => s.exercises.find((e) => e.id === id) ?? null);
  const groups = useAppState((s) => s.muscleGroups);
  const [editing, setEditing] = useState(id === "new");
  const { run, error } = useAction();

  if (id !== "new" && !exercise) {
    return (
      <div>
        <TopBar title="Ejercicio" fallback="/exercises" />
        <p class="muted">No encontrado.</p>
      </div>
    );
  }

  if (editing || !exercise) {
    return (
      <div>
        <TopBar title={exercise ? "Editar ejercicio" : "Nuevo ejercicio"} fallback="/exercises" />
        <ExerciseForm
          exercise={exercise}
          onDone={(saved) => {
            if (!exercise) navigate(`/exercises/${saved.id}`);
            else setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <TopBar title={exercise.name} fallback="/exercises" />
      <div class="card stack">
        {exercise.originalName && exercise.originalName !== exercise.name && (
          <p class="muted">Nombre original: {exercise.originalName}</p>
        )}
        <p>
          <strong>Primarios:</strong> {muscleNames(exercise.primaryMuscleIds, groups)}
        </p>
        <p>
          <strong>Secundarios:</strong> {muscleNames(exercise.secondaryMuscleIds, groups) || "—"}
        </p>
        <p>
          <strong>Equipamiento:</strong> {exercise.equipment ?? "—"}
        </p>
        {exercise.archived && <p class="chip">Archivado</p>}
      </div>
      {exercise.demos.length > 0 ? (
        <div class="card stack">
          {exercise.demos.map((d, i) => (
            <DemoImage key={i} demo={d} className="demo-img" alt={`${exercise.name} ${i + 1}`} />
          ))}
        </div>
      ) : (
        <p class="muted card">Sin demostración.</p>
      )}
      {error && <p class="field-error">{error}</p>}
      <div class="row">
        <button type="button" class="primary" onClick={() => setEditing(true)}>
          Editar
        </button>
        <a class="btn" href={`#/history/${exercise.id}`}>
          Historial
        </a>
        <button type="button" onClick={() => void run(() => setExerciseArchived(exercise.id, !exercise.archived))}>
          {exercise.archived ? "Desarchivar" : "Archivar"}
        </button>
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              await deleteExercise(exercise.id);
              navigate("/exercises");
            })
          }
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function ExerciseForm({ exercise, onDone }: { exercise: Exercise | null; onDone: (e: Exercise | { id: Id }) => void }) {
  const groups = useAppState((s) => s.muscleGroups);
  const { run, error } = useAction();
  const [name, setName] = useState(exercise?.name ?? "");
  const [primary, setPrimary] = useState<Id[]>(exercise?.primaryMuscleIds ?? []);
  const [secondary, setSecondary] = useState<Id[]>(exercise?.secondaryMuscleIds ?? []);
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [demos, setDemos] = useState<DemoRef[]>(exercise?.demos ?? []);
  const [removedMedia, setRemovedMedia] = useState<Id[]>([]);
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, "es"));

  const togglePrimary = (id: Id) => {
    setPrimary(primary.includes(id) ? primary.filter((x) => x !== id) : [...primary, id]);
    setSecondary(secondary.filter((x) => x !== id));
  };
  const toggleSecondary = (id: Id) => {
    if (primary.includes(id)) return;
    setSecondary(secondary.includes(id) ? secondary.filter((x) => x !== id) : [...secondary, id]);
  };

  const onFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    void run(async () => {
      const added: DemoRef[] = [];
      for (const f of files) {
        const m = await addMedia(f);
        added.push({ kind: "media", mediaId: m.id });
      }
      setDemos((d) => [...d, ...added]);
    });
  };

  const moveDemo = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= demos.length) return;
    const next = demos.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    setDemos(next);
  };

  const removeDemo = (i: number) => {
    const d = demos[i]!;
    if (d.kind === "media") setRemovedMedia([...removedMedia, d.mediaId]);
    setDemos(demos.filter((_, k) => k !== i));
  };

  const save = () =>
    void run(async () => {
      const input: ExerciseInput = { name, primaryMuscleIds: primary, secondaryMuscleIds: secondary, equipment: equipment || null, demos };
      let saved: { id: Id };
      if (exercise) {
        await updateExercise(exercise.id, input);
        saved = exercise;
      } else {
        saved = await createExercise(input);
      }
      for (const m of removedMedia) await removeMediaIfOrphan(m);
      onDone(saved);
    });

  return (
    <div class="stack">
      <div class="card stack">
        <label>
          Nombre
          <input value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} maxLength={120} />
        </label>
        <label>
          Equipamiento
          <input value={equipment} onInput={(e) => setEquipment((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <div class="card stack">
        <h3>Grupos primarios (al menos 1)</h3>
        <div class="row">
          {sorted.map((g) => (
            <button key={g.id} type="button" class={primary.includes(g.id) ? "selected" : undefined} onClick={() => togglePrimary(g.id)}>
              {g.name}
            </button>
          ))}
        </div>
        <h3>Grupos secundarios</h3>
        <div class="row">
          {sorted
            .filter((g) => !primary.includes(g.id))
            .map((g) => (
              <button key={g.id} type="button" class={secondary.includes(g.id) ? "selected" : undefined} onClick={() => toggleSecondary(g.id)}>
                {g.name}
              </button>
            ))}
        </div>
      </div>
      <div class="card stack">
        <h3>Demostración</h3>
        {demos.map((d, i) => (
          <div key={i} class="row-nowrap">
            <DemoImage demo={d} className="thumb" />
            <button type="button" onClick={() => moveDemo(i, -1)} aria-label="Subir">
              ↑
            </button>
            <button type="button" onClick={() => moveDemo(i, 1)} aria-label="Bajar">
              ↓
            </button>
            <button type="button" onClick={() => removeDemo(i)}>
              Quitar
            </button>
          </div>
        ))}
        <label class="btn">
          Añadir imagen o GIF
          <input type="file" accept={ACCEPTED_MEDIA} multiple onChange={onFile} style={{ display: "none" }} />
        </label>
      </div>
      {error && <p class="field-error">{error}</p>}
      <button type="button" class="primary" onClick={save}>
        Guardar
      </button>
    </div>
  );
}
