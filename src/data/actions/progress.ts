// Peso y medidas corporales (FR-060 – FR-062).
import type { BodyMeasurement, BodyWeight, Id, LocalDate, MeasurementType } from "../../domain/types.ts";
import { isBodyKg, isCm, isLocalDate, isNameOfLength, normalizeName } from "../../domain/validation.ts";
import { ActionError, commit, getState, newId, removeWhere, upsert } from "../store.ts";

export async function setBodyWeight(date: LocalDate, kg: number): Promise<void> {
  if (!isLocalDate(date)) throw new ActionError("Fecha inválida");
  if (!isBodyKg(kg)) throw new ActionError("Peso: número > 0 con 1 decimal");
  const w: BodyWeight = { date, kg };
  await commit(["bodyWeights"], (tx) => tx.objectStore("bodyWeights").put(w).then(() => {}), (s) => ({
    ...s,
    bodyWeights: upsert(s.bodyWeights, w, (x) => x.date),
  }));
}

export async function deleteBodyWeight(date: LocalDate): Promise<void> {
  await commit(["bodyWeights"], (tx) => tx.objectStore("bodyWeights").delete(date), (s) => ({
    ...s,
    bodyWeights: removeWhere(s.bodyWeights, (w) => w.date === date),
  }));
}

export async function seedMeasurementTypes(): Promise<void> {
  if (getState().measurementTypes.length > 0) return;
  const types: MeasurementType[] = ["Cintura", "Cadera", "Pecho", "Brazo", "Muslo"].map((name, order) => ({ id: newId(), name, order }));
  await commit(
    ["measurementTypes"],
    async (tx) => {
      for (const t of types) await tx.objectStore("measurementTypes").put(t);
    },
    (s) => ({ ...s, measurementTypes: types }),
  );
}

export async function saveMeasurementType(id: Id | null, name: string): Promise<void> {
  if (!isNameOfLength(name, 1, 30)) throw new ActionError("El nombre debe tener entre 1 y 30 caracteres");
  const types = getState().measurementTypes;
  if (types.some((t) => t.id !== id && normalizeName(t.name) === normalizeName(name)))
    throw new ActionError("Ya existe un tipo con ese nombre");
  const old = id ? types.find((t) => t.id === id) : null;
  const t: MeasurementType = { id: id ?? newId(), name: name.trim(), order: old?.order ?? types.length };
  await commit(["measurementTypes"], (tx) => tx.objectStore("measurementTypes").put(t).then(() => {}), (s) => ({
    ...s,
    measurementTypes: upsert(s.measurementTypes, t, (x) => x.id),
  }));
}

export async function deleteMeasurementType(id: Id): Promise<void> {
  if (getState().bodyMeasurements.some((m) => m.typeId === id)) throw new ActionError("Este tipo tiene medidas registradas");
  await commit(["measurementTypes"], (tx) => tx.objectStore("measurementTypes").delete(id), (s) => ({
    ...s,
    measurementTypes: removeWhere(s.measurementTypes, (t) => t.id === id),
  }));
}

/** Registra una medida; si ya existe una de ese tipo en esa fecha, la sustituye. */
export async function setBodyMeasurement(typeId: Id, date: LocalDate, cm: number): Promise<void> {
  if (!getState().measurementTypes.some((t) => t.id === typeId)) throw new ActionError("Tipo de medida inexistente");
  if (!isLocalDate(date)) throw new ActionError("Fecha inválida");
  if (!isCm(cm)) throw new ActionError("Medida: número > 0 con 1 decimal");
  const existing = getState().bodyMeasurements.find((m) => m.typeId === typeId && m.date === date);
  const m: BodyMeasurement = { id: existing?.id ?? newId(), typeId, date, cm };
  await commit(["bodyMeasurements"], (tx) => tx.objectStore("bodyMeasurements").put(m).then(() => {}), (s) => ({
    ...s,
    bodyMeasurements: upsert(s.bodyMeasurements, m, (x) => x.id),
  }));
}

export async function deleteBodyMeasurement(id: Id): Promise<void> {
  await commit(["bodyMeasurements"], (tx) => tx.objectStore("bodyMeasurements").delete(id), (s) => ({
    ...s,
    bodyMeasurements: removeWhere(s.bodyMeasurements, (m) => m.id === id),
  }));
}
