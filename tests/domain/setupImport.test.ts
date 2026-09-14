import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planSetup, type SetupPlan } from "../../src/domain/setupImport.ts";
import { SETUP_TEMPLATE } from "../../src/domain/setupTemplate.ts";
import type { AppData, Exercise, MuscleGroup } from "../../src/domain/types.ts";
import { emptyData } from "../../src/domain/types.ts";

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const TODAY = "2026-09-14";

/** Estado con los grupos y algunos ejercicios del catálogo base, como tras la siembra. */
function seeded(): AppData {
  const catalog = JSON.parse(readFileSync(new URL("../../public/catalog/exercises.json", import.meta.url), "utf8")) as {
    muscles: { baseKey: string; name: string }[];
    exercises: { baseId: string; originalName: string; primary: string[]; secondary: string[]; equipment: string | null; images: string[] }[];
  };
  const groups: MuscleGroup[] = catalog.muscles.map((m) => ({ id: newId(), name: m.name, baseKey: m.baseKey }));
  const byKey = new Map(groups.map((g) => [g.baseKey, g.id]));
  const exercises: Exercise[] = catalog.exercises.map((e) => ({
    id: newId(),
    source: "base",
    baseId: e.baseId,
    originalName: e.originalName,
    name: e.originalName,
    primaryMuscleIds: e.primary.map((k) => byKey.get(k)!),
    secondaryMuscleIds: e.secondary.map((k) => byKey.get(k)!),
    equipment: e.equipment,
    demos: e.images.map((path) => ({ kind: "bundled" as const, path })),
    archived: false,
  }));
  return {
    ...emptyData(),
    muscleGroups: groups,
    exercises,
    mealMoments: [
      { id: newId(), name: "Desayuno", startTime: "07:00" },
      { id: newId(), name: "Comida", startTime: "13:00" },
      { id: newId(), name: "Merienda", startTime: "17:00" },
      { id: newId(), name: "Cena", startTime: "20:30" },
    ],
  };
}

const apply = (state: AppData, plan: SetupPlan): AppData => ({ ...state, ...plan.data });
const ok = (r: ReturnType<typeof planSetup>) => {
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.value;
};
const errorsOf = (r: ReturnType<typeof planSetup>) => (r.ok ? [] : r.errors).join("\n");

describe("planSetup con la plantilla", () => {
  it("crea todo lo de la plantilla sobre un estado recién sembrado", () => {
    const state = seeded();
    const plan = ok(planSetup(SETUP_TEMPLATE, state, TODAY, newId));
    expect(plan.summary.ejercicios).toEqual({ creados: 1, actualizados: 6 });
    expect(plan.summary.rutinas.creados).toBe(2);
    expect(plan.summary.ingredientes.creados).toBe(4);
    expect(plan.summary.recetas.creados).toBe(1);
    expect(plan.summary.gruposMusculares.creados).toBe(1);

    const next = apply(state, plan);
    const banca = next.exercises.find((e) => e.name === "Press banca")!;
    expect(banca.source).toBe("base");
    expect(banca.originalName).toBe("Barbell Bench Press - Medium Grip");
    expect(banca.demos.length).toBeGreaterThan(0);

    const torso = next.routines.find((r) => r.name === "Torso A")!;
    expect(torso.items[0]).toMatchObject({ exerciseId: banca.id, targetSets: 3, repsMin: 6, repsMax: 8, targetRir: 2 });
    const pierna = next.routines.find((r) => r.name === "Pierna A")!;
    expect(pierna.items[2]).toMatchObject({ repsMin: 10, repsMax: 10 });

    const rueda = next.exercises.find((e) => e.name === "Rueda abdominal")!;
    expect(rueda.source).toBe("user");
    const core = next.muscleGroups.find((g) => g.name === "Core")!;
    expect(rueda.primaryMuscleIds).toEqual([core.id]);

    const aceite = next.ingredients.find((i) => i.name === "Aceite de oliva virgen extra")!;
    expect(aceite.baseUnit).toBe("ml");
    expect(aceite.householdMeasures).toEqual([
      { name: "cucharada", amount: 13.5 },
      { name: "cucharadita", amount: 4.5 },
    ]);
    const receta = next.recipes.find((r) => r.name === "Arroz con pollo")!;
    expect(receta.lines).toHaveLength(3);

    expect(next.mealMoments.map((m) => `${m.name} ${m.startTime}`).sort()).toEqual([
      "Cena 21:00",
      "Comida 13:30",
      "Desayuno 07:00",
      "Merienda 17:30",
    ]);
    expect(next.goals).toEqual([expect.objectContaining({ effectiveFrom: "2026-09-14", kcal: 2500, carbs: null })]);
    expect(next.measurementTypes.map((t) => t.name)).toEqual(["Cintura", "Cadera", "Brazo"]);
  });

  it("volver a importar el mismo fichero no duplica nada (idempotente)", () => {
    const state = seeded();
    const once = apply(state, ok(planSetup(SETUP_TEMPLATE, state, TODAY, newId)));
    const plan2 = ok(planSetup(SETUP_TEMPLATE, once, TODAY, newId));
    const twice = apply(once, plan2);
    expect(plan2.summary.rutinas).toEqual({ creados: 0, actualizados: 2 });
    expect(plan2.summary.ingredientes).toEqual({ creados: 0, actualizados: 4 });
    expect(plan2.summary.ejercicios).toEqual({ creados: 0, actualizados: 7 });
    expect(twice.exercises).toHaveLength(once.exercises.length);
    expect(twice.routines).toHaveLength(2);
    expect(twice.ingredients).toHaveLength(4);
    expect(twice.muscleGroups).toHaveLength(once.muscleGroups.length);
  });
});

describe("planSetup: reglas", () => {
  const base = { formato: "lastries-configuracion", version: 1 };

  it("valida formato, versión y claves desconocidas", () => {
    expect(errorsOf(planSetup({ formato: "otro", version: 1 }, seeded(), TODAY, newId))).toContain("formato");
    expect(errorsOf(planSetup({ ...base, rutina: [] }, seeded(), TODAY, newId))).toContain("configuración.rutina: clave desconocida");
    expect(
      errorsOf(planSetup({ ...base, ingredientes: [{ nombre: "X", kcal: 1, proteinas: 1, hidratos: 1, grasas: 1, calorias: 3 }] }, seeded(), TODAY, newId)),
    ).toContain("ingredientes[0].calorias: clave desconocida");
  });

  it("encuentra grupos y nombres sin distinguir mayúsculas ni tildes", () => {
    const state = seeded();
    const plan = ok(planSetup({ ...base, ejercicios: [{ nombre: "Fondos", primarios: ["triceps"], secundarios: ["PECHO"] }] }, state, TODAY, newId));
    const fondos = plan.data.exercises.find((e) => e.name === "Fondos")!;
    expect(state.muscleGroups.find((g) => g.id === fondos.primaryMuscleIds[0])!.name).toBe("Tríceps");
  });

  it("errores por grupo desconocido, catálogo inexistente y ejercicio nuevo sin primarios", () => {
    const r = planSetup(
      {
        ...base,
        ejercicios: [
          { nombre: "A", primarios: ["Pectorales"] },
          { nombre: "B", catalogo: "No Existe" },
          { nombre: "C" },
        ],
      },
      seeded(),
      TODAY,
      newId,
    );
    const msg = errorsOf(r);
    expect(msg).toContain('ejercicios[0].primarios[0]: grupo muscular desconocido "Pectorales"');
    expect(msg).toContain("ejercicios[1].catalogo: no existe en el catálogo base");
    expect(msg).toContain("ejercicios[2].primarios: obligatorio");
  });

  it("las rutinas pueden usar ejercicios del catálogo por su nombre en inglés sin declararlos", () => {
    const plan = ok(
      planSetup({ ...base, rutinas: [{ nombre: "R", ejercicios: [{ ejercicio: "Leg Press", series: 3, repeticiones: [10, 12], rir: 2 }] }] }, seeded(), TODAY, newId),
    );
    expect(plan.data.routines[0]!.items[0]!.exerciseId).toBe(plan.data.exercises.find((e) => e.originalName === "Leg Press")!.id);
  });

  it("errores en rutinas y recetas con referencias o rangos inválidos", () => {
    const msg = errorsOf(
      planSetup(
        {
          ...base,
          rutinas: [{ nombre: "R", ejercicios: [{ ejercicio: "Inventado", series: 0, repeticiones: [9, 6], rir: 11 }] }],
          recetas: [{ nombre: "Tortilla", raciones: 2, ingredientes: [{ ingrediente: "Patata", cantidad: 300 }] }],
        },
        seeded(),
        TODAY,
        newId,
      ),
    );
    expect(msg).toContain('rutinas[0].ejercicios[0].ejercicio: ejercicio desconocido "Inventado"');
    expect(msg).toContain("rutinas[0].ejercicios[0].series");
    expect(msg).toContain("rutinas[0].ejercicios[0].repeticiones");
    expect(msg).toContain("rutinas[0].ejercicios[0].rir");
    expect(msg).toContain('recetas[0].ingredientes[0].ingrediente: ingrediente desconocido "Patata"');
  });

  it("nombres repetidos en el fichero son error", () => {
    const msg = errorsOf(planSetup({ ...base, tiposMedida: ["Cintura", "cintura"] }, seeded(), TODAY, newId));
    expect(msg).toContain("tiposMedida[1]: nombre repetido");
  });

  it("actualizar un ingrediente solo cambia los campos indicados", () => {
    const state = apply(seeded(), ok(planSetup(SETUP_TEMPLATE, seeded(), TODAY, newId)));
    const plan = ok(planSetup({ ...base, ingredientes: [{ nombre: "arroz blanco", kcal: 360 }] }, state, TODAY, newId));
    const arroz = plan.data.ingredients.find((i) => i.name === "arroz blanco")!;
    expect(arroz.per100).toEqual({ kcal: 360, protein: 7, carbs: 77, fat: 0.6 });
    expect(arroz.householdMeasures).toEqual([{ name: "vaso", amount: 180 }]);
    expect(plan.writes.ingredients).toHaveLength(1);
  });

  it("momentos: sustituye los no usados y conserva los usados con aviso", () => {
    const state = seeded();
    const merienda = state.mealMoments.find((m) => m.name === "Merienda")!;
    state.ingredients = [
      { id: newId(), name: "Yogur", baseUnit: "g", per100: { kcal: 60, protein: 4, carbs: 5, fat: 3 }, section: null, purchaseFormat: null, householdMeasures: [], archived: false },
    ];
    state.consumptions = [
      {
        id: newId(), date: TODAY, momentId: merienda.id, ref: { type: "ingredient", ingredientId: state.ingredients[0]!.id, amount: 125 },
        nutritionPerUnit: { kcal: 60, protein: 4, carbs: 5, fat: 3 }, plannedItemId: null, createdAt: `${TODAY}T17:30:00`,
      },
    ];
    const plan = ok(
      planSetup({ ...base, momentos: [{ nombre: "Desayuno", inicio: "08:00" }, { nombre: "Almuerzo", inicio: "14:00" }] }, state, TODAY, newId),
    );
    expect(plan.data.mealMoments.map((m) => m.name).sort()).toEqual(["Almuerzo", "Desayuno", "Merienda"]);
    expect(plan.deleteMealMoments).toHaveLength(2);
    expect(plan.warnings.join()).toContain("Merienda");
  });

  it("objetivos sin fecha usan hoy y los valores omitidos son null", () => {
    const plan = ok(planSetup({ ...base, objetivos: [{ kcal: 2200 }] }, seeded(), TODAY, newId));
    expect(plan.data.goals).toEqual([expect.objectContaining({ effectiveFrom: TODAY, kcal: 2200, protein: null, carbs: null, fat: null })]);
  });

  it("redondea cantidades y nutrientes a 1 decimal", () => {
    const plan = ok(
      planSetup({ ...base, ingredientes: [{ nombre: "Sal", kcal: 0, proteinas: 0, hidratos: 0, grasas: 0.04, medidas: [{ nombre: "pizca", cantidad: 0.55 }] }] }, seeded(), TODAY, newId),
    );
    const sal = plan.data.ingredients[0]!;
    expect(sal.per100.fat).toBe(0);
    expect(sal.householdMeasures[0]!.amount).toBe(0.6);
  });
});
