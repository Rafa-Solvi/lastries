---

description: "Task list for 001-gym-nutrition-tracker"
---

# Tasks: Registro personal de entrenamiento y alimentación

**Input**: Design documents from `/specs/001-gym-nutrition-tracker/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: obligatorios solo donde los exige la constitución (principio VII: `household`, `scaling`,
`shopping`, `volume`) y el plan por riesgo de pérdida de datos (research R12, R14: `exportFormat`,
`migrations`). Se escriben antes de la implementación y deben fallar primero. Sin tests de UI.

**Organization**: tareas agrupadas por historia de usuario para implementar y probar cada una por
separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (fichero distinto, sin dependencias pendientes)
- **[Story]**: historia de usuario de spec.md (US1…US7)
- Rutas relativas a la raíz del repositorio (proyecto único, ver plan.md)

## Convenciones para todas las tareas

- Tipos y reglas de campo: [data-model.md](data-model.md). Firmas de funciones puras:
  [contracts/domain-functions.md](contracts/domain-functions.md). Presupuesto de interacciones:
  [contracts/logging-flows.md](contracts/logging-flows.md).
- `src/domain/` no importa nada de `src/data/` ni de `src/ui/`, no usa DOM, IndexedDB ni `Date.now()`:
  la fecha y hora actuales se reciben como parámetro.
- Toda mutación pasa por `commit()` de `src/data/store.ts`: primero transacción IndexedDB, después
  estado en memoria. Las mutaciones de cada área viven en `src/data/actions/<área>.ts` (subdivisión de
  `store.ts` prevista en el plan para evitar un único fichero enorme).
- Textos de UI en español. Ningún color, icono o texto valorativo (principio V): diferencias frente a
  objetivos como número con signo en color de texto normal.
- Cantidades de alimentos siempre en unidad base (g o ml); redondeo solo al mostrar (research R11).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicializar el proyecto con las dependencias y la configuración del plan.

- [X] T001 Crear `package.json` con versiones exactas (sin `^` ni `~`) de las estables vigentes: dependencias de runtime solo `preact`, `idb`, `fflate`; devDependencies `vite`, `@preact/preset-vite`, `typescript`, `vitest`; `"engines": { "node": ">=22.18" }`; scripts `dev: vite`, `build: vite build && node scripts/gen-sw-manifest.ts`, `preview: vite preview`, `test: vitest run`, `catalog: node scripts/build-catalog.ts` en package.json
- [X] T002 [P] Crear `tsconfig.json` con `strict: true`, `noUncheckedIndexedAccess: true`, `jsx: "react-jsx"`, `jsxImportSource: "preact"`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `target: "ES2022"`, `types: ["vitest/globals"]`, incluyendo `src`, `tests`, `scripts` en tsconfig.json
- [X] T003 [P] Crear `vite.config.ts` con `@preact/preset-vite`, `base: "./"` (para servir desde subruta de GitHub Pages), y bloque `test` de Vitest con `include: ["tests/**/*.test.ts"]` y `environment: "node"` en vite.config.ts
- [X] T004 [P] Crear `index.html` (lang `es`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, enlace a `manifest.webmanifest`, `theme-color`, raíz `#app`, script `src/main.tsx`) en index.html
- [X] T005 [P] Crear estilos base mobile-first: tipografía del sistema, paleta neutra (grises y un único color de acento para acciones, sin rojo/verde semántico), objetivos táctiles de al menos 44 px, fila de botones sin desplazamiento horizontal en 360 px, soporte de modo oscuro por `prefers-color-scheme` en src/ui/styles.css
- [X] T006 [P] Crear `public/manifest.webmanifest` (`name: "Lastries"`, `lang: "es"`, `display: "standalone"`, `start_url: "./"`, `scope: "./"`) e iconos PNG 192 y 512 px en public/icons/
- [X] T007 [P] Crear `.gitignore` con `node_modules/`, `dist/` y ficheros temporales de editor en .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos, persistencia, estado, migraciones, service worker y armazón de UI que usan todas
las historias.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase.

### Dominio base

- [X] T008 Definir en TypeScript todos los tipos de data-model.md: `Id`, `LocalDate`, `LocalTime`, `LocalDateTime`, `Nutrition`, `MuscleGroup`, `Exercise` con `source: "base" | "user"` y `DemoRef` (`{ kind: "bundled", path }` | `{ kind: "media", mediaId }`), `Media` (`mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"`), `Routine`/`RoutineItem`, `Session`/`SessionExercise` (con `draft: DraftSet | null`)/`WorkSet` (con `failure` y `warmup`)/`DraftSet`, `Ingredient` (`baseUnit: "g" | "ml"`, `purchaseFormat: { name, amount } | null`, `householdMeasures`), `Recipe`, `MealMoment`, `FoodRef` (`{ type: "ingredient", ingredientId, amount }` | `{ type: "recipe", recipeId, servings }`), `PlannedItem`, `Consumption` (con `nutritionPerUnit`, `plannedItemId`, `createdAt`), `Goal`, `ShoppingList` (`id: "current"`)/`GeneratedLine`/`ManualLine`, `BodyWeight`, `MeasurementType`, `BodyMeasurement`, `Meta` y el tipo `AppState` con un array por colección en src/domain/types.ts
- [X] T009 [P] Implementar utilidades de fecha sin librerías (research R9): `toLocalDate(date)`, `toLocalTime(date)`, `toLocalDateTime(date)`, `parseLocalDate` (construye `Date` local a las 12:00 para evitar saltos de horario de verano), `addDays(date, n)`, `compareDates`, `weekStart(date)` que devuelve el lunes de la semana ISO, `isInRange(date, from, to)` inclusivo y formateo corto en español en src/domain/dates.ts
- [X] T010 [P] Implementar reglas de campo compartidas (research R11): `normalizeName` (trim, minúsculas, sin tildes vía `normalize("NFD")`), `maxDecimals(value, n)`, validadores `isWeightKg` ("≥ 0, hasta 2 decimales"), `isReps` ("entero ≥ 0"), `isRir` ("entero 0–10"), `isAmount` ("número > 0 con hasta 1 decimal"), `isServings` ("> 0, hasta 2 decimales"), `isNutritionValue` ("≥ 0, hasta 1 decimal"), `isBodyKg` y `isCm` ("> 0, 1 decimal"), `isLocalDate`, `isLocalTime`, `isLocalDateTime`, `isUuid`, y parseo de número que acepta coma decimal en src/domain/validation.ts

### Formato de datos y migraciones

- [X] T011 [P] Escribir tests (deben fallar) de `validateDocument` y `buildDocument`: documento mínimo válido; clave desconocida rechazada; `format` distinto de `"lastries"`; `rir: 15` rechazado con ruta `data.sessions[0].exercises[0].sets[0].rir`; `failure: true` con `rir` distinto de 0 rechazado; `primaryMuscleIds` vacío rechazado; músculo en primarios y secundarios rechazado; `repsMin > repsMax` rechazado; dos sesiones con `endedAt: null` rechazadas; referencia a ingrediente inexistente rechazada; nombres de ingrediente duplicados tras normalizar rechazados; `failure`/`draft` aceptados; `buildDocument` omite `blob` de `media` y no incluye `meta` en tests/domain/exportFormat.test.ts
- [X] T012 Implementar `buildDocument(state, info)` que produce `{ format: "lastries", schemaVersion, exportedAt, appVersion, catalogVersion, data: {...16 colecciones salvo meta, media sin blob} }` y `validateDocument(input: unknown)` que devuelve `{ ok: true, value } | { ok: false, errors: string[] }` con mensajes `ruta: motivo`, comprobando: claves exactas por entidad; todas las reglas de data-model.md (p. ej. `MuscleGroup.name` "1–60 caracteres, único (normalizado)", `Exercise.name` "1–120 caracteres", `primaryMuscleIds` "≥ 1 elemento, sin repetidos", `secondaryMuscleIds` "disjunto de `primaryMuscleIds`", `baseId` "obligatorio y único si `source = "base"`, null si no", `RoutineItem.targetSets` "1–20", `repsMin` "1–100", `repsMax` "`repsMin` ≤ `repsMax` ≤ 100", `targetRir` "0–10", `WorkSet.failure` "si es `true`, `rir` MUST ser 0", `Ingredient.name` "1–80 caracteres; único normalizado", `HouseholdMeasure.name` "1–30" y "nombres únicos dentro del ingrediente", `Recipe.baseServings` "> 0, hasta 2 decimales", `Recipe.lines` "≥ 1 línea", `MealMoment.name` "1–30 caracteres, único" y `startTime` "único entre momentos", `Goal.effectiveFrom` "único", `ManualLine.text` "1–120", `BodyMeasurement` "único junto con `typeId`", `ShoppingList.from ≤ to`); unicidad de ids; integridad referencial de todas las referencias; invariante "como máximo una sesión con `endedAt = null`" en src/domain/exportFormat.ts
- [X] T013 [P] Crear `tests/fixtures/schema-v1.json` (exportación válida de versión 1 con al menos un elemento de cada colección, incluida una sesión con `draft` y una serie con `failure: true`) y tests (deben fallar) de `migrate`: con `schemaVersion: 1` devuelve el documento sin cambios y válido; `schemaVersion: 2` con `SCHEMA_VERSION = 1` devuelve error "versión más reciente"; `schemaVersion: 0` devuelve error; no muta la entrada; cada clave de `migrations` tiene su fixture `schema-v<n>.json` en tests/domain/migrations.test.ts
- [X] T014 Implementar `SCHEMA_VERSION = 1`, `migrations: Record<number, (doc) => doc> = {}` y `migrate(doc)` según contracts/domain-functions.md#migrations (aplica `migrations[v]…` hasta `SCHEMA_VERSION` fijando `schemaVersion` en cada paso, sin mutar la entrada) con un comentario de cabecera con las reglas de mantenimiento de data-model.md ("las migraciones existentes nunca se modifican ni se eliminan") en src/domain/migrations.ts

### Persistencia y estado

- [X] T015 Implementar apertura de IndexedDB con `idb`: `DB_NAME = "lastries"`, `DB_VERSION = 1`, `onupgradeneeded` que solo crea los almacenes que falten (`meta` keyPath `key`; `bodyWeights` keyPath `date`; `shoppingList` keyPath `id`; resto keyPath `id`) y nunca transforma datos; `loadAll()` que lee todos los almacenes a `AppState` sin cargar el contenido de los Blobs de `media` en memoria (solo metadatos); `readMeta`/`writeMeta` para `schemaVersion`, `catalogVersion`, `lastExportAt`, `persistGranted`, `preMigrationBackup`; `replaceAll(state, metaPatch, mediaBlobs?: Map<Id, Blob>)` en una única transacción: si recibe `mediaBlobs` (importación) escribe esos Blobs; si no, conserva el Blob ya guardado de cada `Media` por `id` y borra solo los `Media` ausentes de `state`; nunca deja un `Media` sin Blob (data-model.md "Versionado y migraciones", paso 5) en src/data/db.ts
- [X] T016 Implementar la migración de arranque en `startupMigrate()` según data-model.md "Versionado y migraciones": si `meta.schemaVersion` falta en una base vacía, fijarlo a `SCHEMA_VERSION`; si es menor, (1) construir documento con `buildDocument`, (2) guardar `{ fromVersion, createdAt, document }` en `meta.preMigrationBackup`, (3) `migrate`, (4) `validateDocument`, (5) `replaceAll(migrado, { schemaVersion: SCHEMA_VERSION })` sin `mediaBlobs`, conservando los Blobs de medios; si 3–5 fallan o `meta.schemaVersion > SCHEMA_VERSION`, no escribir nada más y devolver `{ ok: false, reason, backup }` en src/data/db.ts
- [X] T017 Implementar el store en memoria: `state` (AppState), `subscribe(listener)`, hook `useAppState(selector)` para Preact, `commit(storeNames, (tx) => Promise<void>, (draft) => void)` que ejecuta la transacción IndexedDB y solo si confirma aplica el cambio en memoria y notifica; registro de deshacer `setUndo({ label, revert, scope?: string })` que sustituye cualquier deshacer anterior y caduca a los 8 s; `clearUndo(scope?)` que sin argumento anula el deshacer pendiente y con `scope` solo lo anula si coincide; `newId()` con `crypto.randomUUID()`; `nowLocal()` en src/data/store.ts
- [X] T018 [P] Implementar `deliverFile(blob, fileName)`: usa `navigator.share({ files: [new File(...)] })` si `navigator.canShare` lo permite y, si no, descarga con enlace `download` y `URL.createObjectURL` en src/data/exportImport.ts

### Service worker y arranque

- [X] T019 [P] Crear el service worker (research R5): constantes `__PRECACHE__` (lista de URLs) y `__VERSION__` sustituidas en build; `install` precarga todas las URLs en la caché `lastries-<version>` sin `skipWaiting` automático; mensaje `ACTIVATE` que ejecuta `self.skipWaiting()` (único punto donde se llama); `activate` borra cachés `lastries-*` distintas; `fetch` responde solo desde caché (navegaciones → `index.html` en caché); mensaje `GET_VERSION` que responde `__VERSION__` en public/sw.template.js
- [X] T020 [P] Crear script post-build ejecutable con `node scripts/gen-sw-manifest.ts`: recorre `dist/` (excluye `sw.template.js` y mapas de fuente), calcula versión como hash SHA-256 truncado del contenido de todos los ficheros, sustituye `__PRECACHE__` y `__VERSION__` en `dist/sw.template.js`, escribe `dist/sw.js`, borra la plantilla de `dist/` e imprime número de ficheros y MB totales en scripts/gen-sw-manifest.ts
- [X] T021 [P] Implementar enrutado por `location.hash` (`#/`, `#/session`, `#/exercises`, `#/exercises/:id`, `#/routines`, `#/history/:exerciseId`, `#/volume`, `#/ingredients`, `#/recipes`, `#/recipes/:id`, `#/plan`, `#/day/:date`, `#/shopping`, `#/progress`, `#/settings`) con `useRoute()` y `navigate(path)` en src/ui/router.ts
- [X] T022 [P] Implementar componente `UndoToast` que muestra el deshacer registrado en el store como aviso no modal en la parte inferior con botón "Deshacer", sin bloquear toques en el resto de la pantalla, visible durante al menos 8 s, hasta el siguiente registro o hasta que se anule con `clearUndo` (FR-009) en src/ui/components/UndoToast.tsx
- [X] T023 [P] Implementar `NumberField`: `inputmode="decimal"`, acepta coma o punto, llama a `onValue(number | null)` en cada evento `input` (no en `blur`), valida con una función recibida por props y muestra el motivo en texto neutro, admite marca visual opcional "sin confirmar" en src/ui/components/NumberField.tsx
- [X] T024 [P] Implementar `LineChart` en SVG propio (research R13): una o varias series `{ label, points: { date: LocalDate, value: number }[] }`, eje temporal, escala automática con margen, puntos y línea en colores neutros, sin zonas ni umbrales coloreados, ancho 100 % adaptable en src/ui/components/LineChart.tsx
- [X] T025 Implementar `MigrationError`: muestra el motivo recibido de `startupMigrate`, explica en tono neutro que los datos no se han modificado y ofrece "Exportar copia previa" que entrega `preMigrationBackup.document` como `lastries-copia-previa-AAAA-MM-DD.json` con `deliverFile` en src/ui/screens/MigrationError.tsx
- [X] T026 Implementar `Settings` (base): versión en uso (respuesta `GET_VERSION` del SW activo), versión en espera si `registration.waiting` existe con botón "Aplicar ahora" desactivado mientras exista una sesión con `endedAt = null`, que envía `ACTIVATE` a `registration.waiting` y recarga al recibir `controllerchange` (si no se pulsa, la versión nueva se aplica en el siguiente arranque en frío), estado de persistencia (`meta.persistGranted`) y fecha de `meta.lastExportAt` en texto neutro, sin recordatorios en src/ui/screens/Settings.tsx
- [X] T027 Implementar `Home` (armazón): contenedor de secciones en el orden de contracts/logging-flows.md (sesión, hoy planificado, frecuentes, ayer, resumen, navegación) con la navegación a Entrenamiento, Alimentación, Compra, Progreso y Ajustes; las secciones se rellenan en cada historia en src/ui/screens/Home.tsx
- [X] T028 Implementar arranque: abrir DB → `startupMigrate()` (si falla, renderizar solo `MigrationError`) → `loadAll()` en el store → en el primer arranque `navigator.storage.persist()` y guardar `meta.persistGranted` → registrar `sw.js` solo en producción → renderizar shell con router, `UndoToast` e importar `styles.css` en src/main.tsx

**Checkpoint**: `npm test` pasa `exportFormat` y `migrations`; `npm run build && npm run preview` arranca la app vacía offline con Home y Ajustes.

---

## Phase 3: User Story 1 - Registrar una sesión de entrenamiento (Priority: P1) 🎯 MVP

**Goal**: catálogo base empaquetado, rutinas y sesiones con series precargadas desde la última vez,
borrador persistente, selector de RIR, calentamientos, sesión vacía, cambios sobre la marcha y
deshacer.

**Independent Test**: con el catálogo base, crear una rutina, iniciar sesión, registrar
calentamientos y series efectivas, forzar el cierre con un valor tecleado sin confirmar, reabrir,
confirmar, finalizar e iniciar otra sesión comprobando "última vez", precarga y rutina intacta
(quickstart §2, pasos 1–9).

### Catálogo base

- [X] T029 [US1] Añadir `sharp` a devDependencies (versión exacta) y crear el script puntual según research R6: constante `SOURCE_COMMIT` con el SHA de free-exercise-db; descargar `dist/exercises.json` e imágenes `exercises/<path>` de ese commit; incluir solo categorías `strength`, `powerlifting`, `olympic weightlifting`, `strongman`, `plyometrics`; mapear `id → baseId`, `name → originalName` y `name`, `primaryMuscles[]`, `secondaryMuscles[]` (eliminando de secundarios los que estén en primarios), `equipment` (valor único o null), `images[]`; ignorar `force`, `level`, `mechanic`, `instructions`; traducir con las tablas literales de research R6 (músculos: abdominals → Abdominales … triceps → Tríceps; equipamiento: body only → Peso corporal … e-z curl bar → Barra Z, null → null); recomprimir cada imagen con `sharp().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 70 })` a `public/catalog/img/<baseId>/<n>.webp`; escribir `public/catalog/exercises.json` como `{ catalogVersion: SOURCE_COMMIT, muscles: [{ baseKey, name }], exercises: [{ baseId, originalName, primary: baseKey[], secondary: baseKey[], equipment, images: path[] }] }`; imprimir número de ejercicios, imágenes y MB; terminar con código de error si el total supera 40 MB en scripts/build-catalog.ts
- [X] T030 [US1] Ejecutar `npm run catalog`, comprobar que el resultado ronda 739 ejercicios, 1.472 imágenes y ≈ 20 MB (research R6), y dejar la salida versionada en public/catalog/
- [X] T031 [US1] Implementar `seedCatalog(state)`: crear los 17 `MuscleGroup` con `baseKey` si faltan (por `baseKey`); insertar como `Exercise` con `source: "base"`, `demos: [{ kind: "bundled", path }]`, `archived: false` solo los `baseId` que no existan; nunca modificar ejercicios existentes; guardar `meta.catalogVersion`; todo en una transacción mediante `commit`; invocarlo desde el arranque tras `loadAll()` en src/data/catalogSeed.ts y src/main.tsx

### Lógica y acciones

- [X] T032 [P] [US1] Implementar `lastTime(sessions, exerciseId, excludeSessionId)` (SessionExercise con ese ejercicio y al menos una serie, de la sesión más reciente por `startedAt`, excluida la actual) y `pendingSets(last, target, confirmedCount, draft)` exactamente según contracts/domain-functions.md#prefill (plantilla desde `last` con `failure` y `warmup`; relleno con la última efectiva hasta `targetSets`; sin `last`, `targetSets` series `{ weightKg: null, reps: repsMin, rir: targetRir, failure: false, warmup: false }` o una vacía; `draft` sustituye a la primera pendiente con `isDraft: true`) en src/domain/prefill.ts
- [X] T033 [P] [US1] Implementar gestión de medios propios: `addMedia(file)` que acepta solo `image/jpeg`, `image/png`, `image/webp`, `image/gif`, guarda Blob con `fileName = <id>.<ext>` y `byteSize`; `getMediaUrl(mediaId)` con caché de object URLs; `removeMediaIfOrphan(mediaId)` que borra el `Media` si ningún ejercicio lo referencia en src/data/media.ts
- [X] T034 [US1] Implementar acciones de catálogo y rutinas: `createMuscleGroup`/`renameMuscleGroup` (nombre "1–60 caracteres, único (normalizado)") y `deleteMuscleGroup` (prohibido si algún ejercicio lo usa); `createExercise`/`updateExercise` (nombre "1–120 caracteres", `primaryMuscleIds` "≥ 1 elemento, sin repetidos", `secondaryMuscleIds` "disjunto de `primaryMuscleIds`", `equipment` texto o null, `demos`; `originalName` y `baseId` inmutables); `archiveExercise`/`unarchiveExercise`; `deleteExercise` solo si ninguna rutina ni sesión lo referencia (si no, devuelve error que ofrece archivar); `createRoutine`/`updateRoutine` (nombre "1–60 caracteres", items con `targetSets` "1–20", `repsMin` "1–100", `repsMax` "`repsMin` ≤ `repsMax` ≤ 100", `targetRir` "0–10"); `deleteRoutine` (no afecta a sesiones) en src/data/actions/training.ts
- [X] T035 [US1] Implementar acciones de sesión en el mismo fichero: `startSessionFromRoutine(routineId)` (copia items como `target`, `routineName`, `date` y `startedAt` actuales; error si ya hay una sesión con `endedAt = null`); `startEmptySession()`; `addSessionExercise(exerciseId)` (target null); `removeSessionExercise(index)`; `moveSessionExercise(from, to)` (sin tocar la rutina); `saveDraft(sessionId, exerciseIndex, draft)` que llama a `clearUndo("set:<sessionId>:<exerciseIndex>")` y escribe la sesión en IndexedDB en cada llamada; `confirmSet(sessionId, exerciseIndex, values)` que añade `WorkSet` con `confirmedAt`, pone `draft = null` en la misma transacción y registra deshacer con `scope: "set:<sessionId>:<exerciseIndex>"` que, solo si `draft` sigue siendo null, retira la serie y la devuelve a `draft` (FR-009); `updateSet`/`deleteSet`/`toggleWarmup` para series confirmadas (FR-007, FR-019); `setFailure` que fuerza `rir = 0`; `finishSession` que fija `endedAt` y descarta todos los `draft` en src/data/actions/training.ts

### UI

- [X] T036 [P] [US1] Implementar `RirSelector`: una fila de 7 botones `0 1 2 3 4 5 Fallo` de al menos 44 px sin desplazamiento en 360 px; un toque selecciona; "Fallo" emite `{ rir: 0, failure: true }`; si el valor actual es 6–10 añade un octavo botón seleccionado con ese valor (FR-019, research R11) en src/ui/components/RirSelector.tsx
- [X] T037 [P] [US1] Implementar `ExercisePicker`: búsqueda que coincide si el texto normalizado está contenido en `name` o en `originalName` (FR-025), excluye archivados, muestra nombre actual, grupos primarios y miniatura de la primera demostración en src/ui/components/ExercisePicker.tsx
- [X] T038 [US1] Implementar pantalla de ejercicios: lista con búsqueda, filtro por grupo muscular y archivados; detalle con nombre, grupos primarios y secundarios, equipamiento y demostraciones (WebP empaquetadas por ruta relativa y medios propios por object URL, GIF animados incluidos); formulario de alta/edición con selección múltiple de primarios (mínimo 1) y secundarios (sin los primarios), añadir imagen o GIF desde fichero, quitar y ordenar demostraciones, archivar/eliminar; sección para renombrar, crear y eliminar grupos musculares (FR-011–FR-013) en src/ui/screens/Exercises.tsx
- [X] T039 [US1] Implementar pantalla de rutinas: lista, alta/edición con nombre, añadir ejercicios con `ExercisePicker`, reordenar y editar `targetSets`, `repsMin`, `repsMax`, `targetRir` con las reglas de T034, eliminar, e "Iniciar sesión" desde cada rutina (FR-014, FR-015) en src/ui/screens/Routines.tsx
- [X] T040 [US1] Implementar pantalla de sesión: por ejercicio, objetivos (si hay), bloque "Última vez" con las series de `lastTime` y calentamientos diferenciados, series confirmadas editables y series pendientes de `pendingSets`; la primera pendiente editable con `NumberField` para peso y repeticiones, `RirSelector` y conmutador de calentamiento, cada cambio llama a `saveDraft` y los valores de borrador se marcan "sin confirmar"; botón "Confirmar" de un toque que llama a `confirmSet`; añadir ejercicio con `ExercisePicker`, quitar y reordenar; "Finalizar sesión"; al abrir tras un cierre, restaura borradores (FR-016–FR-021) en src/ui/screens/Session.tsx
- [X] T041 [US1] Rellenar la sección de sesión de Home según contracts/logging-flows.md: con sesión en curso, ejercicio en curso según la definición de contracts/logging-flows.md (el de la última serie confirmada si le quedan pendientes; si no, el primero con pendientes en el orden de la sesión), "Última vez" resumida y siguiente serie precargada o borrador con botón "Confirmar" (1 interacción) y acceso a la sesión completa; sin sesión, botones "Iniciar <rutina>" para las 3 rutinas usadas más recientemente e "Iniciar sesión vacía" en src/ui/screens/Home.tsx
- [X] T042 [US1] Registrar las rutas `#/session`, `#/exercises`, `#/exercises/:id` y `#/routines` en el shell y enlazar "Entrenamiento" desde la navegación de Home en src/main.tsx

**Checkpoint**: US1 completa y validable con quickstart §2 pasos 1–9 en escritorio y en el teléfono.

---

## Phase 4: User Story 2 - Registrar lo que come y ver el total del día frente a sus objetivos (Priority: P2)

**Goal**: ingredientes (manual y CSV), consumos con valores congelados, momento por hora, frecuentes,
repetir comidas de ayer, objetivos con vigencia y resumen neutro del día.

**Independent Test**: importar el CSV de ejemplo, configurar objetivos, registrar consumos desde
frecuentes y desde el registro del día, repetir la comida de ayer tras corregir un ingrediente y
comprobar totales, diferencias neutras e inmutabilidad de días pasados (quickstart §3 pasos 1–3, 5–7).

### Lógica

- [X] T043 [P] [US2] Implementar según contracts/domain-functions.md: `snapshotFor(ref, ingredients, recipes)` (por 100 unidades base para ingrediente; por ración con `recipeNutrition` para receta), `consumptionTotals(c)` (`nutritionPerUnit × amount / 100` o `× servings`), `recipeNutrition(recipe, ingredients)` (`total` y `perServing = total / baseServings`), `dayTotals(consumptions, date)`, `goalAt(goals, date)` (mayor `effectiveFrom` ≤ fecha) y `difference(total, goal)` (valor − objetivo solo donde el objetivo no es null) en src/domain/nutrition.ts
- [X] T044 [P] [US2] Implementar `momentAt(moments, time)`: momentos ordenados por `startTime`; último con `startTime ≤ time`; si ninguno, el de `startTime` mayor (FR-040) en src/domain/mealMoment.ts
- [X] T045 [P] [US2] Implementar `frequents(consumptions, momentId, today, isArchived)`: consumos con `today − 29 ≤ date ≤ today` y ese `momentId`, agrupados por ingrediente o receta, orden por número de consumos descendente y desempate por `createdAt` más reciente, sin archivados, máximo 10, cada `ref` con la cantidad o raciones del último consumo de ese elemento en cualquier momento (FR-045) en src/domain/frequents.ts
- [X] T046 [P] [US2] Implementar `parseIngredientsCsv(text, existingNames)` según contracts/ingredients-csv.md: quitar BOM; separador `;` si aparece en la cabecera, si no `,`; comillas dobles con `""` escapado; coma decimal solo con `;`; filas vacías ignoradas; cabeceras exactas sin distinguir mayúsculas `nombre`, `unidad_base`, `kcal`, `proteinas`, `hidratos`, `grasas`, `seccion`, `formato_compra`, `formato_equivalencia` (desconocidas → error de cabecera); reglas: `nombre` "1–80 caracteres; único en el fichero y frente a ingredientes existentes (normalizado)", `unidad_base` "`g` \| `ml`", nutrientes "≥ 0", `formato_compra` y `formato_equivalencia` ("> 0") obligatorias juntas; devuelve `{ ok: true, value: Ingredient[] }` o `{ ok: false, errors }` con formato `fila N (nombre): motivo` contando la cabecera como fila 1 en src/domain/csvIngredients.ts

### Acciones

- [X] T047 [US2] Implementar acciones de ingredientes: `createIngredient`/`updateIngredient` (nombre "1–80 caracteres; único normalizado", `baseUnit` "`g` \| `ml`", `per100` "cada valor ≥ 0, hasta 1 decimal", `section` texto o null, `purchaseFormat` `{ name, amount > 0 }` o null); `archiveIngredient`/`unarchiveIngredient`; `deleteIngredient` solo si ninguna receta, elemento planificado ni consumo lo referencia (si no, error que ofrece archivar); `importIngredients(csvText)` que usa `parseIngredientsCsv` y crea todo en una transacción o nada en src/data/actions/food.ts
- [X] T048 [US2] Implementar acciones de momentos y objetivos: `seedMealMoments()` si no hay ninguno (Desayuno 07:00, Comida 13:00, Merienda 17:00, Cena 20:30), invocado en el arranque; `createMealMoment`/`updateMealMoment` (nombre "1–30 caracteres, único", `startTime` "único entre momentos"); `deleteMealMoment` prohibido si tiene elementos planificados o consumos o si es el último; `setGoal({ effectiveFrom, kcal, protein, carbs, fat })` (valores ≥ 0 o null; `effectiveFrom` "único", actualiza si ya existe); `deleteGoal` en src/data/actions/food.ts y src/main.tsx
- [X] T049 [US2] Implementar acciones de consumo: `addConsumption({ ref, date?, momentId? })` que por defecto usa fecha de hoy y `momentAt(moments, horaActual)`, congela `nutritionPerUnit = snapshotFor(ref)` y `createdAt`, y registra deshacer que lo elimina; `updateConsumption(id, patch)` que al cambiar solo cantidad o raciones conserva `nutritionPerUnit` y al cambiar ingrediente o receta toma una copia nueva (FR-042); `deleteConsumption`; `repeatMoment(fromDate, momentId)` que crea consumos nuevos con la misma `ref` y `momentId`, fecha de hoy y `nutritionPerUnit` recién calculado con `snapshotFor` sobre los valores vigentes (no copia los de ayer), con un único deshacer que elimina todos (FR-041) en src/data/actions/food.ts

### UI

- [X] T050 [P] [US2] Implementar `FoodPicker`: búsqueda normalizada de ingredientes no archivados (y recetas no archivadas si existen), selección de cantidad en unidad base con `NumberField` (o raciones para recetas), precargada con la última cantidad usada de ese elemento en src/ui/components/FoodPicker.tsx
- [X] T051 [US2] Implementar pantalla de ingredientes: lista con búsqueda y archivados; alta/edición con nombre, unidad base, kcal/proteínas/hidratos/grasas por 100, sección y formato de compra con las reglas de T047; archivar/eliminar; "Importar CSV" con selector de fichero, lista de errores `fila N (nombre): motivo` si falla o número de ingredientes creados si va bien (FR-030–FR-032) en src/ui/screens/Ingredients.tsx
- [X] T052 [US2] Implementar registro del día: selector de fecha, consumos agrupados por momento con cantidad y kcal/macros, añadir con `FoodPicker` en el momento elegido, editar cantidad/momento/elemento y eliminar; bloque de totales con "valor / objetivo" y diferencia con signo (p. ej. "−600 kcal") para los objetivos vigentes en esa fecha, o solo totales si no hay objetivos, sin colores ni textos valorativos (FR-041–FR-044) en src/ui/screens/DayLog.tsx
- [X] T053 [US2] Añadir a Ajustes: editor de objetivos con fecha de vigencia y lista de vigencias anteriores; editor de momentos del día con nombre y hora de inicio, mostrando la franja resultante hasta el siguiente momento (FR-040, FR-044) en src/ui/screens/Settings.tsx
- [X] T054 [US2] Rellenar en Home según contracts/logging-flows.md: "Frecuentes — <momento actual>" con `frequents()` y botón "+" que llama a `addConsumption` sin preguntar (1 interacción); "Ayer" con un botón "Repetir <momento>" por cada momento con consumos ayer; "Resumen del día" con totales frente a objetivos y diferencia neutra; enlace a registro del día en src/ui/screens/Home.tsx
- [X] T055 [US2] Registrar las rutas `#/ingredients` y `#/day/:date` y enlazar "Alimentación" desde Home en src/main.tsx

**Checkpoint**: US1 y US2 funcionan por separado; quickstart §3 pasos 1–3, 5–7.

---

## Phase 5: User Story 3 - Exportar e importar todos los datos (Priority: P3)

**Goal**: exportación completa (ZIP) y solo datos (JSON), importación por fases con aborto ante JSON
inválido, tolerancia a medios ausentes y sustitución total confirmada.

**Independent Test**: con datos en todas las áreas disponibles, exportar ambas variantes, borrar datos
del sitio, importar el ZIP (todo idéntico), importar el JSON (sin demostraciones propias, sin error),
importar un JSON con `"rir": 15` (aborta sin cambios) y cancelar una importación (quickstart §6).

- [X] T056 [US3] Implementar exportación en contracts/export-format.md: `exportDataOnly()` que serializa `buildDocument` con `JSON.stringify(doc, null, 2)` (UTF-8 sin BOM, `\n`) y entrega `lastries-AAAA-MM-DD.json`; `exportFull()` que crea con `fflate.zipSync` un ZIP con `lastries.json` (mismo texto) y `media/<fileName>` por cada `Media` leyendo sus Blobs de IndexedDB, sin imágenes del catálogo base, y entrega `lastries-AAAA-MM-DD.zip`; ambas actualizan `meta.lastExportAt` en src/data/exportImport.ts
- [X] T057 [US3] Implementar `prepareImport(file)` con las fases 1–5 de contracts/export-format.md: (1) `.zip` → `fflate.unzipSync` y localizar `lastries.json` en la raíz, `.json` → texto; si no, error "El fichero no es una exportación de Lastries"; (2) `JSON.parse` con error de sintaxis y posición, `format === "lastries"`; (3) `migrate`; (4) `validateDocument` con lista de errores por ruta; (5) para cada `media[i]` buscar `media/<fileName>` en el ZIP y, si falta o la entrada es JSON suelto, eliminar ese `Media` y sus `DemoRef` contando cuántas; devuelve `{ ok: true, document, blobs, missingMedia, summary }` (nº de sesiones, series, consumos, ingredientes, recetas, pesajes) o `{ ok: false, errors }` sin tocar IndexedDB en src/data/exportImport.ts
- [X] T058 [US3] Implementar `commitImport(prepared)` (fases 6–7): `replaceAll(document, { schemaVersion: SCHEMA_VERSION }, blobs)` (T015) en una única transacción que sustituye todos los almacenes salvo el resto de `meta` y escribe los Blobs importados, sin transacción propia; si la transacción falla, se revierte y se informa; al terminar, recargar el estado en memoria con `loadAll()` y ejecutar `seedCatalog` (solo inserta `baseId` ausentes); nunca fusiona (FR-004) en src/data/exportImport.ts
- [X] T059 [US3] Añadir a Ajustes la sección de datos: botones "Exportar todo (con imágenes)" y "Exportar solo datos"; "Importar" con `<input type="file" accept=".zip,.json">`; si `prepareImport` falla, lista de errores; si va bien, resumen, nota neutra "N demostraciones no estaban disponibles" cuando proceda y aviso "Se sustituirán todos los datos actuales" con "Importar" y "Cancelar"; cancelar no modifica nada (FR-003, FR-004) en src/ui/screens/Settings.tsx

**Checkpoint**: US3 validable con quickstart §6 sobre los datos de US1 y US2.

---

## Phase 6: User Story 4 - Recetas con medidas caseras y escalado de raciones (Priority: P4)

**Goal**: medidas caseras por ingrediente, recetas con pasos, vista en gramos o medidas caseras con
redondeo legible y techo del 10 %, escalado de raciones y registro de recetas como consumo.

**Independent Test**: definir medidas en aceite y harina, crear receta de 2 raciones, alternar vistas
y escalar a 3 comprobando "2 cucharadas"/"3 cucharadas", "4 y 1/2 cucharadas" → "6 y 3/4
cucharadas" y "1,8 g" (quickstart §3 paso 4).

### Tests (principio VII) ⚠️ escribir primero y verificar que fallan

- [X] T060 [P] [US4] Escribir tests de `toHousehold`, `roundToReadable` y `pluralize` con todos los casos mínimos de contracts/domain-functions.md: 27 g / cucharada 13,5 → "2 cucharadas"; 40,5 g → "3 cucharadas"; 100 g / vaso 150 → "2/3 de vaso"; 45 g / vaso 150 + cucharada 10 → "4 y 1/2 cucharadas"; 1,8 g / cucharadita 6 → "1,8 g"; 29,4 g / cucharada 15 → "2 cucharadas"; 50 g sin medidas → "50 g"; además 67,5 g / vaso 150 + cucharada 10 → "6 y 3/4 cucharadas"; empate de redondeo elige el mayor; nunca "1 y 1/1"; plurales vaso→vasos, unidad→unidades en tests/domain/household.test.ts
- [X] T061 [P] [US4] Escribir tests de `scaleFactor` y `scaleRecipeLines`: 2 raciones con 27 g escaladas a 3 → 40,5 g; escalar a las raciones base devuelve lo original; 2 → 1 → 2 devuelve lo original; `targetServings ≤ 0` o `baseServings ≤ 0` lanza error en tests/domain/scaling.test.ts

### Lógica y acciones

- [X] T062 [P] [US4] Implementar `toHousehold`, `roundToReadable` y `pluralize` exactamente según las reglas 1–3 y el formato de texto de contracts/domain-functions.md (medidas de mayor a menor; candidatos `n + f` con `f ∈ {0, 1/4, 1/3, 1/2, 2/3, 3/4}` y `n + 1`, descartando 0; más cercano y en empate el mayor; aceptar si `|r − v| / v ≤ 0,10`; si ninguna, unidad base con 1 decimal y coma decimal) hasta que pasen los tests de T060 en src/domain/household.ts
- [X] T063 [P] [US4] Implementar `scaleFactor` y `scaleRecipeLines` (`factor = targetServings / baseServings`, sin redondear) hasta que pasen los tests de T061 en src/domain/scaling.ts
- [X] T064 [US4] Implementar acciones: `setHouseholdMeasures(ingredientId, measures)` (`name` "1–30", en singular, "nombres únicos dentro del ingrediente", `amount` "> 0 con hasta 1 decimal"); `createRecipe`/`updateRecipe` (nombre "1–120 caracteres", `baseServings` "> 0, hasta 2 decimales", `lines` "≥ 1 línea; un ingrediente puede repetirse", `steps` ordenados); `archiveRecipe`/`unarchiveRecipe`; `deleteRecipe` solo si ningún elemento planificado ni consumo la referencia en src/data/actions/food.ts

### UI

- [X] T065 [US4] Añadir a la edición de ingredientes el editor de medidas caseras (lista de nombre + equivalencia en la unidad base, añadir, editar, quitar) con las reglas de T064 (FR-033) en src/ui/screens/Ingredients.tsx
- [X] T066 [US4] Implementar pantalla de recetas: lista con búsqueda y archivadas; edición con nombre, raciones base, líneas (ingrediente + cantidad en unidad base) y pasos ordenados; vista de receta con conmutador "Gramos / Medidas caseras", campo de raciones que recalcula con `scaleRecipeLines` ambas vistas en cada cambio, cantidades mostradas con `toHousehold` en la vista casera y en unidad base con 1 decimal en la otra, pasos, y nutrición total y por ración con `recipeNutrition` (FR-035–FR-038) en src/ui/screens/Recipes.tsx
- [X] T067 [US4] Integrar recetas en el registro: `FoodPicker` muestra recetas no archivadas con selección de raciones; `DayLog` muestra consumos de receta con sus raciones; `frequents` y `repeatMoment` ya tratan `ref.type = "recipe"` (verificar con un consumo de receta) en src/ui/components/FoodPicker.tsx y src/ui/screens/DayLog.tsx
- [X] T068 [US4] Registrar las rutas `#/recipes` y `#/recipes/:id` y enlazarlas desde Alimentación en src/main.tsx

**Checkpoint**: `household` y `scaling` en verde; quickstart §3 paso 4.

---

## Phase 7: User Story 5 - Historial por ejercicio y volumen semanal por grupo muscular (Priority: P5)

**Goal**: historial por ejercicio con evolución de series efectivas y volumen semanal (1 por primario,
0,5 por secundario, sin calentamientos, con clasificación actual).

**Independent Test**: registrar sesiones en dos semanas con press banca (con calentamientos), fondos
y peso muerto rumano y comparar historial y volumen con el cálculo manual (quickstart §2 paso 10).

### Tests (principio VII) ⚠️ escribir primero y verificar que fallan

- [X] T069 [P] [US5] Escribir tests de `weekStart` y `weeklyVolume` con los casos mínimos de contracts/domain-functions.md: press banca 3 efectivas + 3 calentamiento (P: pecho; S: tríceps, hombros) y fondos 4 efectivas (P: tríceps; S: pecho) → pecho 5, tríceps 5,5, hombros 1,5; peso muerto rumano 4 efectivas (P: isquiotibiales, glúteos; S: zona lumbar) → 4, 4, 2; solo calentamiento → 0 o ausente; series con `failure: true` cuentan como efectivas; sesión de domingo y del lunes siguiente en semanas distintas; cambiar secundarios del ejercicio cambia el resultado de semanas pasadas en tests/domain/volume.test.ts

### Lógica y UI

- [X] T070 [US5] Implementar `weeklyVolume(sessions, exercises, week)` (sesiones con `weekStart(session.date) = week`; `n` = series con `warmup = false`; cada primario suma `n`; cada secundario no primario suma `0,5 × n`; grupos actuales del ejercicio) reexportando `weekStart` de dates.ts, hasta que pasen los tests de T069 en src/domain/volume.ts
- [X] T071 [US5] Implementar `exerciseProgress(sessions, exerciseId)` que devuelve por sesión la serie efectiva de mayor peso (desempate: más repeticiones) con fecha, peso y repeticiones, y `bestSet` (mayor peso entre series efectivas, desempate por repeticiones), ambos excluyendo calentamientos (FR-022) en src/domain/volume.ts
- [X] T072 [US5] Implementar historial de ejercicio: lista por fecha descendente de sesiones con todas sus series (calentamientos diferenciados, "Fallo" indicado), edición y borrado de series pasadas (FR-007), `LineChart` con dos series (peso y repeticiones de `exerciseProgress`) y mejor marca en texto neutro; accesible desde el detalle del ejercicio y desde la sesión en src/ui/screens/ExerciseHistory.tsx
- [X] T073 [US5] Implementar volumen semanal: navegación semana anterior/siguiente (lunes a domingo, semana en curso por defecto), lista de grupos musculares con series (múltiplos de 0,5, formateo con coma), sin objetivos, colores ni valoración (FR-023, FR-024) en src/ui/screens/WeeklyVolume.tsx
- [X] T074 [US5] Registrar las rutas `#/history/:exerciseId` y `#/volume` y enlazarlas desde Entrenamiento y el detalle de ejercicio en src/main.tsx

**Checkpoint**: `volume` en verde; historial y volumen coinciden con cálculo manual.

---

## Phase 8: User Story 6 - Planificar comidas y generar la lista de la compra (Priority: P6)

**Goal**: plan por día y momento, marcar planificado como comido, lista de la compra agregada en
formatos de compra, agrupada por sección, con líneas manuales y regeneración que conserva marcas.

**Independent Test**: planificar tres días con tomate repetido y pollo, generar, marcar, añadir línea
manual, cambiar el plan y regenerar comparando con cálculo manual (quickstart §4).

### Tests (principio VII) ⚠️ escribir primero y verificar que fallan

- [X] T075 [P] [US6] Escribir tests de `aggregateRequirements`, `buildGeneratedLines`, `regenerate` y `groupBySection` con los casos mínimos de contracts/domain-functions.md: tomate 150 g + 250 g en recetas + 100 g suelto → 500 g; lentejas a 2 raciones de receta base 4 con 300 g → 150 g; fuera de rango no suma y extremos `from`/`to` sí; pollo 650 g con bandeja 500 → `packs = 2`, 500 g → `packs = 1`; sin formato → `packs = null`; regenerar con tomate marcado y misma necesidad → sigue marcado; manual conservada; pollo marcado con `packs = 1` y nueva necesidad 2 → desmarcado; sin formato y `requiredAmount` mayor → desmarcado; ingrediente ausente → línea eliminada; secciones alfabéticas con "Sin sección" al final en tests/domain/shopping.test.ts

### Lógica y acciones

- [X] T076 [US6] Implementar `aggregateRequirements`, `buildGeneratedLines` (`packs = ceil(total / purchaseFormat.amount − 1e-9)` o null), `regenerate(previous, next, from, to)` (conserva `manualLines`; `purchased` solo si la línea previa del mismo ingrediente estaba marcada y la necesidad no aumenta) y `groupBySection` hasta que pasen los tests de T075 en src/domain/shopping.ts
- [X] T077 [US6] Implementar acciones de plan: `addPlannedItem({ date, momentId, ref })` (`amount` "> 0" o `servings` "> 0"), `updatePlannedItem`, `deletePlannedItem`, `copyPlannedDay(from, to)`, `markPlannedEaten(plannedItemId, adjustedRef?)` que crea un `Consumption` con `plannedItemId`, `ref` del plan (o ajustada), fecha y momento del plan y `nutritionPerUnit` congelado con `snapshotFor`, con deshacer que elimina el consumo; `isPlannedEaten(plannedItemId)` en src/data/actions/planning.ts
- [X] T078 [US6] Implementar acciones de compra: `generateShoppingList(from, to)` (`from ≤ to`) que calcula y guarda `regenerate(listaActual, ...)` en el registro `id: "current"` sin pedir confirmación; `togglePurchased(ingredientId | manualId)`; `addManualLine({ text: 1–120, quantity: string | null })`, `updateManualLine`, `deleteManualLine` en src/data/actions/planning.ts

### UI

- [X] T079 [US6] Implementar plan de comidas: vista semanal (lunes a domingo) con columnas o bloques por día y filas por momento; añadir receta (raciones) o ingrediente (cantidad) con `FoodPicker`; editar y eliminar; indicador de comido; botón "Comido" por elemento del día actual; copiar un día a otro (FR-037, FR-039) en src/ui/screens/MealPlan.tsx
- [X] T080 [US6] Implementar lista de la compra: selector de rango y "Generar"; líneas agrupadas con `groupBySection` mostrando "N <formato en plural>" y la cantidad necesaria en unidad base, o solo la cantidad si no hay formato; casilla de comprado por línea; líneas manuales con alta, edición y borrado; rango de la lista vigente visible (FR-050–FR-055) en src/ui/screens/ShoppingList.tsx
- [X] T081 [US6] Rellenar en Home la sección "Hoy planificado" con los elementos del plan de hoy, estado de comido y botón "Comido" que llama a `markPlannedEaten` (1 interacción) según contracts/logging-flows.md en src/ui/screens/Home.tsx
- [X] T082 [US6] Registrar las rutas `#/plan` y `#/shopping` y enlazar "Compra" y "Plan" desde Home en src/main.tsx

**Checkpoint**: `shopping` en verde; quickstart §4.

---

## Phase 9: User Story 7 - Registrar peso y medidas corporales (Priority: P7)

**Goal**: pesaje diario con media móvil semanal y medidas corporales por tipo con evolución.

**Independent Test**: pesos 80,0 (lunes), 80,6 (miércoles) y 79,8 (domingo) → domingo muestra 79,8 y
media 80,1; registrar cintura en varias fechas y ver su evolución (quickstart §5).

- [X] T083 [P] [US7] Implementar `movingAverage(weights, date)`: media de pesajes con `date − 6 ≤ fecha ≤ date`, `null` si no hay (FR-061) en src/domain/bodyweight.ts
- [X] T084 [US7] Implementar acciones de progreso: `setBodyWeight(date, kg)` (clave `date`, "un valor por día", `kg` "> 0, 1 decimal"; sustituye si existe), `deleteBodyWeight(date)`; `seedMeasurementTypes()` si no hay ninguno (Cintura, Cadera, Pecho, Brazo, Muslo), invocado en el arranque; `createMeasurementType`/`updateMeasurementType` (nombre "1–30, único", `order`), `deleteMeasurementType` prohibido si tiene medidas; `setBodyMeasurement(typeId, date, cm)` (`cm` "> 0, 1 decimal", "único junto con `typeId`"; sustituye si existe), `deleteBodyMeasurement` en src/data/actions/progress.ts y src/main.tsx
- [X] T085 [US7] Implementar pantalla de progreso: registro rápido de peso de hoy con `NumberField`; lista por fecha con peso diario y media móvil; `LineChart` con dos series (diario y media); selector de tipo de medida con alta de valor por fecha, lista y `LineChart`; edición y borrado de registros pasados; editor de tipos de medida; todo sin valoraciones (FR-060–FR-062) en src/ui/screens/Progress.tsx
- [X] T086 [US7] Registrar la ruta `#/progress` y enlazar "Progreso" desde Home en src/main.tsx

**Checkpoint**: las siete historias funcionan por separado.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: verificación de criterios transversales, rendimiento y despliegue.

- [X] T087 [P] Crear script que genera una exportación sintética de 5 años válida con `validateDocument` (≈ 750 sesiones con ≈ 15.000 series incluidos calentamientos, ≈ 7.000 consumos, 150 ingredientes, 40 recetas, pesajes diarios) en `tests/fixtures/five-years.json`, ejecutable con `node scripts/gen-five-years.ts` en scripts/gen-five-years.ts
- [X] T088 Importar `five-years.json` en un móvil de gama media (o Chromium con CPU 4× ralentizada) y medir: arranque en frío < 2 s; historial de ejercicio, resumen del día y volumen semanal < 1 s (SC-010); confirmar una serie < 100 ms. Si algún objetivo falla, optimizar solo el cálculo afectado (p. ej. índice en memoria `exerciseId → sesiones`) y anotar el resultado en specs/001-gym-nutrition-tracker/quickstart.md
- [X] T089 [P] Revisar todas las pantallas contra el principio V y SC-011: sin rachas, logros, avisos de incumplimiento, colores rojo/verde ni textos valorativos; diferencias frente a objetivos solo numéricas; corregir en los ficheros afectados de src/ui/
- [ ] T090 [P] Verificar el presupuesto de interacciones de contracts/logging-flows.md en el teléfono (serie precargada 1, borrador restaurado 1, planificado 1, frecuente 1, repetir ayer 1, iniciar desde rutina + confirmar 2) y que ningún flujo abre diálogos; corregir en src/ui/screens/Home.tsx o src/ui/screens/Session.tsx si no se cumple
- [X] T091 [P] Auditoría sin conexión: con `npm run preview` y DevTools en "Offline", recargar y recorrer todas las pantallas incluidas imágenes del catálogo; en Network, ninguna petición a orígenes externos durante una sesión completa; `dist/sw.js` lista todos los ficheros de `dist/` incluido `catalog/`; ningún enlace a CDN en index.html ni en src/
- [X] T092 [P] Crear flujo de despliegue en GitHub Pages que ejecute `npm ci`, `npm test`, `npm run build` y publique `dist/` en .github/workflows/deploy.yml
- [ ] T093 Ejecutar la validación completa de specs/001-gym-nutrition-tracker/quickstart.md §1–§9, incluida la instalación en el teléfono con modo avión, el descarte de la app en segundo plano con borrador y la comprobación de actualización diferida

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias.
- **User Stories (Phase 3–9)**: dependen de Foundational. Orden recomendado por prioridad P1 → P7.
- **Polish (Phase 10)**: después de las historias que se quieran entregar.

### User Story Dependencies

| Historia | Depende de | Motivo |
|----------|------------|--------|
| US1 (P1) | Foundational | — |
| US2 (P2) | Foundational | Independiente de US1; comparte `Home.tsx` (secciones distintas) |
| US3 (P3) | Foundational | Exporta lo que exista; con más historias hechas cubre más datos, pero el validador completo está en Foundational |
| US4 (P4) | US2 | Medidas caseras se editan en ingredientes; recetas se registran como consumo |
| US5 (P5) | US1 | Necesita sesiones y ejercicios |
| US6 (P6) | US2 (y US4 para planificar recetas) | Plan usa ingredientes, `FoodPicker` y consumos; con solo US2 funciona con ingredientes sueltos |
| US7 (P7) | Foundational | — |

### Within Each Phase

- Tests (T011, T013, T060, T061, T069, T075) antes de su implementación, fallando primero.
- `src/domain/` → `src/data/actions/` → `src/ui/` → rutas en `src/main.tsx`.
- Tareas sobre el mismo fichero (`Home.tsx`, `Settings.tsx`, `main.tsx`, `actions/food.ts`,
  `actions/training.ts`) son secuenciales.

### Parallel Opportunities

- Setup: T002–T007.
- Foundational: T009, T010, T011, T013, T018, T019–T024 en paralelo tras T008.
- US1: T032, T033, T036, T037 en paralelo tras T031.
- US2: T043–T046 y T050 en paralelo.
- US4: T060–T063 en paralelo (tests y funciones puras).
- US5: T069 en paralelo con T072–T073 una vez definida la firma de exerciseProgress.
- US7 completa puede desarrollarse en paralelo con US2–US6.
- Polish: T087, T089–T092.

---

## Parallel Example: User Story 1

```bash
# Tras sembrar el catálogo (T031):
Task: "Implementar lastTime y pendingSets en src/domain/prefill.ts"            # T032
Task: "Implementar gestión de medios propios en src/data/media.ts"            # T033
Task: "Implementar RirSelector en src/ui/components/RirSelector.tsx"          # T036
Task: "Implementar ExercisePicker en src/ui/components/ExercisePicker.tsx"    # T037
```

## Parallel Example: User Story 4

```bash
Task: "Tests de household en tests/domain/household.test.ts"   # T060
Task: "Tests de scaling en tests/domain/scaling.test.ts"       # T061
# Después, en paralelo:
Task: "Implementar src/domain/household.ts"                     # T062
Task: "Implementar src/domain/scaling.ts"                       # T063
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 2: Foundational (incluye migraciones y service worker desde el principio).
3. Phase 3: US1.
4. **Parar y validar**: quickstart §2 pasos 1–9 en el teléfono, en modo avión y con la app descartada
   en segundo plano.
5. Publicar en GitHub Pages (T092 puede adelantarse) y usarla en el gimnasio.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → publicar (MVP de entrenamiento).
3. US2 → validar → publicar (registro de comidas).
4. US3 → validar → publicar. **Recomendado adelantarla justo después de US2**: a partir de aquí hay
   datos reales y la exportación es la red de seguridad.
5. US4, US5, US6, US7 → validar y publicar cada una.
6. Polish.

Cada publicación que cambie la forma de algún registro debe incrementar `SCHEMA_VERSION` y añadir su
migración y fixture (research R14) antes de desplegar.

---

## Notes

- [P] = ficheros distintos sin dependencias pendientes.
- [USn] = trazabilidad con la historia de spec.md.
- Verificar que los tests fallan antes de implementar.
- Hacer commit tras cada tarea o grupo lógico.
- Evitar: tareas vagas, conflictos en el mismo fichero, dependencias entre historias que rompan su
  independencia.
