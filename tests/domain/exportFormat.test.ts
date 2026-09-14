import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDocument, validateDocument, type ExportDocument } from "../../src/domain/exportFormat.ts";
import type { AppData } from "../../src/domain/types.ts";

const fixtureText = readFileSync(new URL("../fixtures/schema-v1.json", import.meta.url), "utf8");
const fixture = (): ExportDocument => JSON.parse(fixtureText);

function expectError(doc: unknown, fragment: string) {
  const r = validateDocument(doc);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.join("\n")).toContain(fragment);
}

describe("validateDocument", () => {
  it("acepta el documento de ejemplo válido (con draft y failure)", () => {
    const r = validateDocument(fixture());
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.ok).toBe(true);
  });

  it("acepta un documento mínimo sin datos", () => {
    const doc = buildDocument(
      {
        muscleGroups: [], exercises: [], media: [], routines: [], sessions: [], ingredients: [],
        recipes: [], mealMoments: [], plannedItems: [], consumptions: [], goals: [],
        shoppingList: null, bodyWeights: [], measurementTypes: [], bodyMeasurements: [],
      },
      { exportedAt: "2026-09-14T10:00:00", appVersion: "1.0.0", catalogVersion: null },
    );
    expect(validateDocument(doc).ok).toBe(true);
  });

  it("rechaza no-objetos y format distinto", () => {
    expect(validateDocument(null).ok).toBe(false);
    expect(validateDocument("x").ok).toBe(false);
    const doc = fixture() as unknown as Record<string, unknown>;
    doc.format = "otra-app";
    expectError(doc, "format");
  });

  it("rechaza claves desconocidas", () => {
    const doc = fixture() as unknown as { data: { exercises: Record<string, unknown>[] } };
    doc.data.exercises[0]!.favorito = true;
    expectError(doc, "data.exercises[0].favorito");
  });

  it("rechaza rir fuera de rango con la ruta del campo", () => {
    const doc = fixture();
    doc.data.sessions[0]!.exercises[0]!.sets[0]!.rir = 15;
    expectError(doc, "data.sessions[0].exercises[0].sets[0].rir");
  });

  it("rechaza failure con rir distinto de 0", () => {
    const doc = fixture();
    doc.data.sessions[0]!.exercises[0]!.sets[1]!.rir = 2;
    expectError(doc, "data.sessions[0].exercises[0].sets[1]");
  });

  it("rechaza ejercicio sin grupos primarios", () => {
    const doc = fixture();
    doc.data.exercises[0]!.primaryMuscleIds = [];
    expectError(doc, "data.exercises[0].primaryMuscleIds");
  });

  it("rechaza músculo a la vez primario y secundario", () => {
    const doc = fixture();
    doc.data.exercises[0]!.secondaryMuscleIds.push("00000000-0000-4000-8000-000000000001");
    expectError(doc, "data.exercises[0].secondaryMuscleIds");
  });

  it("rechaza repsMin > repsMax", () => {
    const doc = fixture();
    doc.data.routines[0]!.items[0]!.repsMin = 9;
    expectError(doc, "data.routines[0].items[0].repsMax");
  });

  it("rechaza dos sesiones en curso", () => {
    const doc = fixture();
    const copy = structuredClone(doc.data.sessions[0]!);
    copy.id = "00000000-0000-4000-8000-000000000041";
    doc.data.sessions.push(copy);
    expectError(doc, "sesión en curso");
  });

  it("rechaza referencias a ingredientes inexistentes", () => {
    const doc = fixture();
    doc.data.recipes[0]!.lines[0]!.ingredientId = "00000000-0000-4000-8000-0000000000ff";
    expectError(doc, "data.recipes[0].lines[0].ingredientId");
  });

  it("rechaza nombres de ingrediente duplicados tras normalizar", () => {
    const doc = fixture();
    const copy = structuredClone(doc.data.ingredients[0]!);
    copy.id = "00000000-0000-4000-8000-000000000051";
    copy.name = "  ARRÓZ blanco ";
    doc.data.ingredients.push(copy);
    expectError(doc, "data.ingredients[1].name");
  });

  it("rechaza ids duplicados", () => {
    const doc = fixture();
    doc.data.muscleGroups[1]!.id = doc.data.muscleGroups[0]!.id;
    expectError(doc, "id duplicado");
  });
});

describe("buildDocument", () => {
  it("omite blob en media y no incluye meta", () => {
    const data = fixture().data as AppData;
    const withBlob = {
      ...data,
      media: data.media.map((m) => ({ ...m, blob: new Uint8Array([1, 2]) })),
      meta: { schemaVersion: 1 },
    } as unknown as AppData;
    const doc = buildDocument(withBlob, { exportedAt: "2026-09-14T21:05:00", appVersion: "1.0.0", catalogVersion: "fixture" });
    expect("meta" in doc.data).toBe(false);
    expect(Object.keys(doc.data.media[0]!)).toEqual(["id", "mimeType", "fileName", "byteSize"]);
    expect(validateDocument(doc).ok).toBe(true);
  });

  it("construir → serializar → validar → construir da el mismo JSON (SC-004)", () => {
    const original = fixture();
    const info = { exportedAt: original.exportedAt, appVersion: original.appVersion, catalogVersion: original.catalogVersion };
    const first = JSON.stringify(buildDocument(original.data as AppData, info), null, 2);
    const parsed = validateDocument(JSON.parse(first));
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    const second = JSON.stringify(buildDocument(parsed.value.data as AppData, info), null, 2);
    expect(second).toBe(first);
  });
});
