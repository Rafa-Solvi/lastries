// Momento del día por hora (FR-040).
import type { LocalTime, MealMoment } from "./types.ts";

export function sortMoments(moments: MealMoment[]): MealMoment[] {
  return [...moments].sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
}

/** Último momento con startTime ≤ time; si ninguno, el de startTime mayor. */
export function momentAt(moments: MealMoment[], time: LocalTime): MealMoment {
  const sorted = sortMoments(moments);
  if (sorted.length === 0) throw new Error("No hay momentos del día");
  let found: MealMoment | null = null;
  for (const m of sorted) if (m.startTime <= time) found = m;
  return found ?? sorted[sorted.length - 1]!;
}

/** Franja de cada momento: desde su inicio hasta el inicio del siguiente (el último hasta el final del día). */
export function momentRanges(moments: MealMoment[]): { moment: MealMoment; from: LocalTime; to: LocalTime }[] {
  const sorted = sortMoments(moments);
  return sorted.map((m, i) => ({ moment: m, from: m.startTime, to: sorted[i + 1]?.startTime ?? "24:00" }));
}
