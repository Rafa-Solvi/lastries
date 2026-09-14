// Media móvil semanal del peso corporal (FR-061).
import { addDays } from "./dates.ts";
import type { BodyWeight, LocalDate } from "./types.ts";

/** Media de los pesajes existentes en los 7 días que terminan en `date`; null si no hay ninguno. */
export function movingAverage(weights: BodyWeight[], date: LocalDate): number | null {
  const from = addDays(date, -6);
  const window = weights.filter((w) => w.date >= from && w.date <= date);
  if (window.length === 0) return null;
  return window.reduce((sum, w) => sum + w.kg, 0) / window.length;
}
