// Plan de comidas y lista de la compra (FR-037, FR-039, FR-041, FR-050 – FR-055).
import { aggregateRequirements, buildGeneratedLines, regenerate } from "../../domain/shopping.ts";
import type { FoodRef, Id, LocalDate, PlannedItem, ShoppingList } from "../../domain/types.ts";
import { isAmount, isLocalDate, isNameOfLength, isServings } from "../../domain/validation.ts";
import { ActionError, commit, getState, newId, removeWhere, setUndo, todayLocal, upsert } from "../store.ts";
import { buildConsumption, refName, removeConsumptions } from "./food.ts";

const byId = <T extends { id: Id }>(x: T) => x.id;

function validateRef(ref: FoodRef) {
  const s = getState();
  if (ref.type === "ingredient") {
    if (!s.ingredients.some((i) => i.id === ref.ingredientId)) throw new ActionError("Ingrediente inexistente");
    if (!isAmount(ref.amount)) throw new ActionError("Cantidad: número > 0 con hasta 1 decimal");
  } else {
    if (!s.recipes.some((r) => r.id === ref.recipeId)) throw new ActionError("Receta inexistente");
    if (!isServings(ref.servings)) throw new ActionError("Raciones: número > 0 con hasta 2 decimales");
  }
}

async function putPlanned(items: PlannedItem[]) {
  await commit(
    ["plannedItems"],
    async (tx) => {
      for (const p of items) await tx.objectStore("plannedItems").put(p);
    },
    (s) => ({ ...s, plannedItems: items.reduce((acc, p) => upsert(acc, p, byId), s.plannedItems) }),
  );
}

export async function addPlannedItem(args: { date: LocalDate; momentId: Id; ref: FoodRef }): Promise<PlannedItem> {
  if (!isLocalDate(args.date)) throw new ActionError("Fecha inválida");
  if (!getState().mealMoments.some((m) => m.id === args.momentId)) throw new ActionError("Momento inexistente");
  validateRef(args.ref);
  const item: PlannedItem = { id: newId(), ...args };
  await putPlanned([item]);
  return item;
}

export async function updatePlannedItem(id: Id, patch: Partial<Omit<PlannedItem, "id">>): Promise<void> {
  const old = getState().plannedItems.find((p) => p.id === id);
  if (!old) throw new ActionError("Elemento no encontrado");
  const next = { ...old, ...patch };
  validateRef(next.ref);
  await putPlanned([next]);
}

/** Borra el elemento y desvincula los consumos que procedían de él. */
export async function deletePlannedItem(id: Id): Promise<void> {
  const linked = getState().consumptions.filter((c) => c.plannedItemId === id);
  await commit(
    ["plannedItems", "consumptions"],
    async (tx) => {
      await tx.objectStore("plannedItems").delete(id);
      for (const c of linked) await tx.objectStore("consumptions").put({ ...c, plannedItemId: null });
    },
    (s) => ({
      ...s,
      plannedItems: removeWhere(s.plannedItems, (p) => p.id === id),
      consumptions: s.consumptions.map((c) => (c.plannedItemId === id ? { ...c, plannedItemId: null } : c)),
    }),
  );
}

export async function copyPlannedDay(from: LocalDate, to: LocalDate): Promise<number> {
  if (!isLocalDate(to)) throw new ActionError("Fecha inválida");
  const copies = getState()
    .plannedItems.filter((p) => p.date === from)
    .map((p) => ({ ...p, id: newId(), date: to }));
  if (copies.length) await putPlanned(copies);
  return copies.length;
}

export function isPlannedEaten(plannedItemId: Id): boolean {
  return getState().consumptions.some((c) => c.plannedItemId === plannedItemId);
}

/** Registra como comido un elemento planificado (con copia congelada actual) y ofrece deshacer. */
export async function markPlannedEaten(plannedItemId: Id, adjustedRef?: FoodRef): Promise<void> {
  const item = getState().plannedItems.find((p) => p.id === plannedItemId);
  if (!item) throw new ActionError("Elemento no encontrado");
  const c = buildConsumption(adjustedRef ?? item.ref, item.date, item.momentId, item.id);
  await commit(["consumptions"], (tx) => tx.objectStore("consumptions").put(c).then(() => {}), (s) => ({
    ...s,
    consumptions: [...s.consumptions, c],
  }));
  setUndo({ label: `Comido: ${refName(c.ref)}`, revert: () => removeConsumptions([c.id]) });
}

// ---------------------------------------------------------------------------
// Lista de la compra

async function putList(list: ShoppingList) {
  await commit(["shoppingList"], (tx) => tx.objectStore("shoppingList").put(list).then(() => {}), (s) => ({
    ...s,
    shoppingList: list,
  }));
}

function currentList(): ShoppingList {
  const l = getState().shoppingList;
  if (!l) throw new ActionError("No hay lista de la compra");
  return l;
}

export async function generateShoppingList(from: LocalDate, to: LocalDate): Promise<void> {
  if (!isLocalDate(from) || !isLocalDate(to)) throw new ActionError("Fechas inválidas");
  if (from > to) throw new ActionError("La fecha de inicio debe ser anterior o igual a la de fin");
  const s = getState();
  const requirements = aggregateRequirements(s.plannedItems, new Map(s.recipes.map((r) => [r.id, r])), from, to);
  const lines = buildGeneratedLines(requirements, new Map(s.ingredients.map((i) => [i.id, i])));
  await putList(regenerate(s.shoppingList, lines, from, to));
}

export async function togglePurchased(key: { ingredientId: Id } | { manualId: Id }): Promise<void> {
  const l = currentList();
  await putList(
    "ingredientId" in key
      ? { ...l, generatedLines: l.generatedLines.map((x) => (x.ingredientId === key.ingredientId ? { ...x, purchased: !x.purchased } : x)) }
      : { ...l, manualLines: l.manualLines.map((x) => (x.id === key.manualId ? { ...x, purchased: !x.purchased } : x)) },
  );
}

function validateManual(text: string) {
  if (!isNameOfLength(text, 1, 120)) throw new ActionError("El texto debe tener entre 1 y 120 caracteres");
}

export async function addManualLine(text: string, quantity: string | null): Promise<void> {
  validateManual(text);
  const l = getState().shoppingList;
  const today = todayLocal();
  const base: ShoppingList = l ?? { id: "current", from: today, to: today, generatedLines: [], manualLines: [] };
  await putList({
    ...base,
    manualLines: [...base.manualLines, { id: newId(), text: text.trim(), quantity: quantity?.trim() || null, purchased: false }],
  });
}

export async function updateManualLine(id: Id, text: string, quantity: string | null): Promise<void> {
  validateManual(text);
  const l = currentList();
  await putList({ ...l, manualLines: l.manualLines.map((m) => (m.id === id ? { ...m, text: text.trim(), quantity: quantity?.trim() || null } : m)) });
}

export async function deleteManualLine(id: Id): Promise<void> {
  const l = currentList();
  await putList({ ...l, manualLines: l.manualLines.filter((m) => m.id !== id) });
}
