// Importación de ingredientes desde CSV (FR-032). contracts/ingredients-csv.md
import type { Ingredient, Result } from "./types.ts";
import { normalizeName } from "./validation.ts";

export type IngredientInput = Omit<Ingredient, "id" | "householdMeasures" | "archived">;

const HEADERS = [
  "nombre",
  "unidad_base",
  "kcal",
  "proteinas",
  "hidratos",
  "grasas",
  "seccion",
  "formato_compra",
  "formato_equivalencia",
] as const;
const REQUIRED = ["nombre", "unidad_base", "kcal", "proteinas", "hidratos", "grasas"] as const;

/** Divide un CSV en filas de campos respetando comillas dobles. */
export function splitCsv(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseNumber(raw: string, decimalComma: boolean): number | null {
  let t = raw.trim();
  if (t === "") return null;
  if (decimalComma) t = t.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function parseIngredientsCsv(text: string, existingNames: string[]): Result<IngredientInput[]> {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = firstLine.includes(";") ? ";" : ",";
  const decimalComma = sep === ";";
  const rows = splitCsv(clean, sep);
  const errors: string[] = [];

  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const unknown = header.filter((h) => h !== "" && !HEADERS.includes(h as (typeof HEADERS)[number]));
  if (unknown.length) errors.push(`cabecera: columnas desconocidas: ${unknown.join(", ")}`);
  const missing = REQUIRED.filter((h) => !header.includes(h));
  if (missing.length) errors.push(`cabecera: faltan columnas: ${missing.join(", ")}`);
  if (errors.length) return { ok: false, errors };

  const col = (row: string[], name: (typeof HEADERS)[number]) => {
    const i = header.indexOf(name);
    return i === -1 ? "" : (row[i] ?? "").trim();
  };

  const existing = new Set(existingNames.map(normalizeName));
  const seenInFile = new Map<string, number>();
  const out: IngredientInput[] = [];

  rows.slice(1).forEach((row, idx) => {
    const lineNo = idx + 2;
    if (row.every((f) => f.trim() === "")) return;
    const name = col(row, "nombre");
    const rowErrors: string[] = [];
    const fail = (msg: string) => rowErrors.push(msg);

    if (name.length < 1 || name.length > 80) fail("nombre debe tener entre 1 y 80 caracteres");
    const norm = normalizeName(name);
    if (name && existing.has(norm)) fail("ya existe un ingrediente con este nombre");
    const prev = seenInFile.get(norm);
    if (name && prev !== undefined) fail(`nombre repetido en la fila ${prev}`);
    if (name) seenInFile.set(norm, lineNo);

    const unit = col(row, "unidad_base");
    if (unit !== "g" && unit !== "ml") fail("unidad_base debe ser g o ml");

    const nutrient = (key: "kcal" | "proteinas" | "hidratos" | "grasas") => {
      const v = parseNumber(col(row, key), decimalComma);
      if (v === null) {
        fail(`falta ${key}`);
        return 0;
      }
      if (Number.isNaN(v) || v < 0) {
        fail(`${key} debe ser un número ≥ 0`);
        return 0;
      }
      return round1(v);
    };
    const kcal = nutrient("kcal");
    const protein = nutrient("proteinas");
    const carbs = nutrient("hidratos");
    const fat = nutrient("grasas");

    const section = col(row, "seccion") || null;
    const formatName = col(row, "formato_compra");
    const formatAmountRaw = col(row, "formato_equivalencia");
    let purchaseFormat: IngredientInput["purchaseFormat"] = null;
    if (formatName && !formatAmountRaw) fail("formato_compra sin formato_equivalencia");
    else if (!formatName && formatAmountRaw) fail("formato_equivalencia sin formato_compra");
    else if (formatName) {
      const amount = parseNumber(formatAmountRaw, decimalComma);
      if (amount === null || Number.isNaN(amount) || amount <= 0) fail("formato_equivalencia debe ser un número > 0");
      else if (formatName.length > 30) fail("formato_compra debe tener como máximo 30 caracteres");
      else purchaseFormat = { name: formatName, amount: round1(amount) };
    }

    if (rowErrors.length) {
      for (const e of rowErrors) errors.push(`fila ${lineNo} (${name || "sin nombre"}): ${e}`);
      return;
    }
    out.push({ name, baseUnit: unit as "g" | "ml", per100: { kcal, protein, carbs, fat }, section, purchaseFormat });
  });

  if (errors.length) return { ok: false, errors };
  if (out.length === 0) return { ok: false, errors: ["El fichero no contiene ingredientes"] };
  return { ok: true, value: out };
}
