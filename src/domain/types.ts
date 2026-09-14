// Tipos del modelo de datos. Fuente: specs/001-gym-nutrition-tracker/data-model.md

export type Id = string;
/** "AAAA-MM-DD", fecha civil local */
export type LocalDate = string;
/** "HH:MM", 24 h */
export type LocalTime = string;
/** "AAAA-MM-DDTHH:MM:SS", local sin zona */
export type LocalDateTime = string;

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ---------- Entrenamiento ----------

export interface MuscleGroup {
  id: Id;
  name: string;
  baseKey: string | null;
}

export type DemoRef = { kind: "bundled"; path: string } | { kind: "media"; mediaId: Id };

export interface Exercise {
  id: Id;
  source: "base" | "user";
  baseId: string | null;
  originalName: string | null;
  name: string;
  primaryMuscleIds: Id[];
  secondaryMuscleIds: Id[];
  equipment: string | null;
  demos: DemoRef[];
  archived: boolean;
}

export type MediaMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/** Metadatos de un archivo de demostración propio. El Blob vive solo en IndexedDB. */
export interface Media {
  id: Id;
  mimeType: MediaMimeType;
  fileName: string;
  byteSize: number;
}

export interface Target {
  targetSets: number;
  repsMin: number;
  repsMax: number;
  targetRir: number;
}

export interface RoutineItem extends Target {
  exerciseId: Id;
}

export interface Routine {
  id: Id;
  name: string;
  items: RoutineItem[];
}

export interface WorkSet {
  weightKg: number;
  reps: number;
  rir: number;
  failure: boolean;
  warmup: boolean;
  confirmedAt: LocalDateTime;
}

export interface DraftSet {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  failure: boolean;
  warmup: boolean;
  updatedAt: LocalDateTime;
}

export interface SessionExercise {
  exerciseId: Id;
  target: Target | null;
  sets: WorkSet[];
  draft: DraftSet | null;
}

export interface Session {
  id: Id;
  routineId: Id | null;
  routineName: string | null;
  date: LocalDate;
  startedAt: LocalDateTime;
  endedAt: LocalDateTime | null;
  exercises: SessionExercise[];
}

// ---------- Alimentación ----------

export interface HouseholdMeasure {
  name: string;
  amount: number;
}

export interface PurchaseFormat {
  name: string;
  amount: number;
}

export interface Ingredient {
  id: Id;
  name: string;
  baseUnit: "g" | "ml";
  per100: Nutrition;
  section: string | null;
  purchaseFormat: PurchaseFormat | null;
  householdMeasures: HouseholdMeasure[];
  archived: boolean;
}

export interface RecipeLine {
  ingredientId: Id;
  amount: number;
}

export interface Recipe {
  id: Id;
  name: string;
  baseServings: number;
  lines: RecipeLine[];
  steps: string[];
  archived: boolean;
}

export interface MealMoment {
  id: Id;
  name: string;
  startTime: LocalTime;
}

export type FoodRef =
  | { type: "ingredient"; ingredientId: Id; amount: number }
  | { type: "recipe"; recipeId: Id; servings: number };

export interface PlannedItem {
  id: Id;
  date: LocalDate;
  momentId: Id;
  ref: FoodRef;
}

export interface Consumption {
  id: Id;
  date: LocalDate;
  momentId: Id;
  ref: FoodRef;
  /** Copia congelada: por 100 unidades base (ingrediente) o por ración (receta). */
  nutritionPerUnit: Nutrition;
  plannedItemId: Id | null;
  createdAt: LocalDateTime;
}

export interface Goal {
  id: Id;
  effectiveFrom: LocalDate;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

// ---------- Lista de la compra ----------

export interface GeneratedLine {
  ingredientId: Id;
  requiredAmount: number;
  packs: number | null;
  purchased: boolean;
}

export interface ManualLine {
  id: Id;
  text: string;
  quantity: string | null;
  purchased: boolean;
}

export interface ShoppingList {
  id: "current";
  from: LocalDate;
  to: LocalDate;
  generatedLines: GeneratedLine[];
  manualLines: ManualLine[];
}

// ---------- Progreso ----------

export interface BodyWeight {
  date: LocalDate;
  kg: number;
}

export interface MeasurementType {
  id: Id;
  name: string;
  order: number;
}

export interface BodyMeasurement {
  id: Id;
  typeId: Id;
  date: LocalDate;
  cm: number;
}

// ---------- Meta y estado ----------

export interface PreMigrationBackup {
  fromVersion: number;
  createdAt: LocalDateTime;
  document: string;
}

export interface Meta {
  schemaVersion: number | null;
  catalogVersion: string | null;
  lastExportAt: LocalDateTime | null;
  persistGranted: boolean | null;
  preMigrationBackup: PreMigrationBackup | null;
}

/** Colecciones persistidas y exportadas (todas salvo meta). */
export interface AppData {
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
  media: Media[];
  routines: Routine[];
  sessions: Session[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  mealMoments: MealMoment[];
  plannedItems: PlannedItem[];
  consumptions: Consumption[];
  goals: Goal[];
  shoppingList: ShoppingList | null;
  bodyWeights: BodyWeight[];
  measurementTypes: MeasurementType[];
  bodyMeasurements: BodyMeasurement[];
}

export interface AppState extends AppData {
  meta: Meta;
}

export const ARRAY_COLLECTIONS = [
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
  "bodyWeights",
  "measurementTypes",
  "bodyMeasurements",
] as const satisfies readonly (keyof AppData)[];

export type ArrayCollection = (typeof ARRAY_COLLECTIONS)[number];

export const DATA_KEYS: readonly (keyof AppData)[] = [
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
];

export function emptyData(): AppData {
  return {
    muscleGroups: [],
    exercises: [],
    media: [],
    routines: [],
    sessions: [],
    ingredients: [],
    recipes: [],
    mealMoments: [],
    plannedItems: [],
    consumptions: [],
    goals: [],
    shoppingList: null,
    bodyWeights: [],
    measurementTypes: [],
    bodyMeasurements: [],
  };
}

export function emptyMeta(): Meta {
  return {
    schemaVersion: null,
    catalogVersion: null,
    lastExportAt: null,
    persistGranted: null,
    preMigrationBackup: null,
  };
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };
