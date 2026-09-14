// Utilidades de fecha civil local sin librerías (research R9).
import type { LocalDate, LocalDateTime, LocalTime } from "./types.ts";

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toLocalTime(d: Date): LocalTime {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toLocalDateTime(d: Date): LocalDateTime {
  return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Construye un Date local a las 12:00 para que sumar días no cruce saltos de horario. */
export function parseLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Lunes de la semana ISO que contiene la fecha. */
export function weekStart(date: LocalDate): LocalDate {
  const d = parseLocalDate(date);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  return addDays(date, -dow);
}

export function isInRange(date: LocalDate, from: LocalDate, to: LocalDate): boolean {
  return date >= from && date <= to;
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "lun 14 sep" */
export function formatShort(date: LocalDate): string {
  const d = parseLocalDate(date);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "14 sep 2026" */
export function formatLong(date: LocalDate): string {
  const d = parseLocalDate(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function datePart(dt: LocalDateTime): LocalDate {
  return dt.slice(0, 10);
}

export function timePart(dt: LocalDateTime): LocalTime {
  return dt.slice(11, 16);
}
