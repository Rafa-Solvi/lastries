// Estado en memoria + escritura en IndexedDB (research R3).
// Toda mutación pasa por commit(): primero transacción IndexedDB, después estado en memoria.
import { useEffect, useRef, useState } from "preact/hooks";
import { toLocalDate, toLocalDateTime, toLocalTime } from "../domain/dates.ts";
import type { AppState, Meta } from "../domain/types.ts";
import { emptyData, emptyMeta } from "../domain/types.ts";
import { getDB, type StoreName, type Tx } from "./db.ts";

let state: AppState = { ...emptyData(), meta: emptyMeta() };
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(next: AppState): void {
  state = next;
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Hook: devuelve selector(estado) calculado en cada render (así refleja cambios de props o
 * parámetros de ruta) y re-renderiza cuando una mutación cambia el valor seleccionado.
 */
export function useAppState<T>(selector: (s: AppState) => T): T {
  const [, force] = useState(0);
  const value = selector(state);
  const selectorRef = useRef(selector);
  const valueRef = useRef(value);
  selectorRef.current = selector;
  valueRef.current = value;
  useEffect(
    () =>
      subscribe(() => {
        if (!Object.is(selectorRef.current(state), valueRef.current)) force((n) => n + 1);
      }),
    [],
  );
  return value;
}

/**
 * Ejecuta `write` en una transacción IndexedDB sobre `stores` y, solo si confirma,
 * aplica `apply` al estado en memoria.
 */
export async function commit(
  stores: StoreName[],
  write: (tx: Tx) => Promise<void>,
  apply: (s: AppState) => AppState,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(stores, "readwrite") as unknown as Tx;
  try {
    await write(tx);
    await tx.done;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      // ya abortada
    }
    throw e;
  }
  setState(apply(state));
}

export async function commitMeta(patch: Partial<Meta>): Promise<void> {
  await commit(
    ["meta"],
    async (tx) => {
      for (const [key, value] of Object.entries(patch)) await tx.objectStore("meta").put({ key, value });
    },
    (s) => ({ ...s, meta: { ...s.meta, ...patch } }),
  );
}

// ---------------------------------------------------------------------------
// Deshacer (FR-009)

export interface UndoEntry {
  label: string;
  revert: () => Promise<void>;
  scope?: string;
}

const UNDO_MS = 8000;
let undo: (UndoEntry & { id: number }) | null = null;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let undoSeq = 0;
const undoListeners = new Set<() => void>();

function notifyUndo() {
  for (const l of undoListeners) l();
}

/** Registra un deshacer; sustituye cualquier deshacer anterior y caduca a los 8 s. */
export function setUndo(entry: UndoEntry): void {
  if (undoTimer) clearTimeout(undoTimer);
  const id = ++undoSeq;
  undo = { ...entry, id };
  undoTimer = setTimeout(() => {
    if (undo?.id === id) {
      undo = null;
      notifyUndo();
    }
  }, UNDO_MS);
  notifyUndo();
}

/** Sin argumento anula el deshacer pendiente; con scope solo si coincide. */
export function clearUndo(scope?: string): void {
  if (!undo) return;
  if (scope !== undefined && undo.scope !== scope) return;
  if (undoTimer) clearTimeout(undoTimer);
  undo = null;
  notifyUndo();
}

export function getUndo(): UndoEntry | null {
  return undo;
}

export async function runUndo(): Promise<void> {
  const current = undo;
  clearUndo();
  if (current) await current.revert();
}

export function subscribeUndo(listener: () => void): () => void {
  undoListeners.add(listener);
  return () => undoListeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Utilidades

export const newId = (): string => crypto.randomUUID();
export const nowLocal = () => toLocalDateTime(new Date());
export const todayLocal = () => toLocalDate(new Date());
export const timeLocal = () => toLocalTime(new Date());

export function upsert<T>(list: T[], item: T, key: (x: T) => unknown): T[] {
  const k = key(item);
  const i = list.findIndex((x) => key(x) === k);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export function removeWhere<T>(list: T[], pred: (x: T) => boolean): T[] {
  return list.filter((x) => !pred(x));
}

/** Error de acción con mensaje para el usuario. */
export class ActionError extends Error {}
