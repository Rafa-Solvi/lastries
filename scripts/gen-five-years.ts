// Genera una exportación sintética de 5 años para medir rendimiento (SC-010).
// Uso: node scripts/gen-five-years.ts  → tests/fixtures/five-years.json (no versionado)
import { randomUUID as uuid } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { addDays, weekStart } from "../src/domain/dates.ts";
import { buildDocument, validateDocument } from "../src/domain/exportFormat.ts";
import type {
  AppData,
  BodyWeight,
  Consumption,
  Exercise,
  Ingredient,
  MealMoment,
  MuscleGroup,
  Recipe,
  Routine,
  Session,
  WorkSet,
} from "../src/domain/types.ts";

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

const START = "2021-09-13"; // lunes
const DAYS = 5 * 365;

const groups: MuscleGroup[] = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos", "Abdominales"].map(
  (name) => ({ id: uuid(), name, baseKey: null }),
);
const exercises: Exercise[] = Array.from({ length: 40 }, (_, i) => {
  const primary = pick(groups).id;
  const secondary = groups.filter((g) => g.id !== primary && rand() < 0.2).map((g) => g.id);
  return {
    id: uuid(), source: "user", baseId: null, originalName: null, name: `Ejercicio ${i + 1}`,
    primaryMuscleIds: [primary], secondaryMuscleIds: secondary, equipment: null, demos: [], archived: false,
  };
});
const routines: Routine[] = Array.from({ length: 4 }, (_, r) => ({
  id: uuid(),
  name: `Rutina ${String.fromCharCode(65 + r)}`,
  items: exercises.slice(r * 10, r * 10 + 6).map((e) => ({ exerciseId: e.id, targetSets: 4, repsMin: 6, repsMax: 10, targetRir: 2 })),
}));

const sessions: Session[] = [];
for (let d = 0; d < DAYS; d++) {
  const date = addDays(START, d);
  const dow = d % 7;
  if (![0, 1, 3].includes(dow)) continue; // 3 sesiones por semana ≈ 780
  const routine = routines[sessions.length % routines.length]!;
  const progress = d / DAYS;
  sessions.push({
    id: uuid(), routineId: routine.id, routineName: routine.name, date,
    startedAt: `${date}T18:00:00`, endedAt: `${date}T19:15:00`,
    exercises: routine.items.map((it) => {
      const base = 40 + progress * 40;
      const sets: WorkSet[] = [
        { weightKg: round(base * 0.5, 1), reps: 10, rir: 5, failure: false, warmup: true, confirmedAt: `${date}T18:05:00` },
        ...Array.from({ length: 4 }, (_, k) => ({
          weightKg: round(base + rand() * 5, 1), reps: 6 + Math.floor(rand() * 5), rir: 1 + Math.floor(rand() * 3),
          failure: false, warmup: false, confirmedAt: `${date}T18:${pad(10 + k * 5)}:00`,
        })),
      ];
      const { exerciseId, ...target } = it;
      return { exerciseId, target, sets, draft: null };
    }),
  });
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}

const ingredients: Ingredient[] = Array.from({ length: 150 }, (_, i) => ({
  id: uuid(), name: `Ingrediente ${i + 1}`, baseUnit: i % 10 === 0 ? "ml" : "g",
  per100: { kcal: round(rand() * 600, 1), protein: round(rand() * 30, 1), carbs: round(rand() * 80, 1), fat: round(rand() * 40, 1) },
  section: pick(["Frutería", "Carnicería", "Despensa", "Lácteos", null]),
  purchaseFormat: rand() < 0.5 ? { name: "paquete", amount: 500 } : null,
  householdMeasures: rand() < 0.3 ? [{ name: "cucharada", amount: 12 }] : [], archived: false,
}));
const recipes: Recipe[] = Array.from({ length: 40 }, (_, i) => ({
  id: uuid(), name: `Receta ${i + 1}`, baseServings: 2,
  lines: Array.from({ length: 4 }, () => ({ ingredientId: pick(ingredients).id, amount: round(20 + rand() * 200, 1) })),
  steps: ["Preparar", "Cocinar"], archived: false,
}));
const moments: MealMoment[] = [
  { id: uuid(), name: "Desayuno", startTime: "07:00" },
  { id: uuid(), name: "Comida", startTime: "13:00" },
  { id: uuid(), name: "Merienda", startTime: "17:00" },
  { id: uuid(), name: "Cena", startTime: "20:30" },
];
const consumptions: Consumption[] = [];
const bodyWeights: BodyWeight[] = [];
for (let d = 0; d < DAYS; d++) {
  const date = addDays(START, d);
  for (let k = 0; k < 4; k++) {
    const ing = pick(ingredients);
    consumptions.push({
      id: uuid(), date, momentId: moments[k]!.id, ref: { type: "ingredient", ingredientId: ing.id, amount: round(50 + rand() * 200, 1) },
      nutritionPerUnit: { ...ing.per100 }, plannedItemId: null, createdAt: `${date}T${pad(8 + k * 4)}:00:00`,
    });
  }
  if (rand() < 0.85) bodyWeights.push({ date, kg: round(82 - (d / DAYS) * 5 + (rand() - 0.5) * 1.5, 1) });
}

const data: AppData = {
  muscleGroups: groups, exercises, media: [], routines, sessions, ingredients, recipes, mealMoments: moments,
  plannedItems: [], consumptions, goals: [{ id: uuid(), effectiveFrom: START, kcal: 2500, protein: 160, carbs: null, fat: null }],
  shoppingList: null, bodyWeights, measurementTypes: [], bodyMeasurements: [],
};
const doc = buildDocument(data, { exportedAt: `${addDays(START, DAYS)}T10:00:00`, appVersion: "1.0.0", catalogVersion: null });
const valid = validateDocument(JSON.parse(JSON.stringify(doc)));
if (!valid.ok) {
  console.error(valid.errors.slice(0, 10).join("\n"));
  process.exit(1);
}
const out = join(import.meta.dirname, "..", "tests", "fixtures", "five-years.json");
writeFileSync(out, JSON.stringify(doc, null, 2));
const sets = sessions.reduce((n, s) => n + s.exercises.reduce((k, e) => k + e.sets.length, 0), 0);
console.log(`five-years.json: ${sessions.length} sesiones, ${sets} series, ${consumptions.length} consumos, semana final ${weekStart(addDays(START, DAYS - 1))}`);
