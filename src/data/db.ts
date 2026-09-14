// IndexedDB: apertura, carga completa, sustitución y migración de arranque.
// data-model.md "Almacenes" y "Versionado y migraciones"; research R3, R14.
import { openDB, type IDBPDatabase, type IDBPTransaction } from "idb";
import { toLocalDateTime } from "../domain/dates.ts";
import { buildDocument, validateDocument } from "../domain/exportFormat.ts";
import { migrate, SCHEMA_VERSION } from "../domain/migrations.ts";
import type { AppData, AppState, Id, Media, Meta } from "../domain/types.ts";
import { ARRAY_COLLECTIONS, emptyMeta } from "../domain/types.ts";

export const DB_NAME = "lastries";
export const DB_VERSION = 1;

export const STORE_NAMES = [
  "meta",
  "muscleGroups",
  "exercises",
  "media",
  "routines",
  "sessions",
  "ingredients",
  "recipes",
  "mealMoments",
  "plannedItems",
  "consumptions",
  "goals",
  "shoppingList",
  "bodyWeights",
  "measurementTypes",
  "bodyMeasurements",
] as const;

export type StoreName = (typeof STORE_NAMES)[number];
export type Tx = IDBPTransaction<unknown, StoreName[], "readwrite">;

const KEY_PATHS: Record<StoreName, string> = {
  meta: "key",
  bodyWeights: "date",
  shoppingList: "id",
  muscleGroups: "id",
  exercises: "id",
  media: "id",
  routines: "id",
  sessions: "id",
  ingredients: "id",
  recipes: "id",
  mealMoments: "id",
  plannedItems: "id",
  consumptions: "id",
  goals: "id",
  measurementTypes: "id",
  bodyMeasurements: "id",
};

export interface StoredMedia extends Media {
  blob: Blob;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      // Solo crea almacenes que falten; nunca transforma datos.
      upgrade(db) {
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: KEY_PATHS[name] });
          }
        }
      },
    });
  }
  return dbPromise;
}

const META_KEYS: (keyof Meta)[] = [
  "schemaVersion",
  "catalogVersion",
  "lastExportAt",
  "persistGranted",
  "preMigrationBackup",
];

export async function readMeta(db: IDBPDatabase): Promise<Meta> {
  const meta = emptyMeta();
  const rows = (await db.getAll("meta")) as { key: keyof Meta; value: unknown }[];
  for (const row of rows) {
    if (META_KEYS.includes(row.key)) (meta as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  return meta;
}

export async function writeMeta(tx: Tx | IDBPDatabase, patch: Partial<Meta>): Promise<void> {
  const store = "objectStore" in tx ? (tx as Tx).objectStore("meta") : null;
  for (const [key, value] of Object.entries(patch)) {
    if (store) await store.put({ key, value });
    else await (tx as IDBPDatabase).put("meta", { key, value });
  }
}

/** Lee todos los almacenes. Los Blobs de media no se cargan en memoria (solo metadatos). */
export async function loadAll(db: IDBPDatabase): Promise<AppState> {
  const tx = db.transaction([...STORE_NAMES], "readonly");
  const out: Record<string, unknown> = {};
  for (const name of ARRAY_COLLECTIONS) {
    if (name === "media") {
      const rows = (await tx.objectStore("media").getAll()) as StoredMedia[];
      out.media = rows.map(({ blob: _blob, ...m }) => m);
    } else {
      out[name] = await tx.objectStore(name).getAll();
    }
  }
  out.shoppingList = (await tx.objectStore("shoppingList").get("current")) ?? null;
  await tx.done;
  const meta = await readMeta(db);
  return { ...(out as unknown as AppData), meta };
}

/**
 * Sustituye todos los datos en una única transacción.
 * - Con `mediaBlobs` (importación): escribe esos Blobs.
 * - Sin `mediaBlobs`: conserva el Blob ya guardado de cada Media por id y borra solo los Media
 *   ausentes de `data`. Nunca deja un Media sin Blob.
 */
export async function replaceAll(
  db: IDBPDatabase,
  data: AppData,
  metaPatch: Partial<Meta>,
  mediaBlobs?: Map<Id, Blob>,
): Promise<void> {
  const tx = db.transaction([...STORE_NAMES], "readwrite") as unknown as Tx;
  for (const name of ARRAY_COLLECTIONS) {
    if (name === "media") continue;
    const store = tx.objectStore(name);
    await store.clear();
    for (const row of data[name] as object[]) await store.put(row);
  }
  const sl = tx.objectStore("shoppingList");
  await sl.clear();
  if (data.shoppingList) await sl.put(data.shoppingList);

  const mediaStore = tx.objectStore("media");
  if (mediaBlobs) {
    await mediaStore.clear();
    for (const m of data.media) {
      const blob = mediaBlobs.get(m.id);
      if (blob) await mediaStore.put({ ...m, blob });
    }
  } else {
    const existing = (await mediaStore.getAll()) as StoredMedia[];
    const byId = new Map(existing.map((m) => [m.id, m]));
    const keep = new Set(data.media.map((m) => m.id));
    for (const old of existing) if (!keep.has(old.id)) await mediaStore.delete(old.id);
    for (const m of data.media) {
      const old = byId.get(m.id);
      if (old) await mediaStore.put({ ...m, blob: old.blob });
    }
  }
  await writeMeta(tx, metaPatch);
  await tx.done;
}

export type StartupResult =
  | { ok: true }
  | { ok: false; reason: string; backupDocument: string | null };

/** Migración de arranque (data-model.md "Versionado y migraciones"). */
export async function startupMigrate(db: IDBPDatabase, appVersion: string): Promise<StartupResult> {
  const meta = await readMeta(db);
  const stored = meta.schemaVersion;
  if (stored === SCHEMA_VERSION) return { ok: true };
  if (stored === null) {
    await writeMeta(db, { schemaVersion: SCHEMA_VERSION });
    return { ok: true };
  }

  const state = await loadAll(db);
  const now = toLocalDateTime(new Date());
  const doc = buildDocument(state, { exportedAt: now, appVersion, catalogVersion: meta.catalogVersion });
  (doc as { schemaVersion: number }).schemaVersion = stored;
  const serialized = JSON.stringify(doc, null, 2);

  if (stored > SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `Los datos guardados son de una versión más reciente de la app (esquema ${stored}; esta versión usa el ${SCHEMA_VERSION}). No se ha modificado nada.`,
      backupDocument: serialized,
    };
  }

  // (2) copia previa
  await writeMeta(db, { preMigrationBackup: { fromVersion: stored, createdAt: now, document: serialized } });
  try {
    // (3) migrar
    const migrated = migrate(JSON.parse(serialized));
    if (!migrated.ok) throw new Error(migrated.errors.join("\n"));
    // (4) validar
    const valid = validateDocument(migrated.value);
    if (!valid.ok) throw new Error(valid.errors.slice(0, 20).join("\n"));
    // (5) sustituir conservando los Blobs de medios
    await replaceAll(db, valid.value.data, { schemaVersion: SCHEMA_VERSION });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: `No se pudo migrar los datos del esquema ${stored} al ${SCHEMA_VERSION}. No se ha modificado ningún dato.\n${e instanceof Error ? e.message : String(e)}`,
      backupDocument: serialized,
    };
  }
}

export async function getMediaBlob(id: Id): Promise<Blob | null> {
  const db = await getDB();
  const row = (await db.get("media", id)) as StoredMedia | undefined;
  return row?.blob ?? null;
}
