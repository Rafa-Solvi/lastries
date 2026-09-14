import { describe, expect, it } from "vitest";
import { aggregateRequirements, buildGeneratedLines, groupBySection, regenerate } from "../../src/domain/shopping.ts";
import type { GeneratedLine, Ingredient, PlannedItem, Recipe, ShoppingList } from "../../src/domain/types.ts";

const ing = (id: string, name: string, extra: Partial<Ingredient> = {}): Ingredient => ({
  id,
  name,
  baseUnit: "g",
  per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  section: null,
  purchaseFormat: null,
  householdMeasures: [],
  archived: false,
  ...extra,
});

const ingredients = new Map<string, Ingredient>([
  ["tomate", ing("tomate", "Tomate", { section: "Frutería" })],
  ["pollo", ing("pollo", "Pechuga de pollo", { section: "Carnicería", purchaseFormat: { name: "bandeja", amount: 500 } })],
  ["lentejas", ing("lentejas", "Lentejas", { section: "Despensa" })],
  ["leche", ing("leche", "Leche", { section: "Lácteos", baseUnit: "ml", purchaseFormat: { name: "brik", amount: 1000 } })],
  ["sal", ing("sal", "Sal")],
]);

const recipe = (id: string, baseServings: number, lines: [string, number][]): Recipe => ({
  id,
  name: id,
  baseServings,
  lines: lines.map(([ingredientId, amount]) => ({ ingredientId, amount })),
  steps: [],
  archived: false,
});

const recipes = new Map<string, Recipe>([
  ["ensalada", recipe("ensalada", 1, [["tomate", 150]])],
  ["salmorejo", recipe("salmorejo", 1, [["tomate", 250]])],
  ["guiso", recipe("guiso", 4, [["lentejas", 300], ["tomate", 100]])],
]);

let n = 0;
const planned = (date: string, ref: PlannedItem["ref"]): PlannedItem => ({ id: `p${n++}`, date, momentId: "m", ref });
const R = (recipeId: string, servings: number) => ({ type: "recipe" as const, recipeId, servings });
const I = (ingredientId: string, amount: number) => ({ type: "ingredient" as const, ingredientId, amount });

describe("aggregateRequirements", () => {
  it("tomate 150 g + 250 g en recetas + 100 g suelto → 500 g en una sola línea", () => {
    const items = [planned("2026-09-14", R("ensalada", 1)), planned("2026-09-15", R("salmorejo", 1)), planned("2026-09-16", I("tomate", 100))];
    const req = aggregateRequirements(items, recipes, "2026-09-14", "2026-09-20");
    expect(req.get("tomate")).toBe(500);
    expect(req.size).toBe(1);
  });

  it("lentejas a 2 raciones de receta base 4 con 300 g → 150 g", () => {
    const req = aggregateRequirements([planned("2026-09-14", R("guiso", 2))], recipes, "2026-09-14", "2026-09-14");
    expect(req.get("lentejas")).toBe(150);
    expect(req.get("tomate")).toBe(50);
  });

  it("fuera de rango no suma; los extremos sí", () => {
    const items = [
      planned("2026-09-13", I("sal", 5)),
      planned("2026-09-14", I("sal", 1)),
      planned("2026-09-20", I("sal", 2)),
      planned("2026-09-21", I("sal", 7)),
    ];
    expect(aggregateRequirements(items, recipes, "2026-09-14", "2026-09-20").get("sal")).toBe(3);
  });
});

describe("buildGeneratedLines", () => {
  const line = (id: string, amount: number) => buildGeneratedLines(new Map([[id, amount]]), ingredients)[0]!;

  it("pollo 650 g con bandeja 500 → 2 bandejas; 500 g exactos → 1", () => {
    expect(line("pollo", 650)).toEqual({ ingredientId: "pollo", requiredAmount: 650, packs: 2, purchased: false });
    expect(line("pollo", 500).packs).toBe(1);
  });

  it("tolera errores de coma flotante al redondear hacia arriba", () => {
    expect(line("leche", 0.1 + 0.2 + 999.7).packs).toBe(1);
  });

  it("sin formato de compra → packs null", () => {
    expect(line("tomate", 500).packs).toBeNull();
  });
});

describe("regenerate", () => {
  const list = (lines: GeneratedLine[], manual: ShoppingList["manualLines"] = []): ShoppingList => ({
    id: "current",
    from: "2026-09-14",
    to: "2026-09-20",
    generatedLines: lines,
    manualLines: manual,
  });
  const gl = (ingredientId: string, requiredAmount: number, packs: number | null, purchased = false): GeneratedLine => ({
    ingredientId,
    requiredAmount,
    packs,
    purchased,
  });
  const manual = [{ id: "m1", text: "Papel de cocina", quantity: null, purchased: true }];

  it("conserva la marca si la necesidad no aumenta y las líneas manuales", () => {
    const prev = list([gl("tomate", 500, null, true)], manual);
    const next = regenerate(prev, [gl("tomate", 500, null), gl("sal", 3, null)], "2026-09-14", "2026-09-21");
    expect(next.generatedLines.find((l) => l.ingredientId === "tomate")!.purchased).toBe(true);
    expect(next.generatedLines.find((l) => l.ingredientId === "sal")!.purchased).toBe(false);
    expect(next.manualLines).toEqual(manual);
    expect(next.to).toBe("2026-09-21");
  });

  it("desmarca si aumentan los formatos de compra", () => {
    const prev = list([gl("pollo", 400, 1, true)]);
    const next = regenerate(prev, [gl("pollo", 900, 2)], "2026-09-14", "2026-09-20");
    expect(next.generatedLines[0]!.purchased).toBe(false);
  });

  it("conserva la marca si los formatos no aumentan aunque cambie la cantidad", () => {
    const prev = list([gl("pollo", 400, 1, true)]);
    expect(regenerate(prev, [gl("pollo", 480, 1)], "2026-09-14", "2026-09-20").generatedLines[0]!.purchased).toBe(true);
  });

  it("sin formato, desmarca si aumenta la cantidad", () => {
    const prev = list([gl("tomate", 500, null, true)]);
    expect(regenerate(prev, [gl("tomate", 600, null)], "2026-09-14", "2026-09-20").generatedLines[0]!.purchased).toBe(false);
  });

  it("elimina líneas de ingredientes que ya no están en el rango", () => {
    const prev = list([gl("tomate", 500, null, true), gl("sal", 3, null)]);
    const next = regenerate(prev, [gl("sal", 3, null)], "2026-09-14", "2026-09-20");
    expect(next.generatedLines.map((l) => l.ingredientId)).toEqual(["sal"]);
  });

  it("sin lista previa crea una nueva", () => {
    const next = regenerate(null, [gl("sal", 3, null)], "2026-09-14", "2026-09-20");
    expect(next).toEqual({ id: "current", from: "2026-09-14", to: "2026-09-20", generatedLines: [gl("sal", 3, null)], manualLines: [] });
  });
});

describe("groupBySection", () => {
  it("secciones alfabéticas con Sin sección al final y líneas por nombre", () => {
    const lines = buildGeneratedLines(
      new Map([
        ["sal", 3],
        ["tomate", 500],
        ["pollo", 650],
        ["leche", 1400],
        ["lentejas", 150],
      ]),
      ingredients,
    );
    const groups = groupBySection(lines, ingredients);
    expect(groups.map((g) => g.section)).toEqual(["Carnicería", "Despensa", "Frutería", "Lácteos", "Sin sección"]);
    expect(groups.find((g) => g.section === "Lácteos")!.lines[0]!.packs).toBe(2);
  });
});
