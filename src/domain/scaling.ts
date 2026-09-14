// Escalado de raciones (FR-036). Sin redondeo: el redondeo es solo de presentación.
import type { Id, Recipe } from "./types.ts";

export function scaleFactor(baseServings: number, targetServings: number): number {
  if (!(baseServings > 0) || !(targetServings > 0)) throw new Error("Las raciones deben ser mayores que 0");
  return targetServings / baseServings;
}

export function scaleRecipeLines(recipe: Recipe, targetServings: number): { ingredientId: Id; amount: number }[] {
  const factor = scaleFactor(recipe.baseServings, targetServings);
  return recipe.lines.map((l) => ({ ingredientId: l.ingredientId, amount: factor === 1 ? l.amount : l.amount * factor }));
}
