// Lista de la compra: agregación, formatos de compra, regeneración y agrupación (FR-050 – FR-055).
import { isInRange } from "./dates.ts";
import { scaleFactor } from "./scaling.ts";
import type { GeneratedLine, Id, Ingredient, LocalDate, PlannedItem, Recipe, ShoppingList } from "./types.ts";

export const NO_SECTION = "Sin sección";

/** Suma por ingrediente de recetas (escaladas a las raciones planificadas) e ingredientes sueltos. */
export function aggregateRequirements(
  planned: PlannedItem[],
  recipes: Map<Id, Recipe>,
  from: LocalDate,
  to: LocalDate,
): Map<Id, number> {
  const out = new Map<Id, number>();
  const add = (id: Id, amount: number) => out.set(id, (out.get(id) ?? 0) + amount);
  for (const p of planned) {
    if (!isInRange(p.date, from, to)) continue;
    if (p.ref.type === "ingredient") {
      add(p.ref.ingredientId, p.ref.amount);
    } else {
      const recipe = recipes.get(p.ref.recipeId);
      if (!recipe) continue;
      const factor = scaleFactor(recipe.baseServings, p.ref.servings);
      for (const line of recipe.lines) add(line.ingredientId, line.amount * factor);
    }
  }
  return out;
}

export function buildGeneratedLines(requirements: Map<Id, number>, ingredients: Map<Id, Ingredient>): GeneratedLine[] {
  const lines: GeneratedLine[] = [];
  for (const [ingredientId, total] of requirements) {
    if (total <= 0) continue;
    const format = ingredients.get(ingredientId)?.purchaseFormat ?? null;
    lines.push({
      ingredientId,
      requiredAmount: total,
      packs: format ? Math.max(1, Math.ceil(total / format.amount - 1e-9)) : null,
      purchased: false,
    });
  }
  return lines;
}

/**
 * Recalcula las líneas generadas conservando las manuales. Una línea queda marcada si antes lo
 * estaba y la necesidad no aumenta (formatos de compra; sin formato, cantidad).
 */
export function regenerate(previous: ShoppingList | null, next: GeneratedLine[], from: LocalDate, to: LocalDate): ShoppingList {
  const prevById = new Map((previous?.generatedLines ?? []).map((l) => [l.ingredientId, l]));
  const generatedLines = next.map((line) => {
    const prev = prevById.get(line.ingredientId);
    let purchased = false;
    if (prev?.purchased) {
      purchased =
        line.packs !== null && prev.packs !== null
          ? line.packs <= prev.packs
          : line.requiredAmount <= prev.requiredAmount + 1e-9;
    }
    return { ...line, purchased };
  });
  return { id: "current", from, to, generatedLines, manualLines: previous?.manualLines ?? [] };
}

export function groupBySection(
  lines: GeneratedLine[],
  ingredients: Map<Id, Ingredient>,
): { section: string; lines: GeneratedLine[] }[] {
  const groups = new Map<string, GeneratedLine[]>();
  for (const l of lines) {
    const section = ingredients.get(l.ingredientId)?.section?.trim() || NO_SECTION;
    groups.set(section, [...(groups.get(section) ?? []), l]);
  }
  const name = (l: GeneratedLine) => ingredients.get(l.ingredientId)?.name ?? "";
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_SECTION ? 1 : b === NO_SECTION ? -1 : a.localeCompare(b, "es")))
    .map(([section, ls]) => ({ section, lines: ls.sort((a, b) => name(a).localeCompare(name(b), "es")) }));
}
