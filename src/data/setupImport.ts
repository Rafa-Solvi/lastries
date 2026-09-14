// Aplicación de la configuración inicial (contracts/setup-import.md): una sola transacción, nunca borra registros.
import { planSetup, type SetupCollection, type SetupPlan } from "../domain/setupImport.ts";
import { SETUP_TEMPLATE } from "../domain/setupTemplate.ts";
import type { Result } from "../domain/types.ts";
import { deliverFile } from "./exportImport.ts";
import { clearUndo, commit, getState, newId, todayLocal } from "./store.ts";

export async function prepareSetup(file: Blob): Promise<Result<SetupPlan>> {
  const text = (await file.text()).replace(/^﻿/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON no válido: ${e instanceof Error ? e.message : String(e)}`] };
  }
  return planSetup(parsed, getState(), todayLocal(), newId);
}

const COLLECTIONS: SetupCollection[] = [
  "muscleGroups",
  "exercises",
  "routines",
  "ingredients",
  "recipes",
  "mealMoments",
  "goals",
  "measurementTypes",
];

export async function commitSetup(plan: SetupPlan): Promise<void> {
  clearUndo();
  await commit(
    COLLECTIONS,
    async (tx) => {
      for (const c of COLLECTIONS) {
        const store = tx.objectStore(c);
        for (const row of plan.writes[c] as object[]) await store.put(row);
      }
      for (const id of plan.deleteMealMoments) await tx.objectStore("mealMoments").delete(id);
    },
    (s) => ({ ...s, ...plan.data }),
  );
}

export async function downloadSetupTemplate(): Promise<void> {
  const blob = new Blob([JSON.stringify(SETUP_TEMPLATE, null, 2) + "\n"], { type: "application/json" });
  await deliverFile(blob, "lastries-configuracion-plantilla.json");
}
