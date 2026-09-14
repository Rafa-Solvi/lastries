// Siembra del catálogo base empaquetado (FR-010, FR-013; research R6).
// Solo inserta lo que falta; nunca modifica ejercicios existentes.
import type { Exercise, MuscleGroup } from "../domain/types.ts";
import { commit, getState, newId } from "./store.ts";

interface CatalogFile {
  catalogVersion: string;
  muscles: { baseKey: string; name: string }[];
  exercises: {
    baseId: string;
    originalName: string;
    primary: string[];
    secondary: string[];
    equipment: string | null;
    images: string[];
  }[];
}

export async function seedCatalog(): Promise<void> {
  const state = getState();
  let catalog: CatalogFile;
  try {
    const res = await fetch("./catalog/exercises.json");
    if (!res.ok) return;
    catalog = (await res.json()) as CatalogFile;
  } catch {
    return;
  }

  const existingBaseIds = new Set(state.exercises.map((e) => e.baseId).filter(Boolean));
  if (
    state.meta.catalogVersion === catalog.catalogVersion &&
    catalog.exercises.every((e) => existingBaseIds.has(e.baseId))
  ) {
    return;
  }

  const groupByKey = new Map(state.muscleGroups.filter((g) => g.baseKey).map((g) => [g.baseKey!, g]));
  const newGroups: MuscleGroup[] = [];
  for (const m of catalog.muscles) {
    if (!groupByKey.has(m.baseKey)) {
      const g: MuscleGroup = { id: newId(), name: m.name, baseKey: m.baseKey };
      // Si el usuario ya creó un grupo con ese nombre, se reutiliza para no duplicar nombres.
      const sameName = state.muscleGroups.find((x) => x.name.toLowerCase() === m.name.toLowerCase());
      if (sameName) groupByKey.set(m.baseKey, sameName);
      else {
        newGroups.push(g);
        groupByKey.set(m.baseKey, g);
      }
    }
  }

  const newExercises: Exercise[] = catalog.exercises
    .filter((e) => !existingBaseIds.has(e.baseId))
    .map((e) => {
      const primary = e.primary.map((k) => groupByKey.get(k)!.id);
      const secondary = e.secondary.map((k) => groupByKey.get(k)!.id).filter((id) => !primary.includes(id));
      return {
        id: newId(),
        source: "base",
        baseId: e.baseId,
        originalName: e.originalName,
        name: e.originalName,
        primaryMuscleIds: [...new Set(primary)],
        secondaryMuscleIds: [...new Set(secondary)],
        equipment: e.equipment,
        demos: e.images.map((path) => ({ kind: "bundled" as const, path })),
        archived: false,
      };
    });

  await commit(
    ["muscleGroups", "exercises", "meta"],
    async (tx) => {
      for (const g of newGroups) await tx.objectStore("muscleGroups").put(g);
      for (const e of newExercises) await tx.objectStore("exercises").put(e);
      await tx.objectStore("meta").put({ key: "catalogVersion", value: catalog.catalogVersion });
    },
    (s) => ({
      ...s,
      muscleGroups: [...s.muscleGroups, ...newGroups],
      exercises: [...s.exercises, ...newExercises],
      meta: { ...s.meta, catalogVersion: catalog.catalogVersion },
    }),
  );
}
