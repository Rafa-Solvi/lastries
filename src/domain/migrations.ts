// Migraciones del documento de exportación (research R14).
//
// Reglas de mantenimiento (data-model.md, "Versionado y migraciones"):
// - Todo cambio en la forma de un registro incrementa SCHEMA_VERSION y añade exactamente una
//   migración `migrations[n]` que transforma un documento de la versión n a la n + 1.
// - Las migraciones existentes nunca se modifican ni se eliminan.
// - Cada migración tiene su documento de ejemplo tests/fixtures/schema-v<n>.json y un test.
// - Una migración nunca crea ni modifica el contenido binario de media; solo puede cambiar
//   metadatos o eliminar referencias.
//
// La misma cadena se usa al importar y al arrancar con datos de una versión anterior.
import type { ExportDocument } from "./exportFormat.ts";
import type { Result } from "./types.ts";

export const SCHEMA_VERSION = 1;

/** Documento de una versión cualquiera (antes de migrar su forma puede diferir de ExportDocument). */
export type AnyVersionDocument = { format: "lastries"; schemaVersion: number; [k: string]: unknown };

export const migrations: Record<number, (doc: AnyVersionDocument) => AnyVersionDocument> = {
  // 1: (doc) => ({ ...doc, schemaVersion: 2, data: ... }),
};

export function migrate(input: unknown): Result<ExportDocument> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["El documento no es un objeto"] };
  }
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { ok: false, errors: [`schemaVersion inválida: ${JSON.stringify(version)}`] };
  }
  if ((version as number) > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Exportado con una versión más reciente de la app (esquema ${version as number}; esta versión admite hasta ${SCHEMA_VERSION})`,
      ],
    };
  }
  let doc = structuredClone(input) as AnyVersionDocument;
  for (let v = version as number; v < SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, errors: [`Falta la migración del esquema ${v} al ${v + 1}`] };
    try {
      doc = step(doc);
    } catch (e) {
      return { ok: false, errors: [`La migración del esquema ${v} al ${v + 1} falló: ${String(e)}`] };
    }
    doc.schemaVersion = v + 1;
  }
  return { ok: true, value: doc as unknown as ExportDocument };
}
