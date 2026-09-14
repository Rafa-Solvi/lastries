// Reglas de campo compartidas (research R11).

export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function maxDecimals(value: number, n: number): boolean {
  const factor = 10 ** n;
  return Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}

export const isWeightKg = (v: unknown): v is number => isFiniteNumber(v) && v >= 0 && maxDecimals(v, 2);
export const isReps = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
export const isRir = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10;
export const isAmount = (v: unknown): v is number => isFiniteNumber(v) && v > 0 && maxDecimals(v, 1);
export const isServings = (v: unknown): v is number => isFiniteNumber(v) && v > 0 && maxDecimals(v, 2);
export const isNutritionValue = (v: unknown): v is number =>
  isFiniteNumber(v) && v >= 0 && maxDecimals(v, 1);
export const isBodyKg = (v: unknown): v is number => isFiniteNumber(v) && v > 0 && maxDecimals(v, 1);
export const isCm = (v: unknown): v is number => isFiniteNumber(v) && v > 0 && maxDecimals(v, 1);
export const isIntInRange = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export const isLocalDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
export const isLocalTime = (v: unknown): v is string =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isLocalDateTime = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(v);
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const isNameOfLength = (v: unknown, min: number, max: number): v is string =>
  typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

/** Parsea un número escrito por el usuario aceptando coma o punto decimal. Vacío → null. */
export function parseUserNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Formatea con coma decimal y como máximo `decimals` decimales. */
export function formatNumber(value: number, decimals = 1): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded).replace(".", ",");
}

/** Formatea enteros con separador de miles "." (2.500). */
export function formatInt(value: number): string {
  const r = Math.round(value);
  const sign = r < 0 ? "−" : "";
  return sign + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Diferencia con signo explícito y neutro: "+120", "−600", "0". */
export function formatSigned(value: number, decimals = 0): string {
  const factor = 10 ** decimals;
  const r = Math.round(value * factor) / factor;
  if (r === 0) return "0";
  const abs = decimals === 0 ? formatInt(Math.abs(r)) : formatNumber(Math.abs(r), decimals);
  return (r > 0 ? "+" : "−") + abs;
}
