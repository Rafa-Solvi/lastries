// Acciones de entrenamiento: grupos musculares, ejercicios, rutinas y sesiones.
import type {
  DraftSet,
  Exercise,
  Id,
  MuscleGroup,
  Routine,
  RoutineItem,
  Session,
  SessionExercise,
  WorkSet,
} from "../../domain/types.ts";
import {
  isIntInRange,
  isNameOfLength,
  isReps,
  isRir,
  isWeightKg,
  normalizeName,
} from "../../domain/validation.ts";
import {
  ActionError,
  clearUndo,
  commit,
  getState,
  newId,
  nowLocal,
  removeWhere,
  setUndo,
  todayLocal,
  upsert,
} from "../store.ts";

const byId = <T extends { id: Id }>(x: T) => x.id;

// ---------------------------------------------------------------------------
// Grupos musculares

function assertMuscleGroupName(name: string, exceptId: Id | null) {
  if (!isNameOfLength(name, 1, 60)) throw new ActionError("El nombre debe tener entre 1 y 60 caracteres");
  const n = normalizeName(name);
  if (getState().muscleGroups.some((g) => g.id !== exceptId && normalizeName(g.name) === n)) {
    throw new ActionError("Ya existe un grupo muscular con ese nombre");
  }
}

export async function createMuscleGroup(name: string): Promise<MuscleGroup> {
  assertMuscleGroupName(name, null);
  const g: MuscleGroup = { id: newId(), name: name.trim(), baseKey: null };
  await commit(["muscleGroups"], (tx) => tx.objectStore("muscleGroups").put(g).then(() => {}), (s) => ({
    ...s,
    muscleGroups: [...s.muscleGroups, g],
  }));
  return g;
}

export async function renameMuscleGroup(id: Id, name: string): Promise<void> {
  assertMuscleGroupName(name, id);
  const g = getState().muscleGroups.find((x) => x.id === id);
  if (!g) throw new ActionError("Grupo muscular no encontrado");
  const next = { ...g, name: name.trim() };
  await commit(["muscleGroups"], (tx) => tx.objectStore("muscleGroups").put(next).then(() => {}), (s) => ({
    ...s,
    muscleGroups: upsert(s.muscleGroups, next, byId),
  }));
}

export async function deleteMuscleGroup(id: Id): Promise<void> {
  const used = getState().exercises.some((e) => e.primaryMuscleIds.includes(id) || e.secondaryMuscleIds.includes(id));
  if (used) throw new ActionError("No se puede eliminar: algún ejercicio usa este grupo muscular");
  await commit(["muscleGroups"], (tx) => tx.objectStore("muscleGroups").delete(id), (s) => ({
    ...s,
    muscleGroups: removeWhere(s.muscleGroups, (g) => g.id === id),
  }));
}

// ---------------------------------------------------------------------------
// Ejercicios

export interface ExerciseInput {
  name: string;
  primaryMuscleIds: Id[];
  secondaryMuscleIds: Id[];
  equipment: string | null;
  demos: Exercise["demos"];
}

function validateExerciseInput(input: ExerciseInput) {
  if (!isNameOfLength(input.name, 1, 120)) throw new ActionError("El nombre debe tener entre 1 y 120 caracteres");
  if (input.primaryMuscleIds.length < 1) throw new ActionError("Elige al menos un grupo muscular primario");
  if (new Set(input.primaryMuscleIds).size !== input.primaryMuscleIds.length)
    throw new ActionError("Hay grupos primarios repetidos");
  if (new Set(input.secondaryMuscleIds).size !== input.secondaryMuscleIds.length)
    throw new ActionError("Hay grupos secundarios repetidos");
  if (input.secondaryMuscleIds.some((id) => input.primaryMuscleIds.includes(id)))
    throw new ActionError("Un grupo no puede ser primario y secundario a la vez");
  const groups = new Set(getState().muscleGroups.map((g) => g.id));
  if ([...input.primaryMuscleIds, ...input.secondaryMuscleIds].some((id) => !groups.has(id)))
    throw new ActionError("Grupo muscular inexistente");
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  validateExerciseInput(input);
  const ex: Exercise = {
    id: newId(),
    source: "user",
    baseId: null,
    originalName: null,
    name: input.name.trim(),
    primaryMuscleIds: input.primaryMuscleIds,
    secondaryMuscleIds: input.secondaryMuscleIds,
    equipment: input.equipment?.trim() || null,
    demos: input.demos,
    archived: false,
  };
  await putExercise(ex);
  return ex;
}

/** originalName y baseId son inmutables. */
export async function updateExercise(id: Id, input: ExerciseInput): Promise<void> {
  validateExerciseInput(input);
  const old = getState().exercises.find((e) => e.id === id);
  if (!old) throw new ActionError("Ejercicio no encontrado");
  await putExercise({
    ...old,
    name: input.name.trim(),
    primaryMuscleIds: input.primaryMuscleIds,
    secondaryMuscleIds: input.secondaryMuscleIds,
    equipment: input.equipment?.trim() || null,
    demos: input.demos,
  });
}

async function putExercise(ex: Exercise) {
  await commit(["exercises"], (tx) => tx.objectStore("exercises").put(ex).then(() => {}), (s) => ({
    ...s,
    exercises: upsert(s.exercises, ex, byId),
  }));
}

export async function setExerciseArchived(id: Id, archived: boolean): Promise<void> {
  const old = getState().exercises.find((e) => e.id === id);
  if (!old) throw new ActionError("Ejercicio no encontrado");
  await putExercise({ ...old, archived });
}

export function isExerciseReferenced(id: Id): boolean {
  const s = getState();
  return (
    s.routines.some((r) => r.items.some((i) => i.exerciseId === id)) ||
    s.sessions.some((x) => x.exercises.some((e) => e.exerciseId === id))
  );
}

export async function deleteExercise(id: Id): Promise<void> {
  if (isExerciseReferenced(id)) {
    throw new ActionError("Este ejercicio aparece en rutinas o sesiones. Puedes archivarlo para ocultarlo sin perder el historial.");
  }
  await commit(["exercises"], (tx) => tx.objectStore("exercises").delete(id), (s) => ({
    ...s,
    exercises: removeWhere(s.exercises, (e) => e.id === id),
  }));
}

// ---------------------------------------------------------------------------
// Rutinas

export function validateRoutineItem(it: RoutineItem): string | null {
  if (!isIntInRange(it.targetSets, 1, 20)) return "Series objetivo: entero entre 1 y 20";
  if (!isIntInRange(it.repsMin, 1, 100)) return "Repeticiones mínimas: entero entre 1 y 100";
  if (!Number.isInteger(it.repsMax) || it.repsMax < it.repsMin || it.repsMax > 100)
    return "Repeticiones máximas: entre el mínimo y 100";
  if (!isIntInRange(it.targetRir, 0, 10)) return "RIR objetivo: entero entre 0 y 10";
  return null;
}

export async function saveRoutine(routine: { id: Id | null; name: string; items: RoutineItem[] }): Promise<Routine> {
  if (!isNameOfLength(routine.name, 1, 60)) throw new ActionError("El nombre debe tener entre 1 y 60 caracteres");
  const exercises = new Set(getState().exercises.map((e) => e.id));
  routine.items.forEach((it, i) => {
    if (!exercises.has(it.exerciseId)) throw new ActionError(`Ejercicio ${i + 1}: no existe`);
    const err = validateRoutineItem(it);
    if (err) throw new ActionError(`Ejercicio ${i + 1}: ${err}`);
  });
  const r: Routine = { id: routine.id ?? newId(), name: routine.name.trim(), items: routine.items };
  await commit(["routines"], (tx) => tx.objectStore("routines").put(r).then(() => {}), (s) => ({
    ...s,
    routines: upsert(s.routines, r, byId),
  }));
  return r;
}

export async function deleteRoutine(id: Id): Promise<void> {
  await commit(["routines"], (tx) => tx.objectStore("routines").delete(id), (s) => ({
    ...s,
    routines: removeWhere(s.routines, (r) => r.id === id),
  }));
}

// ---------------------------------------------------------------------------
// Sesiones

export function activeSession(): Session | null {
  return getState().sessions.find((s) => s.endedAt === null) ?? null;
}

async function putSession(session: Session) {
  await commit(["sessions"], (tx) => tx.objectStore("sessions").put(session).then(() => {}), (s) => ({
    ...s,
    sessions: upsert(s.sessions, session, byId),
  }));
}

function getSession(id: Id): Session {
  const s = getState().sessions.find((x) => x.id === id);
  if (!s) throw new ActionError("Sesión no encontrada");
  return s;
}

function withExercise(session: Session, index: number, fn: (e: SessionExercise) => SessionExercise): Session {
  const e = session.exercises[index];
  if (!e) throw new ActionError("Ejercicio de la sesión no encontrado");
  const exercises = session.exercises.slice();
  exercises[index] = fn(e);
  return { ...session, exercises };
}

export async function startSessionFromRoutine(routineId: Id): Promise<Session> {
  if (activeSession()) throw new ActionError("Ya hay una sesión en curso");
  const routine = getState().routines.find((r) => r.id === routineId);
  if (!routine) throw new ActionError("Rutina no encontrada");
  const now = nowLocal();
  const session: Session = {
    id: newId(),
    routineId: routine.id,
    routineName: routine.name,
    date: todayLocal(),
    startedAt: now,
    endedAt: null,
    exercises: routine.items.map(({ exerciseId, ...target }) => ({ exerciseId, target, sets: [], draft: null })),
  };
  await putSession(session);
  return session;
}

export async function startEmptySession(): Promise<Session> {
  if (activeSession()) throw new ActionError("Ya hay una sesión en curso");
  const session: Session = {
    id: newId(),
    routineId: null,
    routineName: null,
    date: todayLocal(),
    startedAt: nowLocal(),
    endedAt: null,
    exercises: [],
  };
  await putSession(session);
  return session;
}

export async function addSessionExercise(sessionId: Id, exerciseId: Id): Promise<void> {
  clearUndo();
  const s = getSession(sessionId);
  await putSession({ ...s, exercises: [...s.exercises, { exerciseId, target: null, sets: [], draft: null }] });
}

export async function removeSessionExercise(sessionId: Id, index: number): Promise<void> {
  clearUndo();
  const s = getSession(sessionId);
  await putSession({ ...s, exercises: s.exercises.filter((_, i) => i !== index) });
}

export async function moveSessionExercise(sessionId: Id, from: number, to: number): Promise<void> {
  clearUndo();
  const s = getSession(sessionId);
  if (to < 0 || to >= s.exercises.length) return;
  const exercises = s.exercises.slice();
  const [item] = exercises.splice(from, 1);
  exercises.splice(to, 0, item!);
  await putSession({ ...s, exercises });
}

export const setUndoScope = (sessionId: Id, exerciseIndex: number) => `set:${sessionId}:${exerciseIndex}`;

/** Guarda el borrador de la siguiente serie en cada cambio de campo (FR-021). */
export async function saveDraft(
  sessionId: Id,
  exerciseIndex: number,
  draft: Omit<DraftSet, "updatedAt">,
): Promise<void> {
  clearUndo(setUndoScope(sessionId, exerciseIndex));
  const s = getSession(sessionId);
  const next = withExercise(s, exerciseIndex, (e) => ({ ...e, draft: { ...draft, updatedAt: nowLocal() } }));
  await putSession(next);
}

export interface SetValues {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  failure: boolean;
  warmup: boolean;
}

export function validateSetValues(v: SetValues): string | null {
  if (v.weightKg === null) return "Falta el peso";
  if (!isWeightKg(v.weightKg)) return "Peso: número ≥ 0 con hasta 2 decimales";
  if (v.reps === null || !isReps(v.reps)) return "Repeticiones: entero ≥ 0";
  if (v.failure) return null;
  if (v.rir === null || !isRir(v.rir)) return "Elige el RIR";
  return null;
}

function toWorkSet(v: SetValues, confirmedAt: string): WorkSet {
  return {
    weightKg: v.weightKg!,
    reps: v.reps!,
    rir: v.failure ? 0 : v.rir!,
    failure: v.failure,
    warmup: v.warmup,
    confirmedAt,
  };
}

export async function confirmSet(sessionId: Id, exerciseIndex: number, values: SetValues): Promise<void> {
  const error = validateSetValues(values);
  if (error) throw new ActionError(error);
  const s = getSession(sessionId);
  const set = toWorkSet(values, nowLocal());
  const exerciseId = s.exercises[exerciseIndex]!.exerciseId;
  const next = withExercise(s, exerciseIndex, (e) => ({ ...e, sets: [...e.sets, set], draft: null }));
  await putSession(next);
  setUndo({
    label: `Serie registrada: ${formatSetShort(set)}`,
    scope: setUndoScope(sessionId, exerciseIndex),
    revert: async () => {
      const cur = getState().sessions.find((x) => x.id === sessionId);
      if (!cur) return;
      const idx = cur.exercises.findIndex((e, i) => i === exerciseIndex && e.exerciseId === exerciseId);
      const ex = cur.exercises[idx];
      if (!ex || ex.draft !== null) return;
      const pos = ex.sets.findIndex((w) => w.confirmedAt === set.confirmedAt && w.weightKg === set.weightKg);
      if (pos === -1) return;
      const { confirmedAt: _c, ...rest } = set;
      await putSession(
        withExercise(cur, idx, (e) => ({
          ...e,
          sets: e.sets.filter((_, i) => i !== pos),
          draft: { ...rest, updatedAt: nowLocal() },
        })),
      );
    },
  });
}

export async function updateSet(sessionId: Id, exerciseIndex: number, setIndex: number, values: SetValues): Promise<void> {
  const error = validateSetValues(values);
  if (error) throw new ActionError(error);
  const s = getSession(sessionId);
  await putSession(
    withExercise(s, exerciseIndex, (e) => ({
      ...e,
      sets: e.sets.map((w, i) => (i === setIndex ? toWorkSet(values, w.confirmedAt) : w)),
    })),
  );
}

export async function deleteSet(sessionId: Id, exerciseIndex: number, setIndex: number): Promise<void> {
  clearUndo();
  const s = getSession(sessionId);
  await putSession(withExercise(s, exerciseIndex, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== setIndex) })));
}

export async function toggleWarmup(sessionId: Id, exerciseIndex: number, setIndex: number): Promise<void> {
  const s = getSession(sessionId);
  await putSession(
    withExercise(s, exerciseIndex, (e) => ({
      ...e,
      sets: e.sets.map((w, i) => (i === setIndex ? { ...w, warmup: !w.warmup } : w)),
    })),
  );
}

export async function finishSession(sessionId: Id): Promise<void> {
  clearUndo();
  const s = getSession(sessionId);
  await putSession({
    ...s,
    endedAt: nowLocal(),
    exercises: s.exercises.map((e) => ({ ...e, draft: null })),
  });
}

export async function deleteSession(sessionId: Id): Promise<void> {
  clearUndo();
  await commit(["sessions"], (tx) => tx.objectStore("sessions").delete(sessionId), (s) => ({
    ...s,
    sessions: removeWhere(s.sessions, (x) => x.id === sessionId),
  }));
}

// ---------------------------------------------------------------------------
// Formato

export function formatSetShort(w: { weightKg: number | null; reps: number | null; rir: number | null; failure: boolean }): string {
  const kg = w.weightKg === null ? "— kg" : `${String(w.weightKg).replace(".", ",")} kg`;
  const reps = w.reps === null ? "—" : String(w.reps);
  const effort = w.failure ? " al fallo" : w.rir === null ? "" : ` @ RIR ${w.rir}`;
  return `${kg} × ${reps}${effort}`;
}
