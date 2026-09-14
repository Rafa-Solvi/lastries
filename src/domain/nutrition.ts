// Nutrición: copias congeladas, totales y objetivos (FR-038, FR-041 – FR-044).
import type { Consumption, FoodRef, Goal, Id, Ingredient, LocalDate, Nutrition, Recipe } from "./types.ts";

export const ZERO: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
export const NUTRIENTS = ["kcal", "protein", "carbs", "fat"] as const;

export function scaleNutrition(n: Nutrition, factor: number): Nutrition {
  return { kcal: n.kcal * factor, protein: n.protein * factor, carbs: n.carbs * factor, fat: n.fat * factor };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat };
}

/** Nutrición total y por ración con los valores actuales de los ingredientes. */
export function recipeNutrition(
  recipe: Recipe,
  ingredients: Map<Id, Ingredient>,
): { total: Nutrition; perServing: Nutrition } {
  let total = ZERO;
  for (const line of recipe.lines) {
    const ing = ingredients.get(line.ingredientId);
    if (ing) total = addNutrition(total, scaleNutrition(ing.per100, line.amount / 100));
  }
  return { total, perServing: scaleNutrition(total, 1 / recipe.baseServings) };
}

/** Valores por unidad para congelar: por 100 unidades base (ingrediente) o por ración (receta). */
export function snapshotFor(ref: FoodRef, ingredients: Map<Id, Ingredient>, recipes: Map<Id, Recipe>): Nutrition {
  if (ref.type === "ingredient") {
    const ing = ingredients.get(ref.ingredientId);
    if (!ing) throw new Error("Ingrediente inexistente");
    return { ...ing.per100 };
  }
  const recipe = recipes.get(ref.recipeId);
  if (!recipe) throw new Error("Receta inexistente");
  return recipeNutrition(recipe, ingredients).perServing;
}

export function refTotals(ref: FoodRef, perUnit: Nutrition): Nutrition {
  return ref.type === "ingredient" ? scaleNutrition(perUnit, ref.amount / 100) : scaleNutrition(perUnit, ref.servings);
}

export function consumptionTotals(c: Consumption): Nutrition {
  return refTotals(c.ref, c.nutritionPerUnit);
}

export function dayTotals(consumptions: Consumption[], date: LocalDate): Nutrition {
  return consumptions.filter((c) => c.date === date).reduce((acc, c) => addNutrition(acc, consumptionTotals(c)), ZERO);
}

/** Objetivo vigente: el de mayor effectiveFrom ≤ fecha. */
export function goalAt(goals: Goal[], date: LocalDate): Goal | null {
  let best: Goal | null = null;
  for (const g of goals) {
    if (g.effectiveFrom <= date && (!best || g.effectiveFrom > best.effectiveFrom)) best = g;
  }
  return best;
}

/** valor − objetivo, solo donde hay objetivo. */
export function difference(total: Nutrition, goal: Goal | null): Partial<Nutrition> {
  const out: Partial<Nutrition> = {};
  if (!goal) return out;
  for (const k of NUTRIENTS) {
    const g = goal[k];
    if (g !== null) out[k] = total[k] - g;
  }
  return out;
}

export function refKey(ref: FoodRef): string {
  return ref.type === "ingredient" ? `i:${ref.ingredientId}` : `r:${ref.recipeId}`;
}
