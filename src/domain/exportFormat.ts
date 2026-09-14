// Documento de exportación: construcción y validación.
// Contrato: specs/001-gym-nutrition-tracker/contracts/export-format.md
import { SCHEMA_VERSION } from "./migrations.ts";
import type {
  AppData,
  DemoRef,
  Exercise,
  FoodRef,
  Ingredient,
  LocalDateTime,
  Result,
  ShoppingList,
} from "./types.ts";
import { DATA_KEYS } from "./types.ts";
import {
  isAmount,
  isBodyKg,
  isCm,
  isIntInRange,
  isLocalDate,
  isLocalDateTime,
  isLocalTime,
  isNameOfLength,
  isNutritionValue,
  isReps,
  isRir,
  isServings,
  isUuid,
  isWeightKg,
  normalizeName,
} from "./validation.ts";

export interface ExportDocument {
  format: "lastries";
  schemaVersion: number;
  exportedAt: LocalDateTime;
  appVersion: string;
  catalogVersion: string | null;
  data: AppData;
}

export interface ExportInfo {
  exportedAt: LocalDateTime;
  appVersion: string;
  catalogVersion: string | null;
}

const MEDIA_KEYS = ["id", "mimeType", "fileName", "byteSize"] as const;

/** Construye el documento con orden de claves estable. Omite `meta` y los Blobs. */
export function buildDocument(data: AppData, info: ExportInfo): ExportDocument {
  const out: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    if (key === "media") {
      out.media = data.media.map((m) => Object.fromEntries(MEDIA_KEYS.map((k) => [k, m[k]])));
    } else {
      out[key] = structuredClone(data[key]);
    }
  }
  return {
    format: "lastries",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: info.exportedAt,
    appVersion: info.appVersion,
    catalogVersion: info.catalogVersion,
    data: out as unknown as AppData,
  };
}

// ---------------------------------------------------------------------------
// Validación

type Obj = Record<string, unknown>;

class Checker {
  errors: string[] = [];

  add(path: string, reason: string) {
    this.errors.push(`${path}: ${reason}`);
  }

  /** Comprueba que v es un objeto con exactamente las claves dadas. */
  object(v: unknown, path: string, keys: readonly string[]): v is Obj {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      this.add(path, "debe ser un objeto");
      return false;
    }
    let ok = true;
    for (const k of Object.keys(v)) {
      if (!keys.includes(k)) {
        this.add(`${path}.${k}`, "clave desconocida");
        ok = false;
      }
    }
    for (const k of keys) {
      if (!(k in v)) {
        this.add(`${path}.${k}`, "falta");
        ok = false;
      }
    }
    return ok;
  }

  array(v: unknown, path: string): v is unknown[] {
    if (!Array.isArray(v)) {
      this.add(path, "debe ser una lista");
      return false;
    }
    return true;
  }

  check(cond: boolean, path: string, reason: string): boolean {
    if (!cond) this.add(path, reason);
    return cond;
  }
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isStrOrNull = (v: unknown) => v === null || isStr(v);

function nutrition(c: Checker, v: unknown, path: string, strictDecimals: boolean) {
  if (!c.object(v, path, ["kcal", "protein", "carbs", "fat"])) return;
  for (const k of ["kcal", "protein", "carbs", "fat"]) {
    const n = v[k];
    const ok = strictDecimals
      ? isNutritionValue(n)
      : typeof n === "number" && Number.isFinite(n) && n >= 0;
    c.check(ok, `${path}.${k}`, strictDecimals ? "debe ser ≥ 0, hasta 1 decimal" : "debe ser un número ≥ 0");
  }
}

function target(c: Checker, v: unknown, path: string) {
  if (!c.object(v, path, ["targetSets", "repsMin", "repsMax", "targetRir"])) return;
  c.check(isIntInRange(v.targetSets, 1, 20), `${path}.targetSets`, "debe ser entero 1–20");
  c.check(isIntInRange(v.repsMin, 1, 100), `${path}.repsMin`, "debe ser entero 1–100");
  c.check(
    Number.isInteger(v.repsMax) &&
      typeof v.repsMin === "number" &&
      (v.repsMax as number) >= v.repsMin &&
      (v.repsMax as number) <= 100,
    `${path}.repsMax`,
    "debe cumplir repsMin ≤ repsMax ≤ 100",
  );
  c.check(isIntInRange(v.targetRir, 0, 10), `${path}.targetRir`, "debe ser entero 0–10");
}

function foodRef(c: Checker, v: unknown, path: string, ids: IdSets) {
  if (typeof v !== "object" || v === null) {
    c.add(path, "debe ser un objeto");
    return;
  }
  const r = v as Obj;
  if (r.type === "ingredient") {
    if (!c.object(r, path, ["type", "ingredientId", "amount"])) return;
    c.check(ids.ingredients.has(r.ingredientId as string), `${path}.ingredientId`, "ingrediente inexistente");
    c.check(isAmount(r.amount), `${path}.amount`, "debe ser > 0 con hasta 1 decimal");
  } else if (r.type === "recipe") {
    if (!c.object(r, path, ["type", "recipeId", "servings"])) return;
    c.check(ids.recipes.has(r.recipeId as string), `${path}.recipeId`, "receta inexistente");
    c.check(isServings(r.servings), `${path}.servings`, "debe ser > 0 con hasta 2 decimales");
  } else {
    c.add(`${path}.type`, 'debe ser "ingredient" o "recipe"');
  }
}

type IdSets = Record<
  | "muscleGroups"
  | "exercises"
  | "media"
  | "routines"
  | "ingredients"
  | "recipes"
  | "mealMoments"
  | "plannedItems"
  | "measurementTypes",
  Set<unknown>
>;

function uniqueIds(c: Checker, list: unknown[], path: string, key = "id"): Set<unknown> {
  const seen = new Set<unknown>();
  list.forEach((item, i) => {
    if (typeof item !== "object" || item === null) return;
    const id = (item as Obj)[key];
    if (key === "id") c.check(isUuid(id), `${path}[${i}].id`, "debe ser un UUID");
    if (seen.has(id)) c.add(`${path}[${i}].${key}`, `id duplicado (${String(id)})`);
    seen.add(id);
  });
  return seen;
}

function uniqueBy(c: Checker, list: Obj[], path: string, field: string, norm: (v: unknown) => unknown) {
  const seen = new Set<unknown>();
  list.forEach((item, i) => {
    const key = norm(item[field]);
    if (seen.has(key)) c.add(`${path}[${i}].${field}`, "valor repetido");
    seen.add(key);
  });
}

const normStr = (v: unknown) => (isStr(v) ? normalizeName(v) : v);

const EXERCISE_KEYS = [
  "id", "source", "baseId", "originalName", "name", "primaryMuscleIds",
  "secondaryMuscleIds", "equipment", "demos", "archived",
] as const;

function validateData(c: Checker, data: Obj) {
  const p = "data";
  const lists: Partial<Record<keyof AppData, Obj[]>> = {};
  for (const key of DATA_KEYS) {
    if (key === "shoppingList") continue;
    const v = data[key];
    if (c.array(v, `${p}.${key}`)) {
      lists[key] = v.filter((x) => {
        if (typeof x === "object" && x !== null && !Array.isArray(x)) return true;
        c.add(`${p}.${key}`, "contiene un elemento que no es un objeto");
        return false;
      }) as Obj[];
    } else {
      lists[key] = [];
    }
  }
  const L = (k: keyof AppData) => lists[k] ?? [];

  const ids: IdSets = {
    muscleGroups: uniqueIds(c, L("muscleGroups"), `${p}.muscleGroups`),
    exercises: uniqueIds(c, L("exercises"), `${p}.exercises`),
    media: uniqueIds(c, L("media"), `${p}.media`),
    routines: uniqueIds(c, L("routines"), `${p}.routines`),
    ingredients: uniqueIds(c, L("ingredients"), `${p}.ingredients`),
    recipes: uniqueIds(c, L("recipes"), `${p}.recipes`),
    mealMoments: uniqueIds(c, L("mealMoments"), `${p}.mealMoments`),
    plannedItems: uniqueIds(c, L("plannedItems"), `${p}.plannedItems`),
    measurementTypes: uniqueIds(c, L("measurementTypes"), `${p}.measurementTypes`),
  };
  uniqueIds(c, L("sessions"), `${p}.sessions`);
  uniqueIds(c, L("consumptions"), `${p}.consumptions`);
  uniqueIds(c, L("goals"), `${p}.goals`);
  uniqueIds(c, L("bodyMeasurements"), `${p}.bodyMeasurements`);

  // MuscleGroup
  L("muscleGroups").forEach((m, i) => {
    const path = `${p}.muscleGroups[${i}]`;
    if (!c.object(m, path, ["id", "name", "baseKey"])) return;
    c.check(isNameOfLength(m.name, 1, 60), `${path}.name`, "debe tener 1–60 caracteres");
    c.check(isStrOrNull(m.baseKey), `${path}.baseKey`, "debe ser texto o null");
  });
  uniqueBy(c, L("muscleGroups"), `${p}.muscleGroups`, "name", normStr);

  // Media
  L("media").forEach((m, i) => {
    const path = `${p}.media[${i}]`;
    if (!c.object(m, path, MEDIA_KEYS)) return;
    c.check(
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(m.mimeType as string),
      `${path}.mimeType`,
      "tipo de imagen no admitido",
    );
    c.check(isStr(m.fileName) && m.fileName.length > 0 && !/[\\/]/.test(m.fileName), `${path}.fileName`, "nombre de fichero inválido");
    c.check(Number.isInteger(m.byteSize) && (m.byteSize as number) >= 0, `${path}.byteSize`, "debe ser entero ≥ 0");
  });

  // Exercise
  const baseIds = new Set<unknown>();
  L("exercises").forEach((e, i) => {
    const path = `${p}.exercises[${i}]`;
    if (!c.object(e, path, EXERCISE_KEYS)) return;
    const ex = e as unknown as Exercise;
    c.check(ex.source === "base" || ex.source === "user", `${path}.source`, 'debe ser "base" o "user"');
    if (ex.source === "base") {
      c.check(isStr(ex.baseId) && ex.baseId.length > 0, `${path}.baseId`, "obligatorio si source = base");
      c.check(!baseIds.has(ex.baseId), `${path}.baseId`, "baseId repetido");
      baseIds.add(ex.baseId);
      c.check(isStr(ex.originalName), `${path}.originalName`, "obligatorio si source = base");
    } else {
      c.check(ex.baseId === null, `${path}.baseId`, "debe ser null si source = user");
      c.check(ex.originalName === null, `${path}.originalName`, "debe ser null si source = user");
    }
    c.check(isNameOfLength(ex.name, 1, 120), `${path}.name`, "debe tener 1–120 caracteres");
    if (c.array(ex.primaryMuscleIds, `${path}.primaryMuscleIds`)) {
      c.check(ex.primaryMuscleIds.length >= 1, `${path}.primaryMuscleIds`, "debe tener al menos 1 elemento");
      c.check(new Set(ex.primaryMuscleIds).size === ex.primaryMuscleIds.length, `${path}.primaryMuscleIds`, "tiene repetidos");
      ex.primaryMuscleIds.forEach((id, j) =>
        c.check(ids.muscleGroups.has(id), `${path}.primaryMuscleIds[${j}]`, "grupo muscular inexistente"),
      );
    }
    if (c.array(ex.secondaryMuscleIds, `${path}.secondaryMuscleIds`)) {
      c.check(new Set(ex.secondaryMuscleIds).size === ex.secondaryMuscleIds.length, `${path}.secondaryMuscleIds`, "tiene repetidos");
      ex.secondaryMuscleIds.forEach((id, j) =>
        c.check(ids.muscleGroups.has(id), `${path}.secondaryMuscleIds[${j}]`, "grupo muscular inexistente"),
      );
      if (Array.isArray(ex.primaryMuscleIds)) {
        c.check(
          !ex.secondaryMuscleIds.some((id) => ex.primaryMuscleIds.includes(id)),
          `${path}.secondaryMuscleIds`,
          "debe ser disjunto de primaryMuscleIds",
        );
      }
    }
    c.check(isStrOrNull(ex.equipment), `${path}.equipment`, "debe ser texto o null");
    if (c.array(ex.demos, `${path}.demos`)) {
      (ex.demos as unknown[]).forEach((d, j) => {
        const dp = `${path}.demos[${j}]`;
        const kind = (d as Obj | null)?.kind;
        if (kind === "bundled") {
          if (c.object(d, dp, ["kind", "path"])) c.check(isStr((d as DemoRef & Obj).path), `${dp}.path`, "debe ser texto");
        } else if (kind === "media") {
          if (c.object(d, dp, ["kind", "mediaId"]))
            c.check(ids.media.has((d as Obj).mediaId), `${dp}.mediaId`, "medio inexistente");
        } else {
          c.add(`${dp}.kind`, 'debe ser "bundled" o "media"');
        }
      });
    }
    c.check(isBool(ex.archived), `${path}.archived`, "debe ser booleano");
  });

  // Routine
  L("routines").forEach((r, i) => {
    const path = `${p}.routines[${i}]`;
    if (!c.object(r, path, ["id", "name", "items"])) return;
    c.check(isNameOfLength(r.name, 1, 60), `${path}.name`, "debe tener 1–60 caracteres");
    if (c.array(r.items, `${path}.items`)) {
      r.items.forEach((it, j) => {
        const ip = `${path}.items[${j}]`;
        if (!c.object(it, ip, ["exerciseId", "targetSets", "repsMin", "repsMax", "targetRir"])) return;
        c.check(ids.exercises.has(it.exerciseId), `${ip}.exerciseId`, "ejercicio inexistente");
        const { exerciseId: _e, ...t } = it;
        target(c, t, ip);
      });
    }
  });

  // Session
  let inProgress = 0;
  L("sessions").forEach((s, i) => {
    const path = `${p}.sessions[${i}]`;
    if (!c.object(s, path, ["id", "routineId", "routineName", "date", "startedAt", "endedAt", "exercises"])) return;
    c.check(s.routineId === null || isUuid(s.routineId), `${path}.routineId`, "debe ser UUID o null");
    c.check(isStrOrNull(s.routineName), `${path}.routineName`, "debe ser texto o null");
    c.check(isLocalDate(s.date), `${path}.date`, "fecha inválida");
    c.check(isLocalDateTime(s.startedAt), `${path}.startedAt`, "fecha-hora inválida");
    c.check(s.endedAt === null || isLocalDateTime(s.endedAt), `${path}.endedAt`, "fecha-hora inválida o null");
    if (s.endedAt === null) inProgress++;
    if (!c.array(s.exercises, `${path}.exercises`)) return;
    s.exercises.forEach((se, j) => {
      const sp = `${path}.exercises[${j}]`;
      if (!c.object(se, sp, ["exerciseId", "target", "sets", "draft"])) return;
      c.check(ids.exercises.has(se.exerciseId), `${sp}.exerciseId`, "ejercicio inexistente");
      if (se.target !== null) target(c, se.target, `${sp}.target`);
      if (c.array(se.sets, `${sp}.sets`)) {
        se.sets.forEach((w, k) => {
          const wp = `${sp}.sets[${k}]`;
          if (!c.object(w, wp, ["weightKg", "reps", "rir", "failure", "warmup", "confirmedAt"])) return;
          c.check(isWeightKg(w.weightKg), `${wp}.weightKg`, "debe ser ≥ 0, hasta 2 decimales");
          c.check(isReps(w.reps), `${wp}.reps`, "debe ser entero ≥ 0");
          c.check(isRir(w.rir), `${wp}.rir`, "debe ser entero 0–10");
          c.check(isBool(w.failure), `${wp}.failure`, "debe ser booleano");
          c.check(!(w.failure === true && w.rir !== 0), wp, "una serie al fallo debe tener rir 0");
          c.check(isBool(w.warmup), `${wp}.warmup`, "debe ser booleano");
          c.check(isLocalDateTime(w.confirmedAt), `${wp}.confirmedAt`, "fecha-hora inválida");
        });
      }
      if (se.draft !== null) {
        const dp = `${sp}.draft`;
        const d = se.draft;
        if (c.object(d, dp, ["weightKg", "reps", "rir", "failure", "warmup", "updatedAt"])) {
          c.check(d.weightKg === null || isWeightKg(d.weightKg), `${dp}.weightKg`, "debe ser null o ≥ 0, hasta 2 decimales");
          c.check(d.reps === null || isReps(d.reps), `${dp}.reps`, "debe ser null o entero ≥ 0");
          c.check(d.rir === null || isRir(d.rir), `${dp}.rir`, "debe ser null o entero 0–10");
          c.check(isBool(d.failure), `${dp}.failure`, "debe ser booleano");
          c.check(isBool(d.warmup), `${dp}.warmup`, "debe ser booleano");
          c.check(isLocalDateTime(d.updatedAt), `${dp}.updatedAt`, "fecha-hora inválida");
        }
      }
    });
  });
  c.check(inProgress <= 1, `${p}.sessions`, "como máximo puede haber una sesión en curso (endedAt null)");

  // Ingredient
  L("ingredients").forEach((g, i) => {
    const path = `${p}.ingredients[${i}]`;
    const keys = ["id", "name", "baseUnit", "per100", "section", "purchaseFormat", "householdMeasures", "archived"];
    if (!c.object(g, path, keys)) return;
    const ing = g as unknown as Ingredient;
    c.check(isNameOfLength(ing.name, 1, 80), `${path}.name`, "debe tener 1–80 caracteres");
    c.check(ing.baseUnit === "g" || ing.baseUnit === "ml", `${path}.baseUnit`, 'debe ser "g" o "ml"');
    nutrition(c, ing.per100, `${path}.per100`, true);
    c.check(isStrOrNull(ing.section), `${path}.section`, "debe ser texto o null");
    if (ing.purchaseFormat !== null) {
      const fp = `${path}.purchaseFormat`;
      if (c.object(ing.purchaseFormat, fp, ["name", "amount"])) {
        c.check(isNameOfLength(ing.purchaseFormat.name, 1, 30), `${fp}.name`, "debe tener 1–30 caracteres");
        c.check(isAmount(ing.purchaseFormat.amount), `${fp}.amount`, "debe ser > 0 con hasta 1 decimal");
      }
    }
    if (c.array(ing.householdMeasures, `${path}.householdMeasures`)) {
      const names = new Set<string>();
      (ing.householdMeasures as unknown[]).forEach((hm, j) => {
        const hp = `${path}.householdMeasures[${j}]`;
        if (!c.object(hm, hp, ["name", "amount"])) return;
        if (c.check(isNameOfLength(hm.name, 1, 30), `${hp}.name`, "debe tener 1–30 caracteres")) {
          const n = normalizeName(hm.name as string);
          c.check(!names.has(n), `${hp}.name`, "nombre repetido dentro del ingrediente");
          names.add(n);
        }
        c.check(isAmount(hm.amount), `${hp}.amount`, "debe ser > 0 con hasta 1 decimal");
      });
    }
    c.check(isBool(ing.archived), `${path}.archived`, "debe ser booleano");
  });
  uniqueBy(c, L("ingredients"), `${p}.ingredients`, "name", normStr);

  // Recipe
  L("recipes").forEach((r, i) => {
    const path = `${p}.recipes[${i}]`;
    if (!c.object(r, path, ["id", "name", "baseServings", "lines", "steps", "archived"])) return;
    c.check(isNameOfLength(r.name, 1, 120), `${path}.name`, "debe tener 1–120 caracteres");
    c.check(isServings(r.baseServings), `${path}.baseServings`, "debe ser > 0 con hasta 2 decimales");
    if (c.array(r.lines, `${path}.lines`)) {
      c.check(r.lines.length >= 1, `${path}.lines`, "debe tener al menos 1 línea");
      r.lines.forEach((l, j) => {
        const lp = `${path}.lines[${j}]`;
        if (!c.object(l, lp, ["ingredientId", "amount"])) return;
        c.check(ids.ingredients.has(l.ingredientId), `${lp}.ingredientId`, "ingrediente inexistente");
        c.check(isAmount(l.amount), `${lp}.amount`, "debe ser > 0 con hasta 1 decimal");
      });
    }
    if (c.array(r.steps, `${path}.steps`)) {
      r.steps.forEach((st, j) => c.check(isStr(st), `${path}.steps[${j}]`, "debe ser texto"));
    }
    c.check(isBool(r.archived), `${path}.archived`, "debe ser booleano");
  });

  // MealMoment
  L("mealMoments").forEach((m, i) => {
    const path = `${p}.mealMoments[${i}]`;
    if (!c.object(m, path, ["id", "name", "startTime"])) return;
    c.check(isNameOfLength(m.name, 1, 30), `${path}.name`, "debe tener 1–30 caracteres");
    c.check(isLocalTime(m.startTime), `${path}.startTime`, "hora inválida (HH:MM)");
  });
  uniqueBy(c, L("mealMoments"), `${p}.mealMoments`, "name", normStr);
  uniqueBy(c, L("mealMoments"), `${p}.mealMoments`, "startTime", (v) => v);

  // PlannedItem
  L("plannedItems").forEach((it, i) => {
    const path = `${p}.plannedItems[${i}]`;
    if (!c.object(it, path, ["id", "date", "momentId", "ref"])) return;
    c.check(isLocalDate(it.date), `${path}.date`, "fecha inválida");
    c.check(ids.mealMoments.has(it.momentId), `${path}.momentId`, "momento inexistente");
    foodRef(c, it.ref as FoodRef, `${path}.ref`, ids);
  });

  // Consumption
  L("consumptions").forEach((it, i) => {
    const path = `${p}.consumptions[${i}]`;
    if (!c.object(it, path, ["id", "date", "momentId", "ref", "nutritionPerUnit", "plannedItemId", "createdAt"])) return;
    c.check(isLocalDate(it.date), `${path}.date`, "fecha inválida");
    c.check(ids.mealMoments.has(it.momentId), `${path}.momentId`, "momento inexistente");
    foodRef(c, it.ref as FoodRef, `${path}.ref`, ids);
    nutrition(c, it.nutritionPerUnit, `${path}.nutritionPerUnit`, false);
    c.check(
      it.plannedItemId === null || ids.plannedItems.has(it.plannedItemId),
      `${path}.plannedItemId`,
      "elemento planificado inexistente",
    );
    c.check(isLocalDateTime(it.createdAt), `${path}.createdAt`, "fecha-hora inválida");
  });

  // Goal
  L("goals").forEach((g, i) => {
    const path = `${p}.goals[${i}]`;
    if (!c.object(g, path, ["id", "effectiveFrom", "kcal", "protein", "carbs", "fat"])) return;
    c.check(isLocalDate(g.effectiveFrom), `${path}.effectiveFrom`, "fecha inválida");
    for (const k of ["kcal", "protein", "carbs", "fat"]) {
      c.check(g[k] === null || isNutritionValue(g[k]), `${path}.${k}`, "debe ser null o ≥ 0, hasta 1 decimal");
    }
  });
  uniqueBy(c, L("goals"), `${p}.goals`, "effectiveFrom", (v) => v);

  // ShoppingList
  const sl = data.shoppingList;
  if (sl !== null) {
    const path = `${p}.shoppingList`;
    if (c.object(sl, path, ["id", "from", "to", "generatedLines", "manualLines"])) {
      const list = sl as unknown as ShoppingList;
      c.check(list.id === "current", `${path}.id`, 'debe ser "current"');
      c.check(isLocalDate(list.from), `${path}.from`, "fecha inválida");
      c.check(isLocalDate(list.to), `${path}.to`, "fecha inválida");
      c.check(!(isLocalDate(list.from) && isLocalDate(list.to)) || list.from <= list.to, `${path}.to`, "debe ser ≥ from");
      if (c.array(list.generatedLines, `${path}.generatedLines`)) {
        const seen = new Set<unknown>();
        (list.generatedLines as unknown[]).forEach((l, j) => {
          const lp = `${path}.generatedLines[${j}]`;
          if (!c.object(l, lp, ["ingredientId", "requiredAmount", "packs", "purchased"])) return;
          c.check(ids.ingredients.has(l.ingredientId), `${lp}.ingredientId`, "ingrediente inexistente");
          c.check(!seen.has(l.ingredientId), `${lp}.ingredientId`, "ingrediente repetido en la lista");
          seen.add(l.ingredientId);
          c.check(typeof l.requiredAmount === "number" && Number.isFinite(l.requiredAmount) && l.requiredAmount > 0, `${lp}.requiredAmount`, "debe ser > 0");
          c.check(l.packs === null || (Number.isInteger(l.packs) && (l.packs as number) >= 1), `${lp}.packs`, "debe ser entero ≥ 1 o null");
          c.check(isBool(l.purchased), `${lp}.purchased`, "debe ser booleano");
        });
      }
      if (c.array(list.manualLines, `${path}.manualLines`)) {
        uniqueIds(c, list.manualLines as unknown[], `${path}.manualLines`);
        (list.manualLines as unknown[]).forEach((l, j) => {
          const lp = `${path}.manualLines[${j}]`;
          if (!c.object(l, lp, ["id", "text", "quantity", "purchased"])) return;
          c.check(isNameOfLength(l.text, 1, 120), `${lp}.text`, "debe tener 1–120 caracteres");
          c.check(isStrOrNull(l.quantity), `${lp}.quantity`, "debe ser texto o null");
          c.check(isBool(l.purchased), `${lp}.purchased`, "debe ser booleano");
        });
      }
    }
  }

  // BodyWeight
  uniqueIds(c, L("bodyWeights"), `${p}.bodyWeights`, "date");
  L("bodyWeights").forEach((w, i) => {
    const path = `${p}.bodyWeights[${i}]`;
    if (!c.object(w, path, ["date", "kg"])) return;
    c.check(isLocalDate(w.date), `${path}.date`, "fecha inválida");
    c.check(isBodyKg(w.kg), `${path}.kg`, "debe ser > 0 con 1 decimal");
  });

  // MeasurementType
  L("measurementTypes").forEach((t, i) => {
    const path = `${p}.measurementTypes[${i}]`;
    if (!c.object(t, path, ["id", "name", "order"])) return;
    c.check(isNameOfLength(t.name, 1, 30), `${path}.name`, "debe tener 1–30 caracteres");
    c.check(Number.isInteger(t.order), `${path}.order`, "debe ser entero");
  });
  uniqueBy(c, L("measurementTypes"), `${p}.measurementTypes`, "name", normStr);

  // BodyMeasurement
  L("bodyMeasurements").forEach((m, i) => {
    const path = `${p}.bodyMeasurements[${i}]`;
    if (!c.object(m, path, ["id", "typeId", "date", "cm"])) return;
    c.check(ids.measurementTypes.has(m.typeId), `${path}.typeId`, "tipo de medida inexistente");
    c.check(isLocalDate(m.date), `${path}.date`, "fecha inválida");
    c.check(isCm(m.cm), `${path}.cm`, "debe ser > 0 con 1 decimal");
  });
  const pairs = new Set<string>();
  L("bodyMeasurements").forEach((m, i) => {
    const key = `${String(m.typeId)}|${String(m.date)}`;
    c.check(!pairs.has(key), `${p}.bodyMeasurements[${i}]`, "ya existe una medida de ese tipo en esa fecha");
    pairs.add(key);
  });
}

/** Valida un documento ya migrado a SCHEMA_VERSION. No tiene efectos. */
export function validateDocument(input: unknown): Result<ExportDocument> {
  const c = new Checker();
  if (!c.object(input, "documento", ["format", "schemaVersion", "exportedAt", "appVersion", "catalogVersion", "data"])) {
    return { ok: false, errors: c.errors };
  }
  c.check(input.format === "lastries", "format", 'debe ser "lastries"');
  c.check(input.schemaVersion === SCHEMA_VERSION, "schemaVersion", `debe ser ${SCHEMA_VERSION}`);
  c.check(isLocalDateTime(input.exportedAt), "exportedAt", "fecha-hora inválida");
  c.check(isStr(input.appVersion), "appVersion", "debe ser texto");
  c.check(isStrOrNull(input.catalogVersion), "catalogVersion", "debe ser texto o null");
  if (c.object(input.data, "data", DATA_KEYS)) {
    validateData(c, input.data);
  }
  return c.errors.length === 0 ? { ok: true, value: input as unknown as ExportDocument } : { ok: false, errors: c.errors };
}
