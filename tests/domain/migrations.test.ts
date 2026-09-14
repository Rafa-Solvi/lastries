import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateDocument } from "../../src/domain/exportFormat.ts";
import { migrate, migrations, SCHEMA_VERSION } from "../../src/domain/migrations.ts";

const fixturePath = (n: number) => new URL(`../fixtures/schema-v${n}.json`, import.meta.url);
const load = (n: number) => JSON.parse(readFileSync(fixturePath(n), "utf8"));

describe("migrate", () => {
  it("con la versión actual devuelve el documento sin cambios y válido", () => {
    const doc = load(SCHEMA_VERSION);
    const r = migrate(doc);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(doc);
      expect(validateDocument(r.value).ok).toBe(true);
    }
  });

  it("rechaza documentos de una versión más reciente", () => {
    const doc = { ...load(SCHEMA_VERSION), schemaVersion: SCHEMA_VERSION + 1 };
    const r = migrate(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("versión más reciente");
  });

  it("rechaza versiones inválidas", () => {
    expect(migrate({ ...load(SCHEMA_VERSION), schemaVersion: 0 }).ok).toBe(false);
    expect(migrate({ ...load(SCHEMA_VERSION), schemaVersion: "1" }).ok).toBe(false);
    expect(migrate(null).ok).toBe(false);
  });

  it("no muta la entrada", () => {
    const doc = load(SCHEMA_VERSION);
    const snapshot = JSON.stringify(doc);
    migrate(doc);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it("cada migración tiene su fixture y el resultado migrado valida", () => {
    for (const key of Object.keys(migrations).map(Number)) {
      expect(existsSync(fixturePath(key)), `falta tests/fixtures/schema-v${key}.json`).toBe(true);
      const r = migrate(load(key));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.schemaVersion).toBe(SCHEMA_VERSION);
        const v = validateDocument(r.value);
        if (!v.ok) throw new Error(v.errors.join("\n"));
      }
    }
  });

  it("existe un fixture para la versión actual", () => {
    expect(existsSync(fixturePath(SCHEMA_VERSION))).toBe(true);
  });
});
