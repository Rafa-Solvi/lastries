# Implementation Plan: Registro personal de entrenamiento y alimentación

**Branch**: `001-gym-nutrition-tracker` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-gym-nutrition-tracker/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

App personal para un único usuario que registra entrenamiento de fuerza (rutinas, sesiones con
series precargadas desde la última vez, calentamientos, historial y volumen semanal por grupo
muscular) y alimentación (ingredientes con medidas caseras propias, recetas escalables, plan,
consumos con valores congelados frente a objetivos con vigencia, lista de la compra) más peso y
medidas corporales.

Enfoque técnico: PWA instalable en el teléfono, escrita en TypeScript con Preact y Vite, sin backend.
Todos los datos viven en IndexedDB y se cargan en memoria al arrancar; la lógica de cálculo son
funciones puras en `src/domain/` con tests obligatorios en Vitest. Un service worker propio precarga
la app y el catálogo base de free-exercise-db (filtrado, traducido y recomprimido a WebP), de modo
que todo funciona sin red. La exportación produce un ZIP (JSON + medios propios) o el JSON solo, y la
importación valida antes de sustituir todo en una única transacción. Los valores tecleados en una
serie sin confirmar se guardan como borrador con cada cambio, cada registro rápido se puede deshacer
y una cadena de migraciones versionada, compartida por la importación y el arranque, protege el
histórico frente a cambios de esquema.

## Technical Context

**Language/Version**: TypeScript 5.x en modo `strict`; Node 22 LTS para herramientas (research R2)

**Primary Dependencies**: runtime: `preact`, `idb`, `fflate`. Desarrollo: `vite`,
`@preact/preset-vite`, `typescript`, `vitest`; `sharp` solo en el script puntual del catálogo
(research R2, R3, R6, R7)

**Storage**: IndexedDB (16 almacenes, ver [data-model.md](data-model.md)); Cache Storage para la app
y el catálogo base; Blobs de medios propios en IndexedDB (research R3, R5)

**Testing**: Vitest sobre funciones puras de `src/domain/`; sin tests de UI (research R12)

**Target Platform**: PWA en navegadores móviles actuales (Chrome para Android, Safari para iOS,
instalada en pantalla de inicio); desarrollo en Chromium de escritorio (research R1)

**Project Type**: aplicación web cliente (PWA), proyecto único sin backend

**Performance Goals**: confirmar una serie precargada y ver la siguiente < 100 ms; historial,
resumen del día y volumen semanal < 1 s con 5 años de datos (SC-010); arranque en frío < 2 s con 5
años de datos

**Constraints**: 100 % sin conexión tras la instalación (FR-002, SC-005); ninguna petición de red en
tiempo de ejecución; catálogo base empaquetado ≤ 40 MB (medido: 739 ejercicios, 1.472 imágenes,
83,8 MB en JPG → ≈ 20 MB en WebP 480 px, research R6); ninguna pérdida de valores tecleados si el
sistema descarta la app (R15); datos almacenados migrables entre versiones (R14); ≤ 2 interacciones para repetir registros
conocidos ([contracts/logging-flows.md](contracts/logging-flows.md)); sin telemetría

**Scale/Scope**: 1 usuario, 1 dispositivo; ≈ 750 sesiones, ≈ 15.000 series, ≈ 7.000 consumos en 5
años; ~800 ejercicios base filtrados; ~15 pantallas

No quedan NEEDS CLARIFICATION: todas las incógnitas se resolvieron en [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra la constitución **2.0.0**.

### Evaluación inicial (antes de Phase 0)

| Principio | Estado | Evidencia |
|-----------|--------|-----------|
| I. Simplicidad sobre generalidad | ✅ | Proyecto único sin backend; sin cuentas ni sincronización; spec sin abstracciones para usuarios múltiples |
| II. Los datos son del usuario | ✅ | Todo local; FR-003/FR-004 alineados con II 2.0.0 (ZIP + solo datos, medios ausentes no fallan, JSON inválido aborta, sustitución total) |
| III. Velocidad de registro | ✅ | FR-008 acota el presupuesto a registros conocidos, igual que III 2.0.0; FR-017–019, FR-045 |
| IV. Gramos y mililitros canónicos | ✅ | FR-033/FR-034: medidas por ingrediente, cálculo solo en unidad base |
| V. Registrar y mostrar, no juzgar | ✅ | FR-005/FR-006, FR-043 diferencia numérica neutra; objetivos como datos con vigencia (FR-044) |
| VI. Dependencias mínimas, recursos empaquetados | ✅ | Plataforma PWA elegida por menor dependencia; catálogo empaquetado (FR-010) |
| VII. Tests en lógica de cálculo | ✅ | Las cuatro áreas tienen ejemplos numéricos en la spec, convertibles en tests |

**Resultado**: PASS. Sin violaciones que justificar.

### Re-evaluación tras el diseño (Phase 1)

| Principio | Estado | Evidencia en el diseño |
|-----------|--------|------------------------|
| I | ✅ | Estado en memoria + escritura en IndexedDB en lugar de capa de repositorios; router por hash y store propios; entidades hijas embebidas; campos de free-exercise-db no usados descartados (R3, R6, data-model) |
| II | ✅ | [contracts/export-format.md](contracts/export-format.md): dos variantes con el mismo JSON legible, fases de importación con aborto antes de escribir, medios ausentes tolerados solo en la fase 5, transacción única de sustitución; service worker sin peticiones de datos (R5); borrador de serie persistido con cada cambio (R15); migraciones de arranque con copia previa y sin escrituras parciales (R14) |
| III | ✅ | [contracts/logging-flows.md](contracts/logging-flows.md): 1 interacción para serie precargada, planificado, frecuente y repetir ayer; sin diálogos de confirmación; deshacer no modal (FR-009); selector de RIR de 7 botones sin desplazamiento (R11) |
| IV | ✅ | `Grams` como único tipo de cantidad en data-model; `household.ts` solo presenta; consumos guardan cantidad en unidad base y copia por unidad |
| V | ✅ | Persistencia mostrada de forma neutra sin recordatorios (R4); gráficos SVG sin zonas valorativas (R13); objetivos `Goal` con `effectiveFrom`, ningún umbral en código |
| VI | ✅ | 3 dependencias de runtime (`preact`, `idb`, `fflate`), cada una justificada frente a escribirla (R2, R3, R7); `sharp` solo en script de desarrollo; sin CDNs ni claves; catálogo en `public/catalog/` |
| VII | ✅ | [contracts/domain-functions.md](contracts/domain-functions.md) marca `household`, `scaling`, `shopping` y `volume` como TEST OBLIGATORIO con casos mínimos; funciones puras sin DOM ni IndexedDB |

**Resultado**: PASS. "Complexity Tracking" vacío.

## Project Structure

### Documentation (this feature)

```text
specs/001-gym-nutrition-tracker/
├── plan.md              # Este fichero
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── export-format.md
│   ├── ingredients-csv.md
│   ├── domain-functions.md
│   └── logging-flows.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, no creado aquí)
```

### Source Code (repository root)

```text
index.html
package.json
tsconfig.json
vite.config.ts
public/
├── manifest.webmanifest
├── icons/
├── sw.template.js               # service worker; la lista de ficheros se inyecta tras el build
└── catalog/
    ├── exercises.json           # catálogo base filtrado y traducido (R6)
    └── img/<baseId>/0.webp, 1.webp
scripts/
├── build-catalog.ts             # puntual: free-exercise-db → public/catalog (usa sharp)
└── gen-sw-manifest.ts           # post-build: genera dist/sw.js con la lista de ficheros y versión
src/
├── main.tsx                     # arranque: abrir DB, cargar estado, sembrar catálogo, registrar SW
├── domain/                      # funciones puras (contracts/domain-functions.md)
│   ├── types.ts
│   ├── dates.ts
│   ├── household.ts             # [test obligatorio]
│   ├── scaling.ts               # [test obligatorio]
│   ├── shopping.ts              # [test obligatorio]
│   ├── volume.ts                # [test obligatorio]
│   ├── prefill.ts
│   ├── nutrition.ts
│   ├── mealMoment.ts
│   ├── frequents.ts
│   ├── bodyweight.ts
│   ├── validation.ts            # reglas de campo compartidas (rangos, decimales)
│   ├── csvIngredients.ts
│   ├── exportFormat.ts          # validación del documento
│   └── migrations.ts            # SCHEMA_VERSION y cadena de migraciones (R14)
├── data/
│   ├── db.ts                    # apertura IndexedDB (DB_VERSION), migración de arranque con copia previa
│   ├── store.ts                 # estado en memoria, suscripción y mutaciones
│   ├── catalogSeed.ts
│   ├── media.ts                 # Blobs y object URLs
│   └── exportImport.ts          # ZIP/JSON con fflate, fases de importación, share/download
└── ui/
    ├── router.ts
    ├── styles.css
    ├── components/              # NumberField, RirSelector, LineChart (SVG), UndoToast, FoodPicker, ExercisePicker…
    └── screens/
        ├── Home.tsx
        ├── Session.tsx
        ├── Routines.tsx
        ├── Exercises.tsx
        ├── ExerciseHistory.tsx
        ├── WeeklyVolume.tsx
        ├── Ingredients.tsx
        ├── Recipes.tsx
        ├── MealPlan.tsx
        ├── DayLog.tsx
        ├── ShoppingList.tsx
        ├── Progress.tsx
        ├── Settings.tsx         # objetivos, momentos, tipos de medida, export/import, CSV, persistencia, versión
        └── MigrationError.tsx   # arranque bloqueado por migración fallida: error + exportar copia previa
tests/
├── fixtures/
│   └── schema-v1.json           # exportación de ejemplo por cada versión de esquema
└── domain/
    ├── household.test.ts
    ├── scaling.test.ts
    ├── shopping.test.ts
    ├── volume.test.ts
    ├── exportFormat.test.ts
    └── migrations.test.ts
```

**Structure Decision**: proyecto único de aplicación web cliente. `src/domain/` concentra la lógica
pura y es lo único con tests (principio VII); `src/data/` es la única capa que toca IndexedDB,
Cache Storage y ficheros; `src/ui/` son componentes Preact que leen del store y llaman a sus
mutaciones. No hay carpetas por capa dentro de cada pantalla ni servicios intermedios (principio I).

## Complexity Tracking

Sin violaciones de la constitución; no aplica.
