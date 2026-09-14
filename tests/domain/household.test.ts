import { describe, expect, it } from "vitest";
import { pluralize, roundToReadable, toHousehold } from "../../src/domain/household.ts";

const cucharada135 = [{ name: "cucharada", amount: 13.5 }];
const vasoCucharada = [
  { name: "vaso", amount: 150 },
  { name: "cucharada", amount: 10 },
];

describe("toHousehold (casos mínimos del contrato)", () => {
  it("27 g con cucharada 13,5 → 2 cucharadas", () => {
    expect(toHousehold(27, "g", cucharada135).text).toBe("2 cucharadas");
  });

  it("40,5 g con cucharada 13,5 → 3 cucharadas", () => {
    expect(toHousehold(40.5, "g", cucharada135).text).toBe("3 cucharadas");
  });

  it("100 g con vaso 150 → 2/3 de vaso", () => {
    const r = toHousehold(100, "g", [{ name: "vaso", amount: 150 }]);
    expect(r.text).toBe("2/3 de vaso");
    expect(r.kind).toBe("household");
  });

  it("45 g con vaso 150 y cucharada 10 → 4 y 1/2 cucharadas (vaso descartado por 11 %)", () => {
    expect(toHousehold(45, "g", vasoCucharada).text).toBe("4 y 1/2 cucharadas");
  });

  it("67,5 g con vaso 150 y cucharada 10 → 6 y 3/4 cucharadas (1/2 vaso descartado)", () => {
    expect(toHousehold(67.5, "g", vasoCucharada).text).toBe("6 y 3/4 cucharadas");
  });

  it("1,8 g con cucharadita 6 → 1,8 g (1/3 descartado por 11 %)", () => {
    const r = toHousehold(1.8, "g", [{ name: "cucharadita", amount: 6 }]);
    expect(r.kind).toBe("base");
    expect(r.text).toBe("1,8 g");
  });

  it("29,4 g con cucharada 15 → 2 cucharadas (1,96 → 2)", () => {
    expect(toHousehold(29.4, "g", [{ name: "cucharada", amount: 15 }]).text).toBe("2 cucharadas");
  });

  it("50 g sin medidas → 50 g", () => {
    expect(toHousehold(50, "g", []).text).toBe("50 g");
  });

  it("mililitros en unidad base", () => {
    expect(toHousehold(12.34, "ml", []).text).toBe("12,3 ml");
  });

  it("recorre las medidas de mayor a menor aunque vengan desordenadas", () => {
    expect(toHousehold(100, "g", [...vasoCucharada].reverse()).text).toBe("2/3 de vaso");
  });

  it("1 unidad en singular y 1/2 sin plural", () => {
    expect(toHousehold(60, "g", [{ name: "unidad", amount: 60 }]).text).toBe("1 unidad");
    expect(toHousehold(30, "g", [{ name: "unidad", amount: 60 }]).text).toBe("1/2 de unidad");
    expect(toHousehold(90, "g", [{ name: "unidad", amount: 60 }]).text).toBe("1 y 1/2 unidades");
  });

  it("nunca muestra una medida que se desvíe más de un 10 %", () => {
    for (let g = 0.5; g < 400; g += 0.7) {
      const r = toHousehold(g, "g", vasoCucharada);
      if (r.kind === "household") {
        const measure = vasoCucharada.find((m) => m.name === r.measureName)!;
        const shown = (r.whole + fractionValue(r.fraction)) * measure.amount;
        expect(Math.abs(shown - g) / g).toBeLessThanOrEqual(0.1 + 1e-9);
      }
    }
  });
});

function fractionValue(f: string | null): number {
  if (!f) return 0;
  const [a, b] = f.split("/").map(Number);
  return a! / b!;
}

describe("roundToReadable", () => {
  it("elige el candidato más cercano", () => {
    expect(roundToReadable(0.68)).toMatchObject({ whole: 0, fraction: "2/3" });
    expect(roundToReadable(1.4)).toMatchObject({ whole: 1, fraction: "1/3" });
    expect(roundToReadable(1.96)).toMatchObject({ whole: 2, fraction: null, value: 2 });
  });

  it("en empate elige el mayor", () => {
    // 0,125 está a igual distancia de 0 (descartado) y de 1/4; 0,875 entre 3/4 y 1
    expect(roundToReadable(0.875)).toMatchObject({ whole: 1, fraction: null });
  });

  it("nunca produce 0 ni 1 y 1/1", () => {
    expect(roundToReadable(0.05).value).toBeGreaterThan(0);
    const r = roundToReadable(1.99);
    expect(r).toMatchObject({ whole: 2, fraction: null });
  });
});

describe("pluralize", () => {
  it("vocal final + s, consonante + es", () => {
    expect(pluralize("vaso")).toBe("vasos");
    expect(pluralize("cucharada")).toBe("cucharadas");
    expect(pluralize("unidad")).toBe("unidades");
    expect(pluralize("puñado")).toBe("puñados");
  });
});
