import type { FoodRef, Ingredient, Nutrition } from "../domain/types.ts";
import { formatInt, formatNumber } from "../domain/validation.ts";

export const formatAmount = (amount: number, unit: "g" | "ml") => `${formatNumber(amount, 1)} ${unit}`;

export const formatServings = (n: number) => `${formatNumber(n, 2)} ${n === 1 ? "ración" : "raciones"}`;

export function formatRefQuantity(ref: FoodRef, ingredients: Ingredient[]): string {
  if (ref.type === "recipe") return formatServings(ref.servings);
  const unit = ingredients.find((i) => i.id === ref.ingredientId)?.baseUnit ?? "g";
  return formatAmount(ref.amount, unit);
}

export const formatKcal = (n: number) => `${formatInt(n)} kcal`;

export function formatMacros(n: Nutrition): string {
  return `P ${formatNumber(n.protein, 1)} · H ${formatNumber(n.carbs, 1)} · G ${formatNumber(n.fat, 1)}`;
}
