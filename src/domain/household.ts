// Presentación en medidas caseras (FR-037, principio IV). Solo presentación: los cálculos usan g/ml.
// contracts/domain-functions.md#householdts
import type { HouseholdMeasure } from "./types.ts";
import { formatNumber } from "./validation.ts";

export type Fraction = "1/4" | "1/3" | "1/2" | "2/3" | "3/4";

export type HouseholdDisplay =
  | { kind: "household"; measureName: string; whole: number; fraction: Fraction | null; text: string }
  | { kind: "base"; amount: number; unit: "g" | "ml"; text: string };

const FRACTIONS: [number, Fraction | null][] = [
  [0, null],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
];

const MAX_DEVIATION = 0.1;
const EPS = 1e-9;

/** Redondea al valor "entero + fracción legible" más cercano (> 0). En empate, el mayor. */
export function roundToReadable(value: number): { whole: number; fraction: Fraction | null; value: number } {
  const n = Math.floor(value);
  const candidates: { whole: number; fraction: Fraction | null; value: number }[] = FRACTIONS.map(([f, label]) => ({
    whole: n,
    fraction: label,
    value: n + f,
  }));
  candidates.push({ whole: n + 1, fraction: null, value: n + 1 });

  let best: (typeof candidates)[number] | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.value <= 0) continue;
    const d = Math.abs(c.value - value);
    if (d < bestDist - EPS || (Math.abs(d - bestDist) <= EPS && best !== null && c.value > best.value)) {
      best = c;
      bestDist = d;
    }
  }
  return best!;
}

export function pluralize(name: string): string {
  return /[aeiouáéíóú]$/i.test(name) ? `${name}s` : `${name}es`;
}

function householdText(measure: string, whole: number, fraction: Fraction | null): string {
  if (fraction === null) return `${whole} ${whole > 1 ? pluralize(measure) : measure}`;
  if (whole === 0) return `${fraction} de ${measure}`;
  return `${whole} y ${fraction} ${pluralize(measure)}`;
}

export function toHousehold(amount: number, unit: "g" | "ml", measures: HouseholdMeasure[]): HouseholdDisplay {
  const sorted = [...measures].filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount);
  if (amount > 0) {
    for (const m of sorted) {
      const v = amount / m.amount;
      const r = roundToReadable(v);
      if (Math.abs(r.value - v) / v <= MAX_DEVIATION + EPS) {
        return {
          kind: "household",
          measureName: m.name,
          whole: r.whole,
          fraction: r.fraction,
          text: householdText(m.name, r.whole, r.fraction),
        };
      }
    }
  }
  return { kind: "base", amount, unit, text: `${formatNumber(amount, 1)} ${unit}` };
}
