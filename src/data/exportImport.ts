// Entrega de ficheros, exportación e importación (contracts/export-format.md, FR-003, FR-004).
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { toLocalDate } from "../domain/dates.ts";
import { buildDocument, validateDocument, type ExportDocument } from "../domain/exportFormat.ts";
import { migrate, SCHEMA_VERSION } from "../domain/migrations.ts";
import type { Id } from "../domain/types.ts";
import { seedMealMoments } from "./actions/food.ts";
import { seedMeasurementTypes } from "./actions/progress.ts";
import { seedCatalog } from "./catalogSeed.ts";
import { getDB, getMediaBlob, loadAll, replaceAll } from "./db.ts";
import { clearMediaUrlCache } from "./media.ts";
import { clearUndo, commitMeta, getState, nowLocal, setState } from "./store.ts";

/** Entrega un fichero: hoja de compartir del móvil si está disponible; si no, descarga. */
export async function deliverFile(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // si compartir falla por otro motivo, se intenta la descarga
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------------------------------------------------------------------
// Exportación

export const DOCUMENT_NAME = "lastries.json";

function currentDocumentText(): string {
  const s = getState();
  const doc = buildDocument(s, { exportedAt: nowLocal(), appVersion: __APP_VERSION__, catalogVersion: s.meta.catalogVersion });
  return JSON.stringify(doc, null, 2) + "\n";
}

/** Crea el contenido de la exportación sin entregarla (útil también para pruebas). */
export async function buildExport(kind: "full" | "data"): Promise<{ blob: Blob; fileName: string }> {
  const date = toLocalDate(new Date());
  const text = currentDocumentText();
  if (kind === "data") {
    return { blob: new Blob([text], { type: "application/json" }), fileName: `lastries-${date}.json` };
  }
  const entries: Zippable = { [DOCUMENT_NAME]: [strToU8(text), { level: 6 }] };
  for (const m of getState().media) {
    const blob = await getMediaBlob(m.id);
    if (blob) entries[`media/${m.fileName}`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  }
  const zipped = zipSync(entries);
  return { blob: new Blob([zipped], { type: "application/zip" }), fileName: `lastries-${date}.zip` };
}

export async function exportData(kind: "full" | "data"): Promise<void> {
  const { blob, fileName } = await buildExport(kind);
  await deliverFile(blob, fileName);
  await commitMeta({ lastExportAt: nowLocal() });
}

// ---------------------------------------------------------------------------
// Importación

export interface ImportSummary {
  sessions: number;
  sets: number;
  consumptions: number;
  ingredients: number;
  recipes: number;
  bodyWeights: number;
  exercises: number;
}

export type PreparedImport =
  | {
      ok: true;
      document: ExportDocument;
      blobs: Map<Id, Blob>;
      missingMedia: number;
      summary: ImportSummary;
    }
  | { ok: false; errors: string[] };

const NOT_LASTRIES = "El fichero no es una exportación de Lastries";

/** Fases 1–5: leer, parsear, migrar, validar y resolver medios. No toca IndexedDB. */
export async function prepareImport(file: Blob & { name?: string }): Promise<PreparedImport> {
  // (1) Leer
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let text: string;
  let entries: Record<string, Uint8Array> = {};
  if (isZip) {
    try {
      entries = unzipSync(bytes);
    } catch {
      return { ok: false, errors: [`${NOT_LASTRIES}: el ZIP está dañado`] };
    }
    const doc = entries[DOCUMENT_NAME];
    if (!doc) return { ok: false, errors: [`${NOT_LASTRIES}: falta ${DOCUMENT_NAME} en la raíz del ZIP`] };
    text = strFromU8(doc);
  } else {
    text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  }

  // (2) Parsear
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON no válido: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (typeof parsed !== "object" || parsed === null || (parsed as { format?: unknown }).format !== "lastries") {
    return { ok: false, errors: [NOT_LASTRIES] };
  }

  // (3) Migrar
  const migrated = migrate(parsed);
  if (!migrated.ok) return migrated;

  // (4) Validar
  const valid = validateDocument(migrated.value);
  if (!valid.ok) return valid;
  const document = valid.value;

  // (5) Resolver medios: los ausentes no son error
  const blobs = new Map<Id, Blob>();
  const missing = new Set<Id>();
  for (const m of document.data.media) {
    const entry = entries[`media/${m.fileName}`];
    if (entry) blobs.set(m.id, new Blob([entry as Uint8Array<ArrayBuffer>], { type: m.mimeType }));
    else missing.add(m.id);
  }
  if (missing.size > 0) {
    document.data.media = document.data.media.filter((m) => !missing.has(m.id));
    document.data.exercises = document.data.exercises.map((e) => ({
      ...e,
      demos: e.demos.filter((d) => !(d.kind === "media" && missing.has(d.mediaId))),
    }));
  }

  const d = document.data;
  return {
    ok: true,
    document,
    blobs,
    missingMedia: missing.size,
    summary: {
      sessions: d.sessions.length,
      sets: d.sessions.reduce((n, s) => n + s.exercises.reduce((k, e) => k + e.sets.length, 0), 0),
      consumptions: d.consumptions.length,
      ingredients: d.ingredients.length,
      recipes: d.recipes.length,
      bodyWeights: d.bodyWeights.length,
      exercises: d.exercises.length,
    },
  };
}

/** Fases 6–7 (tras confirmar): sustitución total en una transacción. Nunca fusiona. */
export async function commitImport(prepared: Extract<PreparedImport, { ok: true }>): Promise<void> {
  clearUndo();
  const db = await getDB();
  await replaceAll(db, prepared.document.data, { schemaVersion: SCHEMA_VERSION }, prepared.blobs);
  clearMediaUrlCache();
  setState(await loadAll(db));
  await seedCatalog();
  await seedMealMoments();
  await seedMeasurementTypes();
}
