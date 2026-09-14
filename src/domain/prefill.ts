// Precarga de series (FR-017, FR-018, FR-021). contracts/domain-functions.md#prefill
import type { DraftSet, Id, Session, SessionExercise, WorkSet } from "./types.ts";

export interface PendingSet {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  failure: boolean;
  warmup: boolean;
  isDraft: boolean;
}

/**
 * Series de la última vez que se entrenó el ejercicio: el SessionExercise con ese ejercicio y al menos
 * una serie, de la sesión más reciente por startedAt, excluida la sesión actual.
 */
export function lastTime(sessions: Session[], exerciseId: Id, excludeSessionId: Id | null): WorkSet[] | null {
  let best: { startedAt: string; sets: WorkSet[] } | null = null;
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    if (best && s.startedAt <= best.startedAt) continue;
    const withSets = s.exercises.filter((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (withSets.length === 0) continue;
    best = { startedAt: s.startedAt, sets: withSets[withSets.length - 1]!.sets };
  }
  return best ? best.sets : null;
}

const fromWorkSet = (w: WorkSet): PendingSet => ({
  weightKg: w.weightKg,
  reps: w.reps,
  rir: w.rir,
  failure: w.failure,
  warmup: w.warmup,
  isDraft: false,
});

export function pendingSets(
  last: WorkSet[] | null,
  target: SessionExercise["target"],
  confirmedCount: number,
  draft: DraftSet | null,
): PendingSet[] {
  let template: PendingSet[];
  if (last && last.length > 0) {
    template = last.map(fromWorkSet);
    if (target) {
      const effective = last.filter((w) => !w.warmup);
      const lastEffective = effective[effective.length - 1] ?? last[last.length - 1]!;
      for (let n = effective.length; n < target.targetSets; n++) template.push(fromWorkSet(lastEffective));
    }
  } else if (target) {
    template = Array.from({ length: target.targetSets }, () => ({
      weightKg: null,
      reps: target.repsMin,
      rir: target.targetRir,
      failure: false,
      warmup: false,
      isDraft: false,
    }));
  } else {
    template = [{ weightKg: null, reps: null, rir: null, failure: false, warmup: false, isDraft: false }];
  }

  const pending = template.slice(confirmedCount);
  if (draft) {
    const d: PendingSet = {
      weightKg: draft.weightKg,
      reps: draft.reps,
      rir: draft.rir,
      failure: draft.failure,
      warmup: draft.warmup,
      isDraft: true,
    };
    if (pending.length > 0) pending[0] = d;
    else pending.push(d);
  }
  return pending;
}

/** Series pendientes de cada ejercicio de una sesión. */
export function pendingForSession(sessions: Session[], session: Session): PendingSet[][] {
  return session.exercises.map((e) =>
    pendingSets(lastTime(sessions, e.exerciseId, session.id), e.target, e.sets.length, e.draft),
  );
}

/** Serie nueva cuando la plantilla se ha agotado: copia la última confirmada. */
export function extraSetFrom(sets: WorkSet[]): PendingSet {
  const last = sets[sets.length - 1];
  return last
    ? { ...fromWorkSet(last), isDraft: false }
    : { weightKg: null, reps: null, rir: null, failure: false, warmup: false, isDraft: false };
}

/**
 * Ejercicio en curso (contracts/logging-flows.md): el de la última serie confirmada si aún le
 * quedan pendientes; si no, el primero con pendientes en el orden de la sesión. -1 si ninguno.
 */
export function currentExerciseIndex(session: Session, pendingCounts: number[]): number {
  let lastIdx = -1;
  let lastAt = "";
  session.exercises.forEach((e, i) => {
    for (const s of e.sets) {
      if (s.confirmedAt >= lastAt) {
        lastAt = s.confirmedAt;
        lastIdx = i;
      }
    }
  });
  if (lastIdx >= 0 && (pendingCounts[lastIdx] ?? 0) > 0) return lastIdx;
  return pendingCounts.findIndex((n) => n > 0);
}
