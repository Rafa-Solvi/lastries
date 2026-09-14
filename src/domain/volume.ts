// Volumen semanal y progreso por ejercicio (FR-022 – FR-024).
import { weekStart } from "./dates.ts";
import type { Exercise, Id, LocalDate, Session } from "./types.ts";

export { weekStart };

/**
 * Series efectivas por grupo muscular en la semana que empieza en `week` (lunes).
 * 1 por serie a cada primario y 0,5 a cada secundario que no sea primario. Clasificación actual.
 */
export function weeklyVolume(sessions: Session[], exercises: Map<Id, Exercise>, week: LocalDate): Map<Id, number> {
  const out = new Map<Id, number>();
  const add = (id: Id, n: number) => out.set(id, (out.get(id) ?? 0) + n);
  for (const s of sessions) {
    if (weekStart(s.date) !== week) continue;
    for (const e of s.exercises) {
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = e.sets.filter((w) => !w.warmup).length;
      if (n === 0) continue;
      for (const id of ex.primaryMuscleIds) add(id, n);
      for (const id of ex.secondaryMuscleIds) if (!ex.primaryMuscleIds.includes(id)) add(id, 0.5 * n);
    }
  }
  return out;
}

export interface ProgressPoint {
  date: LocalDate;
  weightKg: number;
  reps: number;
}

/** Por sesión, la serie efectiva de mayor peso (desempate: más repeticiones), y la mejor marca. */
export function exerciseProgress(sessions: Session[], exerciseId: Id): { points: ProgressPoint[]; best: ProgressPoint | null } {
  const better = (a: ProgressPoint, b: ProgressPoint | null) =>
    !b || a.weightKg > b.weightKg || (a.weightKg === b.weightKg && a.reps > b.reps);
  const points: ProgressPoint[] = [];
  let best: ProgressPoint | null = null;
  const ordered = [...sessions].sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  for (const s of ordered) {
    let top: ProgressPoint | null = null;
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const w of e.sets) {
        if (w.warmup) continue;
        const p = { date: s.date, weightKg: w.weightKg, reps: w.reps };
        if (better(p, top)) top = p;
      }
    }
    if (top) {
      points.push(top);
      if (better(top, best)) best = top;
    }
  }
  return { points, best };
}
