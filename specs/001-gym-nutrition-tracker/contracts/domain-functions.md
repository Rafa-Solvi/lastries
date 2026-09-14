# Contract: Funciones de dominio

**Constitución**: principio VII (tests obligatorios), principio IV | **Research**: R11, R12

Interfaces de las funciones puras de `src/domain/`. No acceden a IndexedDB, al DOM ni al reloj: la
fecha y hora actuales se reciben como parámetro. Los tipos son los de
[data-model.md](../data-model.md). Las firmas son contractuales; los nombres internos auxiliares no.

Los módulos marcados **[TEST OBLIGATORIO]** deben tener tests que cubran, como mínimo, los casos de
ejemplo indicados (tomados de los escenarios de aceptación de la spec).

---

## household.ts — Presentación en medidas caseras **[TEST OBLIGATORIO]**

```ts
type HouseholdDisplay =
  | { kind: "household"; measureName: string; whole: number; fraction: Fraction | null; text: string }
  | { kind: "base"; amount: number; unit: "g" | "ml"; text: string };
type Fraction = "1/4" | "1/3" | "1/2" | "2/3" | "3/4";

function toHousehold(amount: number, unit: "g" | "ml", measures: HouseholdMeasure[]): HouseholdDisplay;
function roundToReadable(value: number): { whole: number; fraction: Fraction | null; value: number };
function pluralize(name: string): string;
```

**Reglas (FR-037)**:

1. Ordenar `measures` por `amount` descendente.
2. Para cada medida: `v = amount / measure.amount`; `r = roundToReadable(v)`.
   - Candidatos: `n + f` con `n = floor(v)` y `f ∈ {0, 1/4, 1/3, 1/2, 2/3, 3/4}`, más `n + 1`;
     se descarta el valor 0. Se elige el más cercano a `v`; en empate, el mayor.
   - Si `|r.value − v| / v ≤ 0,10`, devolver esa medida.
3. Si ninguna medida cumple, o no hay medidas: `{ kind: "base" }` con 1 decimal (`"1,8 g"`).

**Texto**: entero `n` → `"n <nombre>"` (plural si `n > 1`); solo fracción → `"f de <nombre>"`;
entero y fracción → `"n y f <plural>"`. Plural: vocal final `+s`, consonante `+es`.

**Casos mínimos**:

| amount | measures | Resultado |
|--------|----------|-----------|
| 27 g | cucharada 13,5 | `2 cucharadas` |
| 40,5 g | cucharada 13,5 | `3 cucharadas` |
| 100 g | vaso 150 | `2/3 de vaso` |
| 45 g | vaso 150, cucharada 10 | `4 y 1/2 cucharadas` (vaso descartado: 11 %) |
| 1,8 g | cucharadita 6 | `1,8 g` (1/3 descartado: 11 %) |
| 29,4 g | cucharada 15 | `2 cucharadas` (1,96 → 2) |
| 50 g | — | `50 g` |

## scaling.ts — Escalado de raciones **[TEST OBLIGATORIO]**

```ts
function scaleFactor(baseServings: number, targetServings: number): number;
function scaleRecipeLines(recipe: Recipe, targetServings: number): { ingredientId: Id; amount: number }[];
```

**Reglas (FR-036)**: `factor = targetServings / baseServings`; `amount × factor` sin redondear.
`targetServings ≤ 0` o `baseServings ≤ 0` → error.

**Casos mínimos**: receta de 2 raciones con 27 g de aceite escalada a 3 → 40,5 g; escalar a las
raciones base devuelve las cantidades originales; escalar 2 → 1 → 2 devuelve las originales.

## shopping.ts — Lista de la compra **[TEST OBLIGATORIO]**

```ts
function aggregateRequirements(
  planned: PlannedItem[], recipes: Map<Id, Recipe>, from: LocalDate, to: LocalDate
): Map<Id, number>; // ingredientId → cantidad total en unidad base

function buildGeneratedLines(
  requirements: Map<Id, number>, ingredients: Map<Id, Ingredient>
): GeneratedLine[];

function regenerate(previous: ShoppingList | null, next: GeneratedLine[], from: LocalDate, to: LocalDate): ShoppingList;

function groupBySection(lines: GeneratedLine[], ingredients: Map<Id, Ingredient>):
  { section: string; lines: GeneratedLine[] }[];
```

**Reglas (FR-050–055)**:

- Solo elementos con `from ≤ date ≤ to`. Recetas: cada línea × `servings / baseServings`.
  Ingredientes sueltos: `amount`. Suma por `ingredientId`.
- `packs = ceil(total / purchaseFormat.amount − 1e-9)`; sin formato → `null`.
- `regenerate`: conserva `manualLines`; para cada línea nueva, `purchased = true` solo si había línea
  previa del mismo ingrediente marcada y la necesidad no aumenta (`packs` ≤ anterior; sin formato,
  `requiredAmount` ≤ anterior).
- `groupBySection`: secciones en orden alfabético, `"Sin sección"` al final; líneas por nombre de
  ingrediente.

**Casos mínimos**:

- Tomate 150 g + 250 g en recetas (1 ración cada una, base 1) + 100 g suelto → 500 g.
- Lentejas planificadas a 2 raciones con receta base 4 que lleva 300 g → 150 g.
- Elementos fuera del rango no suman; los extremos `from` y `to` sí.
- Pollo 650 g con bandeja 500 g → `packs = 2`; 500 g exactos → `packs = 1`.
- Regenerar con tomate marcado y misma necesidad → sigue marcado; línea manual conservada.
- Pollo marcado con `packs = 1` y nueva necesidad `packs = 2` → desmarcado.
- Ingrediente que desaparece del rango → su línea desaparece.

## volume.ts — Volumen semanal **[TEST OBLIGATORIO]**

```ts
function weekStart(date: LocalDate): LocalDate; // lunes de la semana ISO
function weeklyVolume(
  sessions: Session[], exercises: Map<Id, Exercise>, week: LocalDate
): Map<Id, number>; // muscleGroupId → series (múltiplos de 0,5)
```

**Reglas (FR-023, FR-024)**: sesiones con `weekStart(session.date) = week`. Por cada
`SessionExercise`, `n` = series con `warmup = false`. Cada id de `primaryMuscleIds` suma `n`; cada id
de `secondaryMuscleIds` que no esté en primarios suma `0,5 × n`. Se usan los grupos actuales del
ejercicio.

**Casos mínimos**:

- Press banca 3 efectivas + 3 calentamiento (P: pecho; S: tríceps, hombros) y fondos 4 efectivas
  (P: tríceps; S: pecho) → pecho 5, tríceps 5,5, hombros 1,5.
- Peso muerto rumano 4 efectivas (P: isquiotibiales, glúteos; S: zona lumbar) → 4, 4, 2.
- Solo calentamiento → grupo con 0 (o ausente).
- Sesión del domingo y del lunes siguiente → semanas distintas.
- Cambiar los secundarios de un ejercicio cambia el resultado de semanas pasadas.

---

Los siguientes módulos no tienen test obligatorio por la constitución; se recomiendan tests para
`exportFormat.ts` (research R12).

## prefill.ts — Precarga de series {#prefill}

```ts
type PendingSet = {
  weightKg: number | null; reps: number | null; rir: number | null;
  failure: boolean; warmup: boolean; isDraft: boolean;
};
function lastTime(sessions: Session[], exerciseId: Id, excludeSessionId: Id): WorkSet[] | null;
function pendingSets(
  last: WorkSet[] | null, target: SessionExercise["target"],
  confirmedCount: number, draft: DraftSet | null
): PendingSet[];
```

**Reglas (FR-018, FR-021)**: con `last`: plantilla = `last` en orden (valores, `failure` y `warmup`);
si `target` y `target.targetSets` > series efectivas de `last`, se añaden copias de la última
efectiva hasta igualar. Sin `last`: con `target`, `targetSets` series
`{ null, repsMin, targetRir, failure: false, warmup: false }`; sin `target`, una serie vacía.
Resultado: plantilla sin las primeras `confirmedCount` posiciones; si `draft` no es null, sustituye
a la primera pendiente con `isDraft = true` (si no quedaban pendientes, se añade). Si la plantilla se
agota, la siguiente serie añadida copia la última confirmada.

## nutrition.ts — Nutrición

```ts
function snapshotFor(ref: FoodRef, ingredients: Map<Id, Ingredient>, recipes: Map<Id, Recipe>): Nutrition; // por unidad
function consumptionTotals(c: Consumption): Nutrition;
function recipeNutrition(recipe: Recipe, ingredients: Map<Id, Ingredient>): { total: Nutrition; perServing: Nutrition };
function dayTotals(consumptions: Consumption[], date: LocalDate): Nutrition;
function goalAt(goals: Goal[], date: LocalDate): Goal | null;
function difference(total: Nutrition, goal: Goal | null): Partial<Nutrition>; // valor − objetivo, solo donde hay objetivo
```

## mealMoment.ts — Momento por hora

```ts
function momentAt(moments: MealMoment[], time: LocalTime): MealMoment;
```

Último momento con `startTime ≤ time`; si ninguno, el de `startTime` mayor (FR-040).

## frequents.ts — Frecuentes

```ts
function frequents(
  consumptions: Consumption[], momentId: Id, today: LocalDate,
  isArchived: (ref: FoodRef) => boolean
): { ref: FoodRef; count: number }[];
```

Consumos con `today − 29 ≤ date ≤ today` y `momentId`; agrupados por ingrediente o receta; orden por
`count` descendente y `createdAt` más reciente; excluye archivados; máximo 10. La `ref` devuelta
lleva la cantidad o raciones del último consumo de ese elemento en cualquier momento (FR-045).

## bodyweight.ts — Media móvil

```ts
function movingAverage(weights: BodyWeight[], date: LocalDate): number | null;
```

Media de los pesajes con `date − 6 ≤ fecha ≤ date`; `null` si no hay ninguno (FR-061). Caso: 80,0
(lun), 80,6 (mié), 79,8 (dom) → 80,13 (se muestra 80,1).

## migrations.ts — Migración del documento {#migrations}

```ts
const SCHEMA_VERSION: number; // versión actual del código (inicial: 1)
type ExportDocument = { format: "lastries"; schemaVersion: number; data: unknown /* … */ };
const migrations: Record<number, (doc: ExportDocument) => ExportDocument>; // clave n: de n a n + 1
function migrate(doc: ExportDocument): { ok: true; value: ExportDocument } | { ok: false; errors: string[] };
```

**Reglas (research R14)**: `schemaVersion > SCHEMA_VERSION` → error "versión más reciente";
`schemaVersion < 1` o sin migración para algún paso → error. Aplica en orden
`migrations[v], migrations[v+1], …` hasta `SCHEMA_VERSION`, fijando `schemaVersion` en cada paso. No
muta la entrada. Cada entrada de `migrations` MUST tener un fixture `tests/fixtures/schema-v<n>.json`
y un test que compruebe que `migrate(fixture)` valida con `exportFormat.ts`. Con `SCHEMA_VERSION = 1`
la cadena está vacía y el test comprueba el paso identidad y los dos errores.

## csvIngredients.ts / exportFormat.ts

Parseo y validación según [ingredients-csv.md](ingredients-csv.md) y
[export-format.md](export-format.md). Devuelven `{ ok: true, value } | { ok: false, errors: string[] }`
sin efectos.
