// Frecuentes de la pantalla principal (FR-045).
import { addDays } from "./dates.ts";
import { refKey } from "./nutrition.ts";
import type { Consumption, FoodRef, Id, LocalDate } from "./types.ts";

export interface Frequent {
  ref: FoodRef;
  count: number;
}

export function frequents(
  consumptions: Consumption[],
  momentId: Id,
  today: LocalDate,
  isArchived: (ref: FoodRef) => boolean,
  limit = 10,
): Frequent[] {
  const from = addDays(today, -29);
  const groups = new Map<string, { count: number; lastCreatedAt: string }>();
  for (const c of consumptions) {
    if (c.momentId !== momentId || c.date < from || c.date > today) continue;
    const key = refKey(c.ref);
    const g = groups.get(key) ?? { count: 0, lastCreatedAt: "" };
    g.count++;
    if (c.createdAt > g.lastCreatedAt) g.lastCreatedAt = c.createdAt;
    groups.set(key, g);
  }

  // Cantidad o raciones del último consumo de cada elemento, en cualquier momento.
  const latestRef = new Map<string, { createdAt: string; ref: FoodRef }>();
  for (const c of consumptions) {
    const key = refKey(c.ref);
    if (!groups.has(key)) continue;
    const cur = latestRef.get(key);
    if (!cur || c.createdAt > cur.createdAt) latestRef.set(key, { createdAt: c.createdAt, ref: c.ref });
  }

  return [...groups.entries()]
    .map(([key, g]) => ({ ref: latestRef.get(key)!.ref, count: g.count, last: g.lastCreatedAt }))
    .filter((f) => !isArchived(f.ref))
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
    .slice(0, limit)
    .map(({ ref, count }) => ({ ref, count }));
}
