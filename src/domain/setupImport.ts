// Importación de configuración inicial escrita a mano (contracts/setup-import.md, FR-063).
// Todo se referencia por nombre (sin mayúsculas ni tildes). Crea o actualiza; nunca borra registros.
import { buildDocument, validateDocument } from "./exportFormat.ts";
import type {
  AppData,
  DemoRef,
  Exercise,
  Goal,
  HouseholdMeasure,
  Id,
  Ingredient,
  LocalDate,
  MealMoment,
  MeasurementType,
  MuscleGroup,
  Recipe,
  Result,
  Routine,
  RoutineItem,
} from "./types.ts";
import { isIntInRange, isLocalDate, isLocalTime, isNameOfLength, normalizeName } from "./validation.ts";

export const SETUP_FORMAT = "lastries-configuracion";
export const SETUP_VERSION = 1;

const SECTIONS = [
  "gruposMusculares",
  "ejercicios",
  "rutinas",
  "ingredientes",
  "recetas",
  "momentos",
  "objetivos",
  "tiposMedida",
] as const;
export type SetupSection = (typeof SECTIONS)[number];

export type SetupCollection =
  | "muscleGroups"
  | "exercises"
  | "routines"
  | "ingredients"
  | "recipes"
  | "mealMoments"
  | "goals"
  | "measurementTypes";

export interface SetupPlan {
  /** Colecciones afectadas tal como quedarán. */
  data: Pick<AppData, SetupCollection>;
  /** Registros a escribir por colección (creados o actualizados). */
  writes: { [K in SetupCollection]: AppData[K] };
  /** Momentos del día a eliminar (no usados y ausentes del fichero). */
  deleteMealMoments: Id[];
  summary: Record<SetupSection, { creados: number; actualizados: number }>;
  warnings: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

class Errors {
  list: string[] = [];
  add(path: string, msg: string) {
    this.list.push(`${path}: ${msg}`);
  }
  keys(v: Obj, path: string, allowed: readonly string[]) {
    for (const k of Object.keys(v)) if (!allowed.includes(k)) this.add(`${path}.${k}`, "clave desconocida");
  }
}

export function planSetup(input: unknown, current: AppData, today: LocalDate, newId: () => Id): Result<SetupPlan> {
  const e = new Errors();
  if (!isObj(input)) return { ok: false, errors: ["El fichero no es un objeto JSON"] };
  e.keys(input, "configuración", ["formato", "version", ...SECTIONS]);
  if (input.formato !== SETUP_FORMAT) e.add("formato", `debe ser "${SETUP_FORMAT}"`);
  if (input.version !== SETUP_VERSION) e.add("version", `debe ser ${SETUP_VERSION}`);
  if (e.list.length) return { ok: false, errors: e.list };

  const summary = Object.fromEntries(SECTIONS.map((s) => [s, { creados: 0, actualizados: 0 }])) as SetupPlan["summary"];
  const warnings: string[] = [];
  const touched: { [K in SetupCollection]: Set<Id> } = {
    muscleGroups: new Set(),
    exercises: new Set(),
    routines: new Set(),
    ingredients: new Set(),
    recipes: new Set(),
    mealMoments: new Set(),
    goals: new Set(),
    measurementTypes: new Set(),
  };

  const groups: MuscleGroup[] = structuredClone(current.muscleGroups);
  const exercises: Exercise[] = structuredClone(current.exercises);
  const routines: Routine[] = structuredClone(current.routines);
  const ingredients: Ingredient[] = structuredClone(current.ingredients);
  const recipes: Recipe[] = structuredClone(current.recipes);
  let moments: MealMoment[] = structuredClone(current.mealMoments);
  const goals: Goal[] = structuredClone(current.goals);
  const types: MeasurementType[] = structuredClone(current.measurementTypes);

  const upsertInto = <T extends { id: Id }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i === -1) list.push(item);
    else list[i] = item;
  };

  const section = (key: SetupSection): unknown[] | null => {
    const v = input[key];
    if (v === undefined) return null;
    if (!Array.isArray(v)) {
      e.add(key, "debe ser una lista");
      return null;
    }
    return v;
  };

  const checkDuplicates = (list: unknown[], key: SetupSection, getName: (x: unknown) => unknown) => {
    const seen = new Map<string, number>();
    list.forEach((x, i) => {
      const n = getName(x);
      if (!isStr(n)) return;
      const k = normalizeName(n);
      if (seen.has(k)) e.add(`${key}[${i}]`, `nombre repetido (también en ${key}[${seen.get(k)}])`);
      else seen.set(k, i);
    });
  };

  // ---------------------------------------------------------------- grupos musculares
  const groupByName = () => new Map(groups.map((g) => [normalizeName(g.name), g]));
  const gm = section("gruposMusculares");
  if (gm) {
    checkDuplicates(gm, "gruposMusculares", (x) => x);
    gm.forEach((name, i) => {
      const p = `gruposMusculares[${i}]`;
      if (!isNameOfLength(name, 1, 60)) return e.add(p, "debe ser un nombre de 1 a 60 caracteres");
      if (groupByName().has(normalizeName(name))) return;
      const g: MuscleGroup = { id: newId(), name: name.trim(), baseKey: null };
      groups.push(g);
      touched.muscleGroups.add(g.id);
      summary.gruposMusculares.creados++;
    });
  }

  const resolveGroups = (v: unknown, path: string): Id[] | null => {
    if (!Array.isArray(v)) {
      e.add(path, "debe ser una lista de nombres de grupos musculares");
      return null;
    }
    const byName = groupByName();
    const ids: Id[] = [];
    v.forEach((n, j) => {
      const g = isStr(n) ? byName.get(normalizeName(n)) : undefined;
      if (!g) e.add(`${path}[${j}]`, `grupo muscular desconocido "${String(n)}" (decláralo en gruposMusculares)`);
      else if (!ids.includes(g.id)) ids.push(g.id);
    });
    return ids;
  };

  // ---------------------------------------------------------------- ejercicios
  const fileExercises = new Map<string, Id>();
  const ej = section("ejercicios");
  if (ej) {
    checkDuplicates(ej, "ejercicios", (x) => (isObj(x) ? x.nombre : undefined));
    ej.forEach((raw, i) => {
      const p = `ejercicios[${i}]`;
      if (!isObj(raw)) return e.add(p, "debe ser un objeto");
      e.keys(raw, p, ["nombre", "catalogo", "primarios", "secundarios", "equipamiento"]);
      if (!isNameOfLength(raw.nombre, 1, 120)) return e.add(`${p}.nombre`, "obligatorio, de 1 a 120 caracteres");
      const name = (raw.nombre as string).trim();

      let target: Exercise | undefined;
      if (raw.catalogo !== undefined) {
        if (!isStr(raw.catalogo)) return e.add(`${p}.catalogo`, "debe ser el nombre en inglés o el id del catálogo");
        const key = normalizeName(raw.catalogo);
        target = exercises.find(
          (x) => x.source === "base" && (normalizeName(x.originalName ?? "") === key || normalizeName(x.baseId ?? "") === key),
        );
        if (!target) return e.add(`${p}.catalogo`, `no existe en el catálogo base: "${raw.catalogo}"`);
      } else {
        const matches = exercises.filter((x) => normalizeName(x.name) === normalizeName(name));
        if (matches.length > 1) return e.add(`${p}.nombre`, "hay varios ejercicios con este nombre; usa catalogo para indicar cuál");
        target = matches[0];
      }

      const primary = raw.primarios !== undefined ? resolveGroups(raw.primarios, `${p}.primarios`) : null;
      const secondary = raw.secundarios !== undefined ? resolveGroups(raw.secundarios, `${p}.secundarios`) : null;
      if (raw.equipamiento !== undefined && raw.equipamiento !== null && !isStr(raw.equipamiento))
        e.add(`${p}.equipamiento`, "debe ser texto o null");
      const equipment =
        raw.equipamiento === undefined ? undefined : isStr(raw.equipamiento) && raw.equipamiento.trim() ? raw.equipamiento.trim() : null;

      if (!target && (!primary || primary.length === 0)) {
        return e.add(`${p}.primarios`, "obligatorio (al menos 1) para un ejercicio nuevo; o usa catalogo");
      }

      const base: Exercise = target ?? {
        id: newId(),
        source: "user",
        baseId: null,
        originalName: null,
        name,
        primaryMuscleIds: [],
        secondaryMuscleIds: [],
        equipment: null,
        demos: [] as DemoRef[],
        archived: false,
      };
      const primaryIds = primary ?? base.primaryMuscleIds;
      const next: Exercise = {
        ...base,
        name,
        primaryMuscleIds: primaryIds,
        secondaryMuscleIds: (secondary ?? base.secondaryMuscleIds).filter((id) => !primaryIds.includes(id)),
        equipment: equipment === undefined ? base.equipment : equipment,
        archived: false,
      };
      if (next.primaryMuscleIds.length === 0) return e.add(`${p}.primarios`, "el ejercicio necesita al menos un grupo primario");
      upsertInto(exercises, next);
      touched.exercises.add(next.id);
      fileExercises.set(normalizeName(name), next.id);
      summary.ejercicios[target ? "actualizados" : "creados"]++;
    });
  }

  const resolveExercise = (v: unknown, path: string): Id | null => {
    if (!isStr(v)) {
      e.add(path, "debe ser el nombre de un ejercicio");
      return null;
    }
    const key = normalizeName(v);
    const fromFile = fileExercises.get(key);
    if (fromFile) return fromFile;
    const byName = exercises.filter((x) => normalizeName(x.name) === key);
    if (byName.length === 1) return byName[0]!.id;
    if (byName.length > 1) {
      e.add(path, `hay varios ejercicios llamados "${v}"; decláralo en ejercicios con catalogo`);
      return null;
    }
    const byOriginal = exercises.filter((x) => x.originalName && normalizeName(x.originalName) === key);
    if (byOriginal.length === 1) return byOriginal[0]!.id;
    e.add(path, `ejercicio desconocido "${v}"`);
    return null;
  };

  // ---------------------------------------------------------------- rutinas
  const ru = section("rutinas");
  if (ru) {
    checkDuplicates(ru, "rutinas", (x) => (isObj(x) ? x.nombre : undefined));
    ru.forEach((raw, i) => {
      const p = `rutinas[${i}]`;
      if (!isObj(raw)) return e.add(p, "debe ser un objeto");
      e.keys(raw, p, ["nombre", "ejercicios"]);
      if (!isNameOfLength(raw.nombre, 1, 60)) return e.add(`${p}.nombre`, "obligatorio, de 1 a 60 caracteres");
      if (!Array.isArray(raw.ejercicios)) return e.add(`${p}.ejercicios`, "debe ser una lista");
      const items: RoutineItem[] = [];
      raw.ejercicios.forEach((it, j) => {
        const ip = `${p}.ejercicios[${j}]`;
        if (!isObj(it)) return e.add(ip, "debe ser un objeto");
        e.keys(it, ip, ["ejercicio", "series", "repeticiones", "rir"]);
        const exerciseId = resolveExercise(it.ejercicio, `${ip}.ejercicio`);
        const reps = it.repeticiones;
        const [min, max] = Array.isArray(reps) ? reps : [reps, reps];
        if (!isIntInRange(it.series, 1, 20)) e.add(`${ip}.series`, "entero de 1 a 20");
        if (!isIntInRange(min, 1, 100) || !isIntInRange(max, 1, 100) || (min as number) > (max as number) || (Array.isArray(reps) && reps.length !== 2))
          e.add(`${ip}.repeticiones`, "entero de 1 a 100 o rango [mínimo, máximo]");
        if (!isIntInRange(it.rir, 0, 10)) e.add(`${ip}.rir`, "entero de 0 a 10");
        if (exerciseId)
          items.push({
            exerciseId,
            targetSets: it.series as number,
            repsMin: min as number,
            repsMax: max as number,
            targetRir: it.rir as number,
          });
      });
      const name = (raw.nombre as string).trim();
      const existing = routines.find((r) => normalizeName(r.name) === normalizeName(name));
      const r: Routine = { id: existing?.id ?? newId(), name, items };
      upsertInto(routines, r);
      touched.routines.add(r.id);
      summary.rutinas[existing ? "actualizados" : "creados"]++;
    });
  }

  // ---------------------------------------------------------------- ingredientes
  const ing = section("ingredientes");
  if (ing) {
    checkDuplicates(ing, "ingredientes", (x) => (isObj(x) ? x.nombre : undefined));
    ing.forEach((raw, i) => {
      const p = `ingredientes[${i}]`;
      if (!isObj(raw)) return e.add(p, "debe ser un objeto");
      e.keys(raw, p, ["nombre", "unidad", "kcal", "proteinas", "hidratos", "grasas", "seccion", "formatoCompra", "medidas"]);
      if (!isNameOfLength(raw.nombre, 1, 80)) return e.add(`${p}.nombre`, "obligatorio, de 1 a 80 caracteres");
      const name = (raw.nombre as string).trim();
      const existing = ingredients.find((x) => normalizeName(x.name) === normalizeName(name));

      if (raw.unidad !== undefined && raw.unidad !== "g" && raw.unidad !== "ml") e.add(`${p}.unidad`, 'debe ser "g" o "ml"');
      const per100 = { ...(existing?.per100 ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }) };
      for (const [key, field] of [
        ["kcal", "kcal"],
        ["proteinas", "protein"],
        ["hidratos", "carbs"],
        ["grasas", "fat"],
      ] as const) {
        const v = raw[key];
        if (v === undefined) {
          if (!existing) e.add(`${p}.${key}`, "obligatorio para un ingrediente nuevo (por 100 g o 100 ml)");
          continue;
        }
        if (!isNum(v) || v < 0) e.add(`${p}.${key}`, "número ≥ 0");
        else per100[field] = round(v, 1);
      }

      let purchaseFormat = existing?.purchaseFormat ?? null;
      if (raw.formatoCompra !== undefined) {
        if (raw.formatoCompra === null) purchaseFormat = null;
        else if (!isObj(raw.formatoCompra)) e.add(`${p}.formatoCompra`, "objeto { nombre, cantidad } o null");
        else {
          e.keys(raw.formatoCompra, `${p}.formatoCompra`, ["nombre", "cantidad"]);
          const f = raw.formatoCompra;
          if (!isNameOfLength(f.nombre, 1, 30)) e.add(`${p}.formatoCompra.nombre`, "de 1 a 30 caracteres");
          if (!isNum(f.cantidad) || f.cantidad <= 0) e.add(`${p}.formatoCompra.cantidad`, "número > 0");
          else if (isStr(f.nombre)) purchaseFormat = { name: f.nombre.trim(), amount: round(f.cantidad, 1) };
        }
      }

      let measures: HouseholdMeasure[] = existing?.householdMeasures ?? [];
      if (raw.medidas !== undefined) {
        if (!Array.isArray(raw.medidas)) e.add(`${p}.medidas`, "debe ser una lista");
        else {
          const seen = new Set<string>();
          measures = [];
          raw.medidas.forEach((m, j) => {
            const mp = `${p}.medidas[${j}]`;
            if (!isObj(m)) return e.add(mp, "debe ser un objeto { nombre, cantidad }");
            e.keys(m, mp, ["nombre", "cantidad"]);
            if (!isNameOfLength(m.nombre, 1, 30)) return e.add(`${mp}.nombre`, "de 1 a 30 caracteres, en singular");
            const k = normalizeName(m.nombre as string);
            if (seen.has(k)) return e.add(`${mp}.nombre`, "medida repetida");
            seen.add(k);
            if (!isNum(m.cantidad) || m.cantidad <= 0) return e.add(`${mp}.cantidad`, "número > 0");
            measures.push({ name: (m.nombre as string).trim(), amount: round(m.cantidad, 1) });
          });
        }
      }

      if (raw.seccion !== undefined && raw.seccion !== null && !isStr(raw.seccion)) e.add(`${p}.seccion`, "texto o null");
      const section = raw.seccion === undefined ? (existing?.section ?? null) : isStr(raw.seccion) && raw.seccion.trim() ? raw.seccion.trim() : null;

      const next: Ingredient = {
        id: existing?.id ?? newId(),
        name,
        baseUnit: (raw.unidad as "g" | "ml" | undefined) ?? existing?.baseUnit ?? "g",
        per100,
        section,
        purchaseFormat,
        householdMeasures: measures,
        archived: false,
      };
      upsertInto(ingredients, next);
      touched.ingredients.add(next.id);
      summary.ingredientes[existing ? "actualizados" : "creados"]++;
    });
  }

  // ---------------------------------------------------------------- recetas
  const rec = section("recetas");
  if (rec) {
    checkDuplicates(rec, "recetas", (x) => (isObj(x) ? x.nombre : undefined));
    rec.forEach((raw, i) => {
      const p = `recetas[${i}]`;
      if (!isObj(raw)) return e.add(p, "debe ser un objeto");
      e.keys(raw, p, ["nombre", "raciones", "ingredientes", "pasos"]);
      if (!isNameOfLength(raw.nombre, 1, 120)) return e.add(`${p}.nombre`, "obligatorio, de 1 a 120 caracteres");
      const name = (raw.nombre as string).trim();
      const existing = recipes.find((x) => normalizeName(x.name) === normalizeName(name));

      let baseServings = existing?.baseServings;
      if (raw.raciones !== undefined) {
        if (!isNum(raw.raciones) || raw.raciones <= 0) e.add(`${p}.raciones`, "número > 0");
        else baseServings = round(raw.raciones, 2);
      } else if (!existing) e.add(`${p}.raciones`, "obligatorio para una receta nueva");

      let lines = existing?.lines ?? [];
      if (raw.ingredientes !== undefined) {
        if (!Array.isArray(raw.ingredientes) || raw.ingredientes.length === 0) e.add(`${p}.ingredientes`, "lista con al menos un ingrediente");
        else {
          lines = [];
          raw.ingredientes.forEach((l, j) => {
            const lp = `${p}.ingredientes[${j}]`;
            if (!isObj(l)) return e.add(lp, "debe ser un objeto { ingrediente, cantidad }");
            e.keys(l, lp, ["ingrediente", "cantidad"]);
            const found = isStr(l.ingrediente)
              ? ingredients.find((x) => normalizeName(x.name) === normalizeName(l.ingrediente as string))
              : undefined;
            if (!found) return e.add(`${lp}.ingrediente`, `ingrediente desconocido "${String(l.ingrediente)}"`);
            if (!isNum(l.cantidad) || l.cantidad <= 0) return e.add(`${lp}.cantidad`, `número > 0 en ${found.baseUnit}`);
            lines.push({ ingredientId: found.id, amount: round(l.cantidad, 1) });
          });
        }
      } else if (!existing) e.add(`${p}.ingredientes`, "obligatorio para una receta nueva");

      let steps = existing?.steps ?? [];
      if (raw.pasos !== undefined) {
        if (!Array.isArray(raw.pasos) || raw.pasos.some((s) => !isStr(s))) e.add(`${p}.pasos`, "lista de textos");
        else steps = (raw.pasos as string[]).map((s) => s.trim()).filter(Boolean);
      }

      if (baseServings === undefined) return;
      const next: Recipe = { id: existing?.id ?? newId(), name, baseServings, lines, steps, archived: false };
      upsertInto(recipes, next);
      touched.recipes.add(next.id);
      summary.recetas[existing ? "actualizados" : "creados"]++;
    });
  }

  // ---------------------------------------------------------------- momentos del día
  const deleteMealMoments: Id[] = [];
  const mo = section("momentos");
  if (mo) {
    checkDuplicates(mo, "momentos", (x) => (isObj(x) ? x.nombre : undefined));
    const keep = new Set<Id>();
    mo.forEach((raw, i) => {
      const p = `momentos[${i}]`;
      if (!isObj(raw)) return e.add(p, "debe ser un objeto { nombre, inicio }");
      e.keys(raw, p, ["nombre", "inicio"]);
      if (!isNameOfLength(raw.nombre, 1, 30)) return e.add(`${p}.nombre`, "obligatorio, de 1 a 30 caracteres");
      if (!isLocalTime(raw.inicio)) return e.add(`${p}.inicio`, 'hora "HH:MM"');
      const name = (raw.nombre as string).trim();
      const existing = moments.find((m) => normalizeName(m.name) === normalizeName(name));
      const next: MealMoment = { id: existing?.id ?? newId(), name, startTime: raw.inicio as string };
      upsertInto(moments, next);
      touched.mealMoments.add(next.id);
      keep.add(next.id);
      summary.momentos[existing ? "actualizados" : "creados"]++;
    });
    const used = (id: Id) => current.plannedItems.some((x) => x.momentId === id) || current.consumptions.some((x) => x.momentId === id);
    moments = moments.filter((m) => {
      if (keep.has(m.id)) return true;
      if (used(m.id)) {
        warnings.push(`Se conserva el momento "${m.name}" porque tiene registros o planificación.`);
        return true;
      }
      deleteMealMoments.push(m.id);
      return false;
    });
    const times = new Map<string, string>();
    for (const m of moments) {
      const other = times.get(m.startTime);
      if (other) e.add("momentos", `"${m.name}" y "${other}" empiezan a la misma hora (${m.startTime})`);
      times.set(m.startTime, m.name);
    }
  }

  // ---------------------------------------------------------------- objetivos
  const ob = section("objetivos");
  if (ob) {
    const dates = new Set<string>();
    ob.forEach((raw, i) => {
      const p = `objetivos[${i}]`;
      if (!isObj(raw)) return e.add(p, "debe ser un objeto");
      e.keys(raw, p, ["desde", "kcal", "proteinas", "hidratos", "grasas"]);
      const from = raw.desde === undefined ? today : raw.desde;
      if (!isLocalDate(from)) return e.add(`${p}.desde`, 'fecha "AAAA-MM-DD"');
      if (dates.has(from)) return e.add(`${p}.desde`, "fecha repetida");
      dates.add(from);
      const value = (key: string): number | null => {
        const v = raw[key];
        if (v === undefined || v === null) return null;
        if (!isNum(v) || v < 0) {
          e.add(`${p}.${key}`, "número ≥ 0 o null");
          return null;
        }
        return round(v, 1);
      };
      const existing = goals.find((g) => g.effectiveFrom === from);
      const g: Goal = {
        id: existing?.id ?? newId(),
        effectiveFrom: from,
        kcal: value("kcal"),
        protein: value("proteinas"),
        carbs: value("hidratos"),
        fat: value("grasas"),
      };
      upsertInto(goals, g);
      touched.goals.add(g.id);
      summary.objetivos[existing ? "actualizados" : "creados"]++;
    });
  }

  // ---------------------------------------------------------------- tipos de medida
  const tm = section("tiposMedida");
  if (tm) {
    checkDuplicates(tm, "tiposMedida", (x) => x);
    tm.forEach((name, i) => {
      if (!isNameOfLength(name, 1, 30)) return e.add(`tiposMedida[${i}]`, "nombre de 1 a 30 caracteres");
      if (types.some((t) => normalizeName(t.name) === normalizeName(name))) return;
      const t: MeasurementType = { id: newId(), name: name.trim(), order: types.length };
      types.push(t);
      touched.measurementTypes.add(t.id);
      summary.tiposMedida.creados++;
    });
  }

  if (e.list.length) return { ok: false, errors: e.list };

  const data: SetupPlan["data"] = {
    muscleGroups: groups,
    exercises,
    routines,
    ingredients,
    recipes,
    mealMoments: moments,
    goals,
    measurementTypes: types,
  };

  // Comprobación final de integridad con las mismas reglas que la importación completa.
  const check = validateDocument(
    JSON.parse(JSON.stringify(buildDocument({ ...current, ...data }, { exportedAt: `${today}T00:00:00`, appVersion: "setup", catalogVersion: null }))),
  );
  if (!check.ok) return { ok: false, errors: check.errors.map((x) => `resultado no válido: ${x}`) };

  const pick = <K extends SetupCollection>(k: K) => (data[k] as { id: Id }[]).filter((x) => touched[k].has(x.id)) as AppData[K];
  return {
    ok: true,
    value: {
      data,
      writes: {
        muscleGroups: pick("muscleGroups"),
        exercises: pick("exercises"),
        routines: pick("routines"),
        ingredients: pick("ingredients"),
        recipes: pick("recipes"),
        mealMoments: pick("mealMoments"),
        goals: pick("goals"),
        measurementTypes: pick("measurementTypes"),
      },
      deleteMealMoments,
      summary,
      warnings,
    },
  };
}
