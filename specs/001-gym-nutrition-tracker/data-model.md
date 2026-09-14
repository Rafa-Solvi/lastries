# Data Model: Registro personal de entrenamiento y alimentación

**Feature**: `001-gym-nutrition-tracker` | **Date**: 2026-09-14 | **Plan**: [plan.md](plan.md)

Modelo lógico persistido en IndexedDB (un almacén por entidad raíz) y serializado tal cual en el
documento de exportación ([contracts/export-format.md](contracts/export-format.md)). Las entidades
hijas ordenadas (ejercicios de rutina, series, líneas de receta, medidas caseras) se guardan
embebidas en su entidad raíz: se leen y escriben siempre juntas y el orden es el del array.

## Convenciones

| Tipo | Representación |
|------|----------------|
| `Id` | UUID v4 en texto (`crypto.randomUUID()`) |
| `LocalDate` | `"AAAA-MM-DD"`, fecha civil local |
| `LocalTime` | `"HH:MM"`, 24 h |
| `LocalDateTime` | `"AAAA-MM-DDTHH:MM:SS"`, local sin zona |
| `Grams` | número > 0 en la unidad base del ingrediente (g o ml), hasta 1 decimal |
| `Nutrition` | `{ kcal, protein, carbs, fat }`, números ≥ 0 |

Todas las cantidades de alimentos están en la unidad base (principio IV). Ningún campo guarda
cantidades en medidas caseras.

## Almacenes (IndexedDB)

| Almacén | Clave | Entidad |
|---------|-------|---------|
| `meta` | `key` | Metadatos (versión de esquema, versión del catálogo base, última exportación) |
| `muscleGroups` | `id` | Grupo muscular |
| `exercises` | `id` | Ejercicio |
| `media` | `id` | Archivo de demostración propio (Blob) |
| `routines` | `id` | Rutina (con ejercicios de rutina embebidos) |
| `sessions` | `id` | Sesión (con ejercicios realizados y series embebidos) |
| `ingredients` | `id` | Ingrediente (con medidas caseras embebidas) |
| `recipes` | `id` | Receta (con líneas y pasos embebidos) |
| `mealMoments` | `id` | Momento del día |
| `plannedItems` | `id` | Elemento planificado |
| `consumptions` | `id` | Consumo |
| `goals` | `id` | Objetivos diarios con vigencia |
| `shoppingList` | `id` (`"current"`) | Lista de la compra activa (única) |
| `bodyWeights` | `date` | Pesaje |
| `measurementTypes` | `id` | Tipo de medida corporal |
| `bodyMeasurements` | `id` | Medida corporal |

Al arrancar se leen todos los almacenes salvo el contenido binario de `media`, que se carga bajo
demanda (research R3).

---

## Entrenamiento

### MuscleGroup

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `name` | string | 1–60 caracteres, único (normalizado) |
| `baseKey` | string \| null | clave original de free-exercise-db (`"chest"`…); null si lo creó el usuario |

Se siembran los 17 grupos del catálogo base traducidos (research R6). Un grupo en uso por algún
ejercicio no se puede eliminar; sí renombrar.

### Exercise

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `source` | `"base"` \| `"user"` | |
| `baseId` | string \| null | id de free-exercise-db; obligatorio y único si `source = "base"`, null si no |
| `originalName` | string \| null | nombre en inglés del catálogo base; inmutable; null si `source = "user"` |
| `name` | string | 1–120 caracteres; editable (FR-011) |
| `primaryMuscleIds` | `Id[]` | ≥ 1 elemento, sin repetidos, referencias a `MuscleGroup` (FR-011, Q3) |
| `secondaryMuscleIds` | `Id[]` | sin repetidos, disjunto de `primaryMuscleIds` |
| `equipment` | string \| null | texto libre; los del catálogo base vienen traducidos |
| `demos` | `DemoRef[]` | orden de visualización; vacío permitido |
| `archived` | boolean | archivado: no aparece al elegir, conserva historial |

`DemoRef` es uno de:

- `{ kind: "bundled", path: string }` — ruta relativa a `catalog/img/` dentro de la app (WebP).
- `{ kind: "media", mediaId: Id }` — referencia a `Media`.

**Búsqueda (FR-025)**: coincide si el texto normalizado está contenido en `name` o en
`originalName`.

**Eliminación**: solo si ninguna rutina ni sesión lo referencia; en otro caso se ofrece archivar.

**Siembra del catálogo**: en cada arranque se compara `catalog/exercises.json` con los `baseId`
existentes y solo se insertan los que faltan. Nunca se sobrescribe un ejercicio existente
(edge case "Ejercicio del catálogo base editado").

### Media

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `mimeType` | `"image/jpeg"` \| `"image/png"` \| `"image/webp"` \| `"image/gif"` | FR-012 |
| `fileName` | string | `<id>.<ext>`; nombre dentro de `media/` en la exportación |
| `blob` | Blob | solo en IndexedDB; no forma parte del JSON |
| `byteSize` | number | informativo |

Un `Media` sin ningún ejercicio que lo referencie se elimina al quitarlo del último ejercicio.

### Routine

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `name` | string | 1–60 caracteres |
| `items` | `RoutineItem[]` | orden de la rutina; puede estar vacío |

`RoutineItem`:

| Campo | Tipo | Reglas |
|-------|------|--------|
| `exerciseId` | `Id` | referencia a `Exercise` |
| `targetSets` | integer | 1–20 |
| `repsMin` | integer | 1–100 |
| `repsMax` | integer | `repsMin` ≤ `repsMax` ≤ 100 |
| `targetRir` | integer | 0–10 |

Eliminar una rutina no afecta a las sesiones (copian los objetivos al iniciarse).

### Session

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `routineId` | `Id` \| null | informativo; null en sesión vacía (FR-015); puede apuntar a una rutina eliminada |
| `routineName` | string \| null | copia del nombre al iniciar |
| `date` | `LocalDate` | fecha de inicio; determina la semana del volumen |
| `startedAt` | `LocalDateTime` | |
| `endedAt` | `LocalDateTime` \| null | null = en curso |
| `exercises` | `SessionExercise[]` | orden actual de la sesión (FR-020) |

Invariante: como máximo una sesión con `endedAt = null`.

`SessionExercise`:

| Campo | Tipo | Reglas |
|-------|------|--------|
| `exerciseId` | `Id` | |
| `target` | `{ targetSets, repsMin, repsMax, targetRir }` \| null | copia del `RoutineItem`; null si se añadió sobre la marcha sin objetivos |
| `sets` | `WorkSet[]` | solo series confirmadas, en orden |
| `draft` | `DraftSet` \| null | borrador de la siguiente serie pendiente de este ejercicio (FR-021) |

`WorkSet`:

| Campo | Tipo | Reglas |
|-------|------|--------|
| `weightKg` | number | ≥ 0, hasta 2 decimales |
| `reps` | integer | ≥ 0 |
| `rir` | integer | 0–10; el control de entrada ofrece 0–5 y "Fallo" (FR-019) |
| `failure` | boolean | serie al fallo; si es `true`, `rir` MUST ser 0 |
| `warmup` | boolean | FR-016 |
| `confirmedAt` | `LocalDateTime` | |

`DraftSet`:

| Campo | Tipo | Reglas |
|-------|------|--------|
| `weightKg` | number \| null | mismas reglas que `WorkSet` cuando no es null |
| `reps` | integer \| null | |
| `rir` | integer \| null | |
| `failure` | boolean | |
| `warmup` | boolean | |
| `updatedAt` | `LocalDateTime` | |

**Borrador (FR-021)**: en cuanto el usuario modifica un campo de la siguiente serie pendiente de un
ejercicio, se escribe `draft` completo en IndexedDB en ese mismo evento (sin esperar a perder el
foco ni a un temporizador). Al abrir la sesión, si `draft` existe sustituye a la primera serie
precargada de ese ejercicio y se muestra marcado "sin confirmar". Confirmar la serie la añade a
`sets` y pone `draft = null` en la misma transacción; deshacer una confirmación (FR-009) la retira de
`sets` y la devuelve a `draft`; solo es posible mientras `draft` sea null, y cualquier `saveDraft`
sobre ese ejercicio anula el deshacer pendiente. Las series pendientes posteriores no se guardan: se recalculan con
la precarga.

**Transiciones de Session**: `creada (endedAt null)` → series confirmadas / ejercicios añadidos,
quitados o reordenados → `finalizada (endedAt fijado)`. Una sesión finalizada sigue siendo editable
(FR-007) pero no vuelve a estar en curso; al finalizarla se descartan los `draft` pendientes. Las
series pendientes se recalculan con la precarga (ver
[contracts/domain-functions.md](contracts/domain-functions.md#prefill)) al abrir la sesión, aplicando
el `draft` de cada ejercicio si existe.

**Última vez de un ejercicio (FR-017)**: el `SessionExercise` con ese `exerciseId` y al menos una
serie, de la sesión más reciente por `startedAt`, excluida la sesión actual.

---

## Alimentación

### Ingredient

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `name` | string | 1–80 caracteres; único normalizado (trim, sin mayúsculas ni tildes) |
| `baseUnit` | `"g"` \| `"ml"` | |
| `per100` | `Nutrition` | por 100 unidades base; cada valor ≥ 0, hasta 1 decimal |
| `section` | string \| null | sección del supermercado, texto libre |
| `purchaseFormat` | `{ name: string, amount: Grams }` \| null | FR-031 |
| `householdMeasures` | `HouseholdMeasure[]` | 0..n; nombres únicos dentro del ingrediente |
| `archived` | boolean | |

`HouseholdMeasure`: `{ name: string (1–30), amount: Grams }`. `name` en singular; el plural se
forma al mostrar (vocal final → `+s`, consonante → `+es`).

**Eliminación**: solo si ninguna receta, elemento planificado o consumo lo referencia; en otro caso
se ofrece archivar. Editar `per100` no modifica consumos (FR-042).

### Recipe

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `name` | string | 1–120 caracteres |
| `baseServings` | number | > 0, hasta 2 decimales |
| `lines` | `{ ingredientId: Id, amount: Grams }[]` | ≥ 1 línea; un ingrediente puede repetirse |
| `steps` | string[] | orden de preparación; puede estar vacío |
| `archived` | boolean | |

Nutrición por ración calculada al vuelo con los valores actuales (FR-038). Eliminación: igual que
ingredientes.

### MealMoment

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `name` | string | 1–30 caracteres, único |
| `startTime` | `LocalTime` | único entre momentos |

El orden de los momentos es el de `startTime`. Siembra: Desayuno 07:00, Comida 13:00, Merienda
17:00, Cena 20:30. No se puede eliminar un momento con elementos planificados o consumos; debe
quedar al menos uno.

### PlannedItem

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `date` | `LocalDate` | |
| `momentId` | `Id` | |
| `ref` | `FoodRef` | |

`FoodRef` es uno de:

- `{ type: "ingredient", ingredientId: Id, amount: Grams }`
- `{ type: "recipe", recipeId: Id, servings: number (> 0) }`

### Consumption

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `date` | `LocalDate` | |
| `momentId` | `Id` | asignado por hora si no se indica (FR-041) |
| `ref` | `FoodRef` | |
| `nutritionPerUnit` | `Nutrition` | copia congelada: por 100 unidades base (ingrediente) o por ración (receta) (FR-042) |
| `plannedItemId` | `Id` \| null | elemento planificado del que procede |
| `createdAt` | `LocalDateTime` | desempate de frecuentes |

**Totales de un consumo**: `nutritionPerUnit × amount / 100` (ingrediente) o
`nutritionPerUnit × servings` (receta). Cambiar la cantidad o raciones recalcula con la copia
congelada; cambiar el ingrediente o la receta toma una copia nueva (edge case).

**Repetir comida del día anterior**: es un registro normal. Crea consumos nuevos con la misma `ref` y
`momentId` que los de ayer, fecha de hoy, y un `nutritionPerUnit` congelado en ese instante con
`snapshotFor` sobre los valores vigentes del ingrediente o receta (FR-041, FR-042). No copia el
`nutritionPerUnit` de los consumos de ayer. A partir de ahí, la copia de hoy queda tan congelada como
cualquier otra.

**Marcar planificado como comido**: crea un `Consumption` con la `ref` del `PlannedItem` (o la
ajustada), `plannedItemId` fijado y copia congelada actual. El `PlannedItem` se conserva; se muestra
como comido si existe un consumo que lo referencia.

### Goal

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `effectiveFrom` | `LocalDate` | único |
| `kcal`, `protein`, `carbs`, `fat` | number \| null | ≥ 0; null = sin objetivo para ese valor |

**Objetivo vigente en una fecha** (FR-044): el `Goal` con mayor `effectiveFrom` ≤ fecha; si no hay,
sin objetivos.

---

## Lista de la compra

### ShoppingList (registro único `id = "current"`)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `"current"` | |
| `from`, `to` | `LocalDate` | `from` ≤ `to` |
| `generatedLines` | `GeneratedLine[]` | una por ingrediente |
| `manualLines` | `ManualLine[]` | |

`GeneratedLine`: `{ ingredientId: Id, requiredAmount: Grams, packs: integer | null, purchased: boolean }`
(`packs` null si el ingrediente no tiene formato de compra).

`ManualLine`: `{ id: Id, text: string (1–120), quantity: string | null, purchased: boolean }`.

La sección y el nombre del formato se toman del ingrediente al mostrar.

**Regeneración (FR-055)**: para cada ingrediente del nuevo cálculo, `purchased` se conserva si
existía una línea previa marcada y la nueva necesidad no aumenta (`packs` nuevo ≤ anterior; sin
formato, `requiredAmount` nuevo ≤ anterior). Las líneas de ingredientes ausentes desaparecen; las
manuales no cambian.

---

## Progreso

### BodyWeight

| Campo | Tipo | Reglas |
|-------|------|--------|
| `date` | `LocalDate` | clave; un valor por día (FR-060) |
| `kg` | number | > 0, 1 decimal |

### MeasurementType

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `name` | string | 1–30, único |
| `order` | integer | |

Siembra: Cintura, Cadera, Pecho, Brazo, Muslo.

### BodyMeasurement

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | `Id` | |
| `typeId` | `Id` | |
| `date` | `LocalDate` | único junto con `typeId` |
| `cm` | number | > 0, 1 decimal |

---

## Meta

| Clave | Valor |
|-------|-------|
| `schemaVersion` | integer; versión de los datos almacenados (inicial: 1). Misma numeración que `schemaVersion` del documento de exportación |
| `catalogVersion` | string; commit de free-exercise-db empaquetado |
| `lastExportAt` | `LocalDateTime` \| null; informativo en Ajustes (research R4) |
| `persistGranted` | boolean \| null; resultado de `navigator.storage.persist()` |
| `preMigrationBackup` | `{ fromVersion: integer, createdAt: LocalDateTime, document: string }` \| null; documento completo previo a la última migración |

## Versionado y migraciones (research R14)

Dos números independientes:

- **`DB_VERSION`** (versión de IndexedDB): solo cambia la estructura de almacenes. `onupgradeneeded`
  únicamente crea almacenes que falten; nunca transforma datos.
- **`SCHEMA_VERSION`** (constante del código) frente a `meta.schemaVersion` (dato almacenado): forma
  de los registros. Una única cadena de migraciones `migrations[n]: (doc de versión n) → doc de
  versión n + 1` opera sobre el documento de exportación en memoria y la usan tanto la importación
  como el arranque.

**Arranque** cuando `meta.schemaVersion < SCHEMA_VERSION`:

1. Leer todos los almacenes y construir el documento de exportación de la versión almacenada.
2. Guardar ese documento serializado en `meta.preMigrationBackup` (sustituye al anterior).
3. Aplicar en memoria las migraciones desde `meta.schemaVersion` hasta `SCHEMA_VERSION`.
4. Validar el resultado con el validador de la versión actual.
5. En una única transacción: sustituir todos los almacenes salvo `media`; en `media`, actualizar solo
   los metadatos (`mimeType`, `fileName`, `byteSize`) conservando el `blob` existente de cada `id`, y
   borrar únicamente los registros cuyo `id` no aparezca en el documento migrado; fijar
   `meta.schemaVersion = SCHEMA_VERSION`.

Si falla cualquiera de los pasos 3–5, no se escribe nada (salvo la copia del paso 2), la app no
arranca sobre datos a medias y muestra una pantalla que indica el error y permite exportar el
documento previo a la migración para no perder el histórico.

**Arranque** cuando `meta.schemaVersion > SCHEMA_VERSION` (código más antiguo que los datos): la app
no escribe nada y muestra el mismo aviso con la opción de exportar.

**Reglas de mantenimiento**:

- Todo cambio en la forma de un registro incrementa `SCHEMA_VERSION` y añade exactamente una
  migración; las migraciones existentes nunca se modifican ni se eliminan.
- Cada migración tiene un documento de ejemplo de la versión anterior en `tests/fixtures/` y un test
  que comprueba el resultado migrado y validado.
- Una migración nunca crea ni modifica el contenido binario de `media`; solo puede cambiar metadatos
  o eliminar referencias.

## Relaciones

```text
MuscleGroup 1 ─< Exercise.primaryMuscleIds / secondaryMuscleIds >─ n
Exercise    1 ─< Exercise.demos(media) >─ 1 Media
Routine     1 ─< RoutineItem >─ 1 Exercise
Session     1 ─< SessionExercise >─ 1 Exercise ; SessionExercise 1 ─< WorkSet
Ingredient  1 ─< HouseholdMeasure
Recipe      1 ─< line >─ 1 Ingredient
MealMoment  1 ─< PlannedItem, Consumption
PlannedItem / Consumption ─ FoodRef ─> Ingredient | Recipe
Consumption n ─> 0..1 PlannedItem
ShoppingList 1 ─< GeneratedLine >─ 1 Ingredient ; ShoppingList 1 ─< ManualLine
MeasurementType 1 ─< BodyMeasurement
```
