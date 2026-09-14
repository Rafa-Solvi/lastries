import { describe, expect, it } from "vitest";
import { scaleFactor, scaleRecipeLines } from "../../src/domain/scaling.ts";
import type { Recipe } from "../../src/domain/types.ts";

const recipe: Recipe = {
  id: "r",
  name: "Aliño",
  baseServings: 2,
  lines: [
    { ingredientId: "aceite", amount: 27 },
    { ingredientId: "harina", amount: 45 },
  ],
  steps: [],
  archived: false,
};

describe("scaleFactor", () => {
  it("raciones elegidas / raciones base", () => {
    expect(scaleFactor(2, 3)).toBe(1.5);
    expect(scaleFactor(4, 2)).toBe(0.5);
  });

  it("lanza error con raciones ≤ 0", () => {
    expect(() => scaleFactor(0, 2)).toThrow();
    expect(() => scaleFactor(2, 0)).toThrow();
    expect(() => scaleFactor(-1, 2)).toThrow();
  });
});

describe("scaleRecipeLines", () => {
  it("2 raciones con 27 g escaladas a 3 → 40,5 g", () => {
    const lines = scaleRecipeLines(recipe, 3);
    expect(lines[0]).toEqual({ ingredientId: "aceite", amount: 40.5 });
    expect(lines[1]!.amount).toBeCloseTo(67.5);
  });

  it("escalar a las raciones base devuelve las cantidades originales", () => {
    expect(scaleRecipeLines(recipe, 2)).toEqual(recipe.lines);
  });

  it("2 → 1 → 2 devuelve las originales", () => {
    const one = scaleRecipeLines(recipe, 1);
    const back = scaleRecipeLines({ ...recipe, baseServings: 1, lines: one }, 2);
    back.forEach((l, i) => expect(l.amount).toBeCloseTo(recipe.lines[i]!.amount, 10));
  });

  it("no redondea", () => {
    const r = { ...recipe, baseServings: 3, lines: [{ ingredientId: "x", amount: 10 }] };
    expect(scaleRecipeLines(r, 1)[0]!.amount).toBeCloseTo(3.3333333333, 8);
  });

  it("targetServings ≤ 0 lanza error", () => {
    expect(() => scaleRecipeLines(recipe, 0)).toThrow();
  });
});
