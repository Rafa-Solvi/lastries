// Pantalla principal. Orden de secciones: contracts/logging-flows.md
// (sesión, hoy planificado, frecuentes, ayer, resumen, navegación).
import { addConsumption, refName, repeatMoment, yesterday } from "../../data/actions/food.ts";
import { markPlannedEaten } from "../../data/actions/planning.ts";
import { confirmSet, startEmptySession, startSessionFromRoutine, validateSetValues } from "../../data/actions/training.ts";
import { timeLocal, todayLocal, useAppState } from "../../data/store.ts";
import { frequents } from "../../domain/frequents.ts";
import { momentAt, sortMoments } from "../../domain/mealMoment.ts";
import { refKey } from "../../domain/nutrition.ts";
import { currentExerciseIndex, lastTime, pendingForSession } from "../../domain/prefill.ts";
import type { FoodRef, Routine, Session } from "../../domain/types.ts";
import { DaySummary } from "../components/DaySummary.tsx";
import { useAction } from "../components/useAction.ts";
import { formatRefQuantity } from "../format.ts";
import { SetLine } from "./Session.tsx";

function recentRoutines(routines: Routine[], sessions: Session[], n: number): Routine[] {
  const lastUse = new Map<string, string>();
  for (const s of sessions) {
    if (s.routineId && (lastUse.get(s.routineId) ?? "") < s.startedAt) lastUse.set(s.routineId, s.startedAt);
  }
  return [...routines]
    .sort((a, b) => {
      const la = lastUse.get(a.id) ?? "";
      const lb = lastUse.get(b.id) ?? "";
      return la === lb ? a.name.localeCompare(b.name, "es") : la < lb ? 1 : -1;
    })
    .slice(0, n);
}

function SessionSection() {
  const sessions = useAppState((s) => s.sessions);
  const routines = useAppState((s) => s.routines);
  const exercises = useAppState((s) => s.exercises);
  const { run, error } = useAction();
  const session = sessions.find((s) => s.endedAt === null) ?? null;

  if (!session) {
    const recent = recentRoutines(routines, sessions, 3);
    return (
      <section class="card stack">
        <h2>Entrenamiento</h2>
        <div class="row">
          {recent.map((r) => (
            <button key={r.id} type="button" class="primary" onClick={() => void run(() => startSessionFromRoutine(r.id))}>
              Iniciar {r.name}
            </button>
          ))}
          <button type="button" onClick={() => void run(() => startEmptySession())}>
            Iniciar sesión vacía
          </button>
        </div>
        {error && <p class="field-error">{error}</p>}
      </section>
    );
  }

  const pending = pendingForSession(sessions, session);
  const idx = currentExerciseIndex(session, pending.map((p) => p.length));
  const entry = idx >= 0 ? session.exercises[idx]! : null;
  const next = idx >= 0 ? pending[idx]![0]! : null;
  const exercise = entry ? exercises.find((e) => e.id === entry.exerciseId) : null;
  const last = entry ? lastTime(sessions, entry.exerciseId, session.id) : null;
  const invalid = next ? validateSetValues(next) : null;

  return (
    <section class="card stack">
      <div class="spread">
        <h2>{session.routineName ?? "Sesión libre"}</h2>
        <a class="btn" href="#/session">
          Abrir sesión
        </a>
      </div>
      {entry && next ? (
        <>
          <div>
            <strong>{exercise?.name ?? "?"}</strong>
            <div class="muted">
              Última vez:{" "}
              {last ? last.filter((w) => !w.warmup).map((w, i) => <span key={i}>{i > 0 && " · "}{formatCompact(w)}</span>) : "sin registro previo"}
            </div>
          </div>
          <div class="spread">
            <span>
              Serie {entry.sets.length + 1}: <SetLine set={next} />
            </span>
            {next.isDraft && <span class="draft-mark">sin confirmar</span>}
          </div>
          <button
            type="button"
            class="primary"
            disabled={invalid !== null}
            onClick={() => {
              const { isDraft: _d, ...values } = next;
              void run(() => confirmSet(session.id, idx, values));
            }}
          >
            Confirmar
          </button>
          {invalid && <p class="muted">{invalid}: ábrela en la sesión para completarla.</p>}
        </>
      ) : (
        <p class="muted">No quedan series pendientes. Añade series o ejercicios en la sesión.</p>
      )}
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}

function formatCompact(w: { weightKg: number; reps: number }) {
  return `${String(w.weightKg).replace(".", ",")}×${w.reps}`;
}

function PlannedTodaySection() {
  const planned = useAppState((s) => s.plannedItems);
  const consumptions = useAppState((s) => s.consumptions);
  const moments = useAppState((s) => s.mealMoments);
  const ingredients = useAppState((s) => s.ingredients);
  const { run, error } = useAction();
  const today = todayLocal();
  const order = new Map(sortMoments(moments).map((m, i) => [m.id, i]));
  const items = planned
    .filter((p) => p.date === today)
    .sort(
      (a, b) =>
        (order.get(a.momentId) ?? 0) - (order.get(b.momentId) ?? 0) || refName(a.ref).localeCompare(refName(b.ref), "es"),
    );
  if (items.length === 0) return null;

  return (
    <section class="card stack">
      <div class="spread">
        <h2>Hoy planificado</h2>
        <a class="btn" href="#/plan">
          Plan
        </a>
      </div>
      <ul class="list">
        {items.map((p) => {
          const eaten = consumptions.some((c) => c.plannedItemId === p.id);
          return (
            <li key={p.id} class="spread">
              <span>
                {refName(p.ref)}
                <br />
                <span class="muted">
                  {moments.find((m) => m.id === p.momentId)?.name} · {formatRefQuantity(p.ref, ingredients)}
                  {eaten && " · comido"}
                </span>
              </span>
              {!eaten && (
                <button type="button" class="primary" onClick={() => void run(() => markPlannedEaten(p.id))}>
                  Comido
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}

function FrequentsSection() {
  const moments = useAppState((s) => s.mealMoments);
  const consumptions = useAppState((s) => s.consumptions);
  const ingredients = useAppState((s) => s.ingredients);
  const recipes = useAppState((s) => s.recipes);
  const { run, error } = useAction();
  if (moments.length === 0) return null;
  const moment = momentAt(moments, timeLocal());
  const archived = (ref: FoodRef) =>
    ref.type === "ingredient"
      ? (ingredients.find((i) => i.id === ref.ingredientId)?.archived ?? true)
      : (recipes.find((r) => r.id === ref.recipeId)?.archived ?? true);
  const list = frequents(consumptions, moment.id, todayLocal(), archived);

  return (
    <section class="card stack">
      <div class="spread">
        <h2>Frecuentes — {moment.name}</h2>
        <a class="btn" href={`#/day/${todayLocal()}`}>
          Registrar
        </a>
      </div>
      {list.length === 0 ? (
        <p class="muted">Aún no hay frecuentes para este momento.</p>
      ) : (
        <ul class="list">
          {list.map((f) => (
            <li key={refKey(f.ref)} class="spread">
              <span>
                {refName(f.ref)}
                <br />
                <span class="muted">{formatRefQuantity(f.ref, ingredients)}</span>
              </span>
              <button type="button" class="primary" aria-label={`Registrar ${refName(f.ref)}`} onClick={() => void run(() => addConsumption({ ref: f.ref }))}>
                +
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}

function YesterdaySection() {
  const moments = useAppState((s) => s.mealMoments);
  const consumptions = useAppState((s) => s.consumptions);
  const { run, error } = useAction();
  const y = yesterday();
  const withData = sortMoments(moments).filter((m) => consumptions.some((c) => c.date === y && c.momentId === m.id));
  if (withData.length === 0) return null;
  return (
    <section class="card stack">
      <h2>Ayer</h2>
      <div class="row">
        {withData.map((m) => (
          <button key={m.id} type="button" onClick={() => void run(() => repeatMoment(y, m.id))}>
            Repetir {m.name.toLowerCase()}
          </button>
        ))}
      </div>
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}

function SummarySection() {
  return (
    <section class="card">
      <div class="spread">
        <h2>Hoy</h2>
        <a class="btn" href={`#/day/${todayLocal()}`}>
          Ver día
        </a>
      </div>
      <DaySummary date={todayLocal()} />
    </section>
  );
}

function Navigation() {
  return (
    <nav class="card">
      <div class="nav">
        <a class="btn" href="#/routines">
          Rutinas
        </a>
        <a class="btn" href="#/exercises">
          Ejercicios
        </a>
        <a class="btn" href="#/volume">
          Volumen
        </a>
        <a class="btn" href={`#/day/${todayLocal()}`}>
          Comidas
        </a>
        <a class="btn" href="#/ingredients">
          Ingredientes
        </a>
        <a class="btn" href="#/recipes">
          Recetas
        </a>
        <a class="btn" href="#/plan">
          Plan
        </a>
        <a class="btn" href="#/shopping">
          Compra
        </a>
        <a class="btn" href="#/progress">
          Progreso
        </a>
        <a class="btn" href="#/settings">
          Ajustes
        </a>
      </div>
    </nav>
  );
}

export function Home() {
  return (
    <div>
      <SessionSection />
      <PlannedTodaySection />
      <FrequentsSection />
      <YesterdaySection />
      <SummarySection />
      <Navigation />
    </div>
  );
}
