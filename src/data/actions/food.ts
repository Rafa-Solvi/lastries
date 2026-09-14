// Acciones de alimentación: ingredientes, recetas, momentos, objetivos y consumos.
import { addDays } from "../../domain/dates.ts";
import { parseIngredientsCsv } from "../../domain/csvIngredients.ts";
import { momentAt } from "../../domain/mealMoment.ts";
import { snapshotFor } from "../../domain/nutrition.ts";
import type {
  Consumption,
  FoodRef,
  Goal,
  HouseholdMeasure,
  Id,
  Ingredient,
  LocalDate,
  MealMoment,
  Recipe,
  RecipeLine,
} from "../../domain/types.ts";
import {
  isAmount,
  isLocalDate,
  isLocalTime,
  isNameOfLength,
  isNutritionValue,
  isServings,
  normalizeName,
} from "../../domain/validation.ts";
import {
  ActionError,
  commit,
  getState,
  newId,
  nowLocal,
  removeWhere,
  setUndo,
  timeLocal,
  todayLocal,
  upsert,
} from "../store.ts";

const byId = <T extends { id: Id }>(x: T) => x.id;
const ingredientMap = () => new Map(getState().ingredients.map((i) => [i.id, i]));
const recipeMap = () => new Map(getState().recipes.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Ingredientes

export type IngredientForm = Omit<Ingredient, "id" | "householdMeasures" | "archived">;

function validateIngredient(input: IngredientForm, exceptId: Id | null) {
  if (!isNameOfLength(input.name, 1, 80)) throw new ActionError("El nombre debe tener entre 1 y 80 caracteres");
  const n = normalizeName(input.name);
  if (getState().ingredients.some((i) => i.id !== exceptId && normalizeName(i.name) === n))
    throw new ActionError("Ya existe un ingrediente con ese nombre");
  if (input.baseUnit !== "g" && input.baseUnit !== "ml") throw new ActionError("La unidad base debe ser g o ml");
  for (const [k, label] of [
    ["kcal", "Calorías"],
    ["protein", "Proteínas"],
    ["carbs", "Hidratos"],
    ["fat", "Grasas"],
  ] as const) {
    if (!isNutritionValue(input.per100[k])) throw new ActionError(`${label}: número ≥ 0 con hasta 1 decimal`);
  }
  if (input.purchaseFormat) {
    if (!isNameOfLength(input.purchaseFormat.name, 1, 30))
      throw new ActionError("Formato de compra: nombre entre 1 y 30 caracteres");
    if (!isAmount(input.purchaseFormat.amount))
      throw new ActionError("Formato de compra: equivalencia > 0 con hasta 1 decimal");
  }
}

async function putIngredient(ing: Ingredient) {
  await commit(["ingredients"], (tx) => tx.objectStore("ingredients").put(ing).then(() => {}), (s) => ({
    ...s,
    ingredients: upsert(s.ingredients, ing, byId),
  }));
}

export async function saveIngredient(id: Id | null, input: IngredientForm): Promise<Ingredient> {
  validateIngredient(input, id);
  const old = id ? getState().ingredients.find((i) => i.id === id) : null;
  if (id && !old) throw new ActionError("Ingrediente no encontrado");
  const ing: Ingredient = {
    id: id ?? newId(),
    name: input.name.trim(),
    baseUnit: input.baseUnit,
    per100: input.per100,
    section: input.section?.trim() || null,
    purchaseFormat: input.purchaseFormat ? { name: input.purchaseFormat.name.trim(), amount: input.purchaseFormat.amount } : null,
    householdMeasures: old?.householdMeasures ?? [],
    archived: old?.archived ?? false,
  };
  await putIngredient(ing);
  return ing;
}

export async function setIngredientArchived(id: Id, archived: boolean): Promise<void> {
  const old = getState().ingredients.find((i) => i.id === id);
  if (!old) throw new ActionError("Ingrediente no encontrado");
  await putIngredient({ ...old, archived });
}

const refUses = (ref: FoodRef, type: FoodRef["type"], id: Id) =>
  ref.type === type && (ref.type === "ingredient" ? ref.ingredientId === id : ref.recipeId === id);

export async function deleteIngredient(id: Id): Promise<void> {
  const s = getState();
  const used =
    s.recipes.some((r) => r.lines.some((l) => l.ingredientId === id)) ||
    s.plannedItems.some((p) => refUses(p.ref, "ingredient", id)) ||
    s.consumptions.some((c) => refUses(c.ref, "ingredient", id));
  if (used) throw new ActionError("Este ingrediente se usa en recetas, planes o registros. Puedes archivarlo.");
  await commit(["ingredients", "shoppingList"], async (tx) => {
    await tx.objectStore("ingredients").delete(id);
    if (s.shoppingList?.generatedLines.some((l) => l.ingredientId === id)) {
      await tx.objectStore("shoppingList").put({
        ...s.shoppingList,
        generatedLines: s.shoppingList.generatedLines.filter((l) => l.ingredientId !== id),
      });
    }
  }, (st) => ({
    ...st,
    ingredients: removeWhere(st.ingredients, (i) => i.id === id),
    shoppingList: st.shoppingList
      ? { ...st.shoppingList, generatedLines: st.shoppingList.generatedLines.filter((l) => l.ingredientId !== id) }
      : null,
  }));
}

/** Importa ingredientes desde CSV: todo en una transacción o nada. */
export async function importIngredients(csvText: string): Promise<{ ok: true; count: number } | { ok: false; errors: string[] }> {
  const parsed = parseIngredientsCsv(csvText, getState().ingredients.map((i) => i.name));
  if (!parsed.ok) return parsed;
  const created: Ingredient[] = parsed.value.map((v) => ({ ...v, id: newId(), householdMeasures: [], archived: false }));
  await commit(
    ["ingredients"],
    async (tx) => {
      for (const ing of created) await tx.objectStore("ingredients").put(ing);
    },
    (s) => ({ ...s, ingredients: [...s.ingredients, ...created] }),
  );
  return { ok: true, count: created.length };
}

export async function setHouseholdMeasures(ingredientId: Id, measures: HouseholdMeasure[]): Promise<void> {
  const old = getState().ingredients.find((i) => i.id === ingredientId);
  if (!old) throw new ActionError("Ingrediente no encontrado");
  const names = new Set<string>();
  const clean = measures.map((m, i) => {
    const name = m.name.trim();
    if (!isNameOfLength(name, 1, 30)) throw new ActionError(`Medida ${i + 1}: nombre entre 1 y 30 caracteres`);
    const n = normalizeName(name);
    if (names.has(n)) throw new ActionError(`Medida ${i + 1}: nombre repetido`);
    names.add(n);
    if (!isAmount(m.amount)) throw new ActionError(`Medida ${i + 1}: equivalencia > 0 con hasta 1 decimal`);
    return { name, amount: m.amount };
  });
  await putIngredient({ ...old, householdMeasures: clean });
}

// ---------------------------------------------------------------------------
// Recetas

export interface RecipeForm {
  name: string;
  baseServings: number;
  lines: RecipeLine[];
  steps: string[];
}

export async function saveRecipe(id: Id | null, input: RecipeForm): Promise<Recipe> {
  if (!isNameOfLength(input.name, 1, 120)) throw new ActionError("El nombre debe tener entre 1 y 120 caracteres");
  if (!isServings(input.baseServings)) throw new ActionError("Raciones base: número > 0 con hasta 2 decimales");
  if (input.lines.length < 1) throw new ActionError("La receta necesita al menos un ingrediente");
  const ingredients = ingredientMap();
  input.lines.forEach((l, i) => {
    if (!ingredients.has(l.ingredientId)) throw new ActionError(`Línea ${i + 1}: ingrediente inexistente`);
    if (!isAmount(l.amount)) throw new ActionError(`Línea ${i + 1}: cantidad > 0 con hasta 1 decimal`);
  });
  const old = id ? getState().recipes.find((r) => r.id === id) : null;
  const recipe: Recipe = {
    id: id ?? newId(),
    name: input.name.trim(),
    baseServings: input.baseServings,
    lines: input.lines,
    steps: input.steps.map((s) => s.trim()).filter(Boolean),
    archived: old?.archived ?? false,
  };
  await commit(["recipes"], (tx) => tx.objectStore("recipes").put(recipe).then(() => {}), (s) => ({
    ...s,
    recipes: upsert(s.recipes, recipe, byId),
  }));
  return recipe;
}

export async function setRecipeArchived(id: Id, archived: boolean): Promise<void> {
  const old = getState().recipes.find((r) => r.id === id);
  if (!old) throw new ActionError("Receta no encontrada");
  const next = { ...old, archived };
  await commit(["recipes"], (tx) => tx.objectStore("recipes").put(next).then(() => {}), (s) => ({
    ...s,
    recipes: upsert(s.recipes, next, byId),
  }));
}

export async function deleteRecipe(id: Id): Promise<void> {
  const s = getState();
  if (s.plannedItems.some((p) => refUses(p.ref, "recipe", id)) || s.consumptions.some((c) => refUses(c.ref, "recipe", id)))
    throw new ActionError("Esta receta se usa en planes o registros. Puedes archivarla.");
  await commit(["recipes"], (tx) => tx.objectStore("recipes").delete(id), (st) => ({
    ...st,
    recipes: removeWhere(st.recipes, (r) => r.id === id),
  }));
}

// ---------------------------------------------------------------------------
// Momentos del día y objetivos

export async function seedMealMoments(): Promise<void> {
  if (getState().mealMoments.length > 0) return;
  const moments: MealMoment[] = [
    { id: newId(), name: "Desayuno", startTime: "07:00" },
    { id: newId(), name: "Comida", startTime: "13:00" },
    { id: newId(), name: "Merienda", startTime: "17:00" },
    { id: newId(), name: "Cena", startTime: "20:30" },
  ];
  await commit(
    ["mealMoments"],
    async (tx) => {
      for (const m of moments) await tx.objectStore("mealMoments").put(m);
    },
    (s) => ({ ...s, mealMoments: moments }),
  );
}

export async function saveMealMoment(id: Id | null, name: string, startTime: string): Promise<void> {
  if (!isNameOfLength(name, 1, 30)) throw new ActionError("El nombre debe tener entre 1 y 30 caracteres");
  if (!isLocalTime(startTime)) throw new ActionError("Hora inválida (HH:MM)");
  const others = getState().mealMoments.filter((m) => m.id !== id);
  if (others.some((m) => normalizeName(m.name) === normalizeName(name))) throw new ActionError("Ya existe un momento con ese nombre");
  if (others.some((m) => m.startTime === startTime)) throw new ActionError("Ya existe un momento que empieza a esa hora");
  const m: MealMoment = { id: id ?? newId(), name: name.trim(), startTime };
  await commit(["mealMoments"], (tx) => tx.objectStore("mealMoments").put(m).then(() => {}), (s) => ({
    ...s,
    mealMoments: upsert(s.mealMoments, m, byId),
  }));
}

export async function deleteMealMoment(id: Id): Promise<void> {
  const s = getState();
  if (s.mealMoments.length <= 1) throw new ActionError("Debe quedar al menos un momento del día");
  if (s.plannedItems.some((p) => p.momentId === id) || s.consumptions.some((c) => c.momentId === id))
    throw new ActionError("Este momento tiene elementos planificados o consumos");
  await commit(["mealMoments"], (tx) => tx.objectStore("mealMoments").delete(id), (st) => ({
    ...st,
    mealMoments: removeWhere(st.mealMoments, (m) => m.id === id),
  }));
}

export async function setGoal(input: Omit<Goal, "id">): Promise<void> {
  if (!isLocalDate(input.effectiveFrom)) throw new ActionError("Fecha de vigencia inválida");
  for (const k of ["kcal", "protein", "carbs", "fat"] as const) {
    const v = input[k];
    if (v !== null && !isNutritionValue(v)) throw new ActionError("Los objetivos deben ser números ≥ 0 con hasta 1 decimal");
  }
  const existing = getState().goals.find((g) => g.effectiveFrom === input.effectiveFrom);
  const goal: Goal = { ...input, id: existing?.id ?? newId() };
  await commit(["goals"], (tx) => tx.objectStore("goals").put(goal).then(() => {}), (s) => ({
    ...s,
    goals: upsert(s.goals, goal, byId),
  }));
}

export async function deleteGoal(id: Id): Promise<void> {
  await commit(["goals"], (tx) => tx.objectStore("goals").delete(id), (s) => ({
    ...s,
    goals: removeWhere(s.goals, (g) => g.id === id),
  }));
}

// ---------------------------------------------------------------------------
// Consumos

function validateRef(ref: FoodRef) {
  if (ref.type === "ingredient") {
    if (!ingredientMap().has(ref.ingredientId)) throw new ActionError("Ingrediente inexistente");
    if (!isAmount(ref.amount)) throw new ActionError("Cantidad: número > 0 con hasta 1 decimal");
  } else {
    if (!recipeMap().has(ref.recipeId)) throw new ActionError("Receta inexistente");
    if (!isServings(ref.servings)) throw new ActionError("Raciones: número > 0 con hasta 2 decimales");
  }
}

export function refName(ref: FoodRef): string {
  const s = getState();
  return ref.type === "ingredient"
    ? (s.ingredients.find((i) => i.id === ref.ingredientId)?.name ?? "?")
    : (s.recipes.find((r) => r.id === ref.recipeId)?.name ?? "?");
}

async function putConsumptions(list: Consumption[]) {
  await commit(
    ["consumptions"],
    async (tx) => {
      for (const c of list) await tx.objectStore("consumptions").put(c);
    },
    (s) => ({ ...s, consumptions: list.reduce((acc, c) => upsert(acc, c, byId), s.consumptions) }),
  );
}

export async function removeConsumptions(ids: Id[]): Promise<void> {
  const set = new Set(ids);
  await commit(
    ["consumptions"],
    async (tx) => {
      for (const id of ids) await tx.objectStore("consumptions").delete(id);
    },
    (s) => ({ ...s, consumptions: removeWhere(s.consumptions, (c) => set.has(c.id)) }),
  );
}

export function buildConsumption(ref: FoodRef, date: LocalDate, momentId: Id, plannedItemId: Id | null): Consumption {
  validateRef(ref);
  return {
    id: newId(),
    date,
    momentId,
    ref,
    nutritionPerUnit: snapshotFor(ref, ingredientMap(), recipeMap()),
    plannedItemId,
    createdAt: nowLocal(),
  };
}

/** Registra un consumo. Por defecto: hoy y el momento cuya franja contiene la hora actual. */
export async function addConsumption(args: { ref: FoodRef; date?: LocalDate; momentId?: Id }): Promise<Consumption> {
  const moments = getState().mealMoments;
  const momentId = args.momentId ?? momentAt(moments, timeLocal()).id;
  const c = buildConsumption(args.ref, args.date ?? todayLocal(), momentId, null);
  await putConsumptions([c]);
  setUndo({ label: `Registrado: ${refName(c.ref)}`, revert: () => removeConsumptions([c.id]) });
  return c;
}

/** Cambiar solo cantidad/raciones conserva la copia congelada; cambiar el elemento toma una nueva. */
export async function updateConsumption(id: Id, patch: { ref?: FoodRef; momentId?: Id; date?: LocalDate }): Promise<void> {
  const old = getState().consumptions.find((c) => c.id === id);
  if (!old) throw new ActionError("Consumo no encontrado");
  const ref = patch.ref ?? old.ref;
  validateRef(ref);
  const sameItem =
    ref.type === old.ref.type &&
    (ref.type === "ingredient"
      ? ref.ingredientId === (old.ref as typeof ref).ingredientId
      : ref.recipeId === (old.ref as typeof ref).recipeId);
  if (patch.momentId && !getState().mealMoments.some((m) => m.id === patch.momentId))
    throw new ActionError("Momento inexistente");
  if (patch.date && !isLocalDate(patch.date)) throw new ActionError("Fecha inválida");
  await putConsumptions([
    {
      ...old,
      ref,
      momentId: patch.momentId ?? old.momentId,
      date: patch.date ?? old.date,
      nutritionPerUnit: sameItem ? old.nutritionPerUnit : snapshotFor(ref, ingredientMap(), recipeMap()),
    },
  ]);
}

export async function deleteConsumption(id: Id): Promise<void> {
  await removeConsumptions([id]);
}

/** Repite hoy los consumos de un momento de otro día con copia congelada nueva (FR-041). */
export async function repeatMoment(fromDate: LocalDate, momentId: Id): Promise<number> {
  const source = getState().consumptions.filter((c) => c.date === fromDate && c.momentId === momentId);
  if (source.length === 0) return 0;
  const today = todayLocal();
  const created = source.map((c) => buildConsumption(c.ref, today, momentId, null));
  await putConsumptions(created);
  const moment = getState().mealMoments.find((m) => m.id === momentId);
  setUndo({ label: `Repetido: ${moment?.name ?? "comida"} de ayer`, revert: () => removeConsumptions(created.map((c) => c.id)) });
  return created.length;
}

export const yesterday = () => addDays(todayLocal(), -1);
