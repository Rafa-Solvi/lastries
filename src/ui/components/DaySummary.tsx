// Totales del día frente a objetivos vigentes, con diferencia numérica neutra (FR-043, principio V).
import { useAppState } from "../../data/store.ts";
import { dayTotals, difference, goalAt, NUTRIENTS } from "../../domain/nutrition.ts";
import type { LocalDate } from "../../domain/types.ts";
import { formatInt, formatNumber, formatSigned } from "../../domain/validation.ts";

const LABELS = { kcal: "Calorías", protein: "Proteínas", carbs: "Hidratos", fat: "Grasas" } as const;
const UNITS = { kcal: "kcal", protein: "g", carbs: "g", fat: "g" } as const;

export function DaySummary({ date }: { date: LocalDate }) {
  const consumptions = useAppState((s) => s.consumptions);
  const goals = useAppState((s) => s.goals);
  const total = dayTotals(consumptions, date);
  const goal = goalAt(goals, date);
  const diff = difference(total, goal);

  const fmt = (k: (typeof NUTRIENTS)[number], v: number) => (k === "kcal" ? formatInt(v) : formatNumber(v, 1));

  return (
    <table class="data">
      <tbody>
        {NUTRIENTS.map((k) => (
          <tr key={k}>
            <th>{LABELS[k]}</th>
            <td class="num">
              {fmt(k, total[k])}
              {goal && goal[k] !== null && ` / ${fmt(k, goal[k]!)}`} {UNITS[k]}
            </td>
            <td class="num muted">{diff[k] !== undefined ? formatSigned(diff[k]!, k === "kcal" ? 0 : 1) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
