# Research: Registro personal de entrenamiento y alimentación

**Feature**: `001-gym-nutrition-tracker` | **Date**: 2026-09-14 | **Plan**: [plan.md](plan.md)

Cada apartado resuelve una incógnita del Technical Context o fija una práctica para una dependencia.
Formato: Decisión / Razón / Alternativas consideradas.

## R1. Plataforma

- **Decisión**: PWA instalable (aplicación web con manifest y service worker), usada en el teléfono
  desde la pantalla de inicio. Elegida por el usuario el 2026-09-14.
- **Razón**: funciona en Android e iPhone con un solo código, se desarrolla y prueba desde Windows
  sin toolchain móvil, y el número de dependencias es el menor de las opciones evaluadas
  (principio VI). Tras la instalación funciona sin red (principio II).
- **Alternativas**: Android nativo (Kotlin + Compose + Room): almacenamiento más robusto, pero solo
  Android y ecosistema Jetpack. Flutter: multiplataforma con SQLite, pero toolchain pesado, iOS exige
  Mac y árbol de dependencias mayor.

## R2. Lenguaje, framework de UI y build

- **Decisión**: TypeScript en modo `strict`, Preact 10 como librería de UI, Vite como bundler y
  servidor de desarrollo. Enrutado propio basado en `location.hash` (sin librería de router). Estado
  en un store propio mínimo (objeto en memoria + suscripción) sin librería de estado.
- **Razón**: Preact ofrece el modelo de componentes de React con ~4 KB y sin dependencias
  transitivas. Un router por hash y un store con suscripción son unas decenas de líneas y evitan dos
  dependencias (principios I y VI). TypeScript estricto protege la lógica de cálculo y el formato de
  exportación, que es un contrato a largo plazo.
- **Alternativas**: React (más peso, mismo modelo); Svelte/SolidJS (compilador o reactividad
  adicionales sin ventaja clara aquí); JavaScript sin framework (formularios y listas dinámicas
  numerosos harían el código más largo y frágil); preact-iso / @preact/signals (útiles pero
  prescindibles para una sola persona y ~15 pantallas).
- **Versiones**: las estables vigentes al crear el proyecto, fijadas de forma exacta en
  `package.json` (referencia: TypeScript 5.x, Vite 7 o posterior, Preact 10, Vitest 3 o posterior,
  Node 22 LTS para las herramientas).

## R3. Almacenamiento local

- **Decisión**: IndexedDB mediante la librería `idb` (envoltorio de promesas, ~1 KB). Al arrancar se
  cargan todos los registros (salvo los binarios de medios) en memoria; toda lectura y cálculo usa
  la memoria y cada mutación se escribe primero en IndexedDB en una transacción y, al confirmarse,
  se aplica al estado en memoria.
- **Razón**: IndexedDB es el único almacenamiento del navegador con capacidad suficiente para
  años de datos y para Blobs de imágenes. Con el volumen previsto (≈ 15.000 series, ≈ 7.000
  consumos en 5 años, unos pocos MB) cargar todo en memoria es instantáneo y convierte cada pantalla
  en una función pura sobre arrays, sin índices ni consultas (principio I, SC-010).
- **Alternativas**: `localStorage` (límite ~5 MB, síncrono, sin Blobs); Dexie (más API y peso de la
  necesaria); SQLite en WASM con OPFS (potente pero ~1 MB de WASM y complejidad de concurrencia);
  consultar IndexedDB pantalla a pantalla (más código y más asincronía sin necesidad a esta escala).

## R4. Persistencia frente al desalojo del navegador

- **Decisión**: en el primer arranque se llama a `navigator.storage.persist()`. En Ajustes se muestra
  de forma neutra si el almacenamiento es persistente y la fecha de la última exportación. No hay
  avisos ni recordatorios (principio V).
- **Razón**: los navegadores pueden desalojar datos de orígenes no persistentes bajo presión de
  espacio. Chrome en Android concede la persistencia a PWA instaladas; en iOS las apps añadidas a la
  pantalla de inicio tienen almacenamiento propio no sujeto a la caducidad por inactividad de
  Safari. La exportación (principio II) es la red de seguridad.
- **Alternativas**: recordatorios periódicos de exportación (rechazado: notificación valorativa,
  principio V); sincronización con la nube (fuera de alcance, principio II).

## R5. Funcionamiento sin conexión y distribución

- **Decisión**: service worker escrito a mano con una única caché versionada. Un script posterior al
  build (`scripts/gen-sw-manifest.ts`) genera la lista de todos los ficheros de `dist/` (app y
  catálogo base) y la inyecta en `dist/sw.js` junto con un hash de versión. Estrategia: precarga
  completa en `install`, respuesta solo desde caché, borrado de cachés antiguas en `activate`. La app
  se publica en un hosting estático con HTTPS (p. ej. GitHub Pages) que solo se usa para instalar y
  actualizar.
- **Razón**: el service worker necesario es muy simple (~60 líneas) porque no hay peticiones de
  datos a ningún servidor. La precarga completa garantiza que todo, incluido el catálogo base,
  funciona sin red desde el primer arranque (FR-002, SC-005).
- **Alternativas**: vite-plugin-pwa/Workbox (genera un service worker correcto pero añade runtime y
  configuración para un caso trivial); caché bajo demanda de imágenes del catálogo (incumpliría
  FR-002 para ejercicios no vistos antes).
- **Nota constitucional**: el hosting no es una dependencia en tiempo de ejecución; la app instalada
  no hace ninguna petición de red.
- **Actualizaciones**: el navegador solo comprueba si hay un `sw.js` nuevo cuando la app se abre con
  red. La versión nueva se descarga e instala en segundo plano y queda en espera; **no** se usa
  `skipWaiting` automático ni recarga automática, para no cambiar el código con una sesión en curso;
  `skipWaiting` solo se ejecuta cuando el usuario lo pide desde Ajustes y no hay sesión en curso. Si
  no se pide, se activa en el siguiente arranque en frío. Consecuencia práctica: tras publicar un
  cambio, la app mostrará la versión anterior hasta abrirla una vez con conexión y volver a abrirla.
  Ajustes muestra la versión en uso y, si hay una en espera, un botón "Aplicar ahora", desactivado
  mientras haya una sesión en curso. Si la versión nueva trae `SCHEMA_VERSION` mayor, la migración de datos (R14) se ejecuta en
  ese arranque.

## R6. Catálogo base de ejercicios (free-exercise-db)

- **Decisión**: un script de uso puntual (`scripts/build-catalog.ts`) descarga free-exercise-db en un
  commit fijado, filtra, traduce y recomprime, y deja el resultado versionado en el repositorio en
  `public/catalog/`. El build normal no accede a la red.
  - **Origen**: `dist/exercises.json` y carpetas `exercises/<id>/0.jpg, 1.jpg`. Licencia Unlicense
    (dominio público).
  - **Filtro**: se incluyen las categorías `strength`, `powerlifting`, `olympic weightlifting`,
    `strongman` y `plyometrics`; se excluyen `stretching` y `cardio`, que no se registran como peso ×
    repeticiones.
  - **Campos usados**: `id` → `baseId`, `name` → `originalName` y `name` inicial,
    `primaryMuscles[]`, `secondaryMuscles[]`, `equipment` (valor único o null), `images[]`. Se
    ignoran `force`, `level`, `mechanic`, `instructions` (principio I).
  - **Varios primarios**: el esquema de origen no limita `primaryMuscles`; se conserva el array
    completo (clarificación Q3). Si un músculo aparece en ambos arrays se elimina de los secundarios.
  - **Traducción** (tabla fija en el script): abdominals → Abdominales, abductors → Abductores,
    adductors → Aductores, biceps → Bíceps, calves → Gemelos, chest → Pecho, forearms → Antebrazos,
    glutes → Glúteos, hamstrings → Isquiotibiales, lats → Dorsales, lower back → Zona lumbar,
    middle back → Espalda media, neck → Cuello, quadriceps → Cuádriceps, shoulders → Hombros,
    traps → Trapecios, triceps → Tríceps. Equipamiento: body only → Peso corporal, machine →
    Máquina, other → Otro, foam roll → Rodillo de espuma, kettlebells → Kettlebell, dumbbell →
    Mancuernas, cable → Polea, barbell → Barra, bands → Bandas elásticas, medicine ball → Balón
    medicinal, exercise ball → Fitball, e-z curl bar → Barra Z, null → sin equipamiento.
  - **Imágenes**: recomprimidas a WebP de 480 px de ancho, calidad 70. Presupuesto total del
    catálogo ≤ 40 MB; el script informa del tamaño final y falla si lo supera.
  - **Medición (2026-09-14, rama `main`)**: 876 ejercicios en origen (strength 584, stretching 123,
    plyometrics 61, powerlifting 38, olympic weightlifting 35, strongman 21, cardio 14). Tras el
    filtro: **739 ejercicios, 1.472 imágenes, 83,8 MB** en JPG originales (58 KB de media,
    mayoritariamente 850 × 567). Muestra de 60 imágenes repartidas por el catálogo recomprimida con
    `sharp`: WebP 480 px / q70 → 13,7 KB de media, ratio 0,242, **proyección ≈ 20 MB**; 400 px / q65
    → ≈ 15 MB; 360 px / q60 → ≈ 12 MB. Se mantiene 480 px / q70: cabe con margen en el presupuesto y
    la precarga completa del service worker (R5) sigue siendo viable.
  - **Datos del filtro**: 1 ejercicio con varios primarios, 6 con un músculo en primarios y
    secundarios a la vez (se normalizan) y 3 sin imágenes (válidos, sin demostración).
- **Razón**: empaquetar el catálogo cumple los principios II y VI; procesarlo una vez y versionar el
  resultado hace el build reproducible y sin red. Recomprimir reduce la precarga del service worker
  a un tamaño asumible en el teléfono.
- **Alternativas**: enlazar las imágenes de GitHub (prohibido, principio VI); empaquetar los JPG
  originales (precarga mucho mayor); traducir los ~800 nombres (descartado en la clarificación Q2).
- **Dependencia de desarrollo**: `sharp` para recomprimir imágenes, solo en el script puntual; no
  forma parte de la app.

## R7. Exportación e importación

- **Decisión**:
  - Formato de contenedor ZIP generado y leído con `fflate` (~8 KB, sin dependencias). Exportación
    completa: `lastries-AAAA-MM-DD.zip` con `lastries.json` y `media/<mediaId>.<ext>`. Exportación
    solo datos: `lastries-AAAA-MM-DD.json`, byte a byte el mismo documento.
  - JSON con sangría de 2 espacios, claves en inglés estables y un campo `schemaVersion`
    ([contracts/export-format.md](contracts/export-format.md)).
  - Entrega del fichero con `navigator.share({ files })` cuando está disponible (hoja de compartir
    del móvil) y descarga con enlace `download` en caso contrario. Importación con
    `<input type="file" accept=".zip,.json">`.
  - Importación en cuatro fases: leer contenedor → parsear y migrar JSON → validar (tipos, rangos,
    unicidad, integridad referencial) → sustituir. Cualquier fallo en las tres primeras aborta sin
    tocar nada. Los medios ausentes no son error: se eliminan esas referencias de demostración.
  - Sustitución en una única transacción IndexedDB que vacía todos los almacenes y escribe los
    importados; si falla, IndexedDB revierte la transacción completa (FR-004, sin fusión).
  - Validación escrita a mano sobre los tipos TypeScript, con mensajes que incluyen la ruta del
    campo (p. ej. `data.sessions[12].exercises[3].sets[0].rir`).
- **Razón**: ZIP es el contenedor que el usuario puede abrir en cualquier sistema y extraer el JSON
  para leerlo o editarlo (principio II). `CompressionStream` nativo solo produce gzip/deflate, no
  ZIP. La transacción única da atomicidad sin código adicional.
- **Alternativas**: tar/gzip (menos manejable en móvil y Windows); JSON con imágenes en base64
  (descartado en clarificación Q4); zod o ajv para validar (dependencia de runtime evitable; el
  esquema es estable y pequeño).

## R8. Importación de ingredientes desde CSV

- **Decisión**: parser CSV propio con soporte de comillas dobles, detección automática del
  separador (`;` o `,`) por la cabecera, coma decimal aceptada cuando el separador es `;`, UTF-8 con
  o sin BOM. Cabeceras en español fijas ([contracts/ingredients-csv.md](contracts/ingredients-csv.md)).
  Validación de todo el fichero antes de escribir; todo o nada.
- **Razón**: una hoja de cálculo en configuración española exporta con `;` y coma decimal; aceptar
  ambas variantes evita un fallo seguro en el primer uso. El formato es de una sola tabla sin
  multilínea compleja; un parser de ~50 líneas basta.
- **Alternativas**: PapaParse (dependencia de runtime para un formato trivial); imponer solo `,`
  (fallaría con Excel/LibreOffice en español).

## R9. Fechas, semanas y horas

- **Decisión**: fechas civiles locales como cadenas `AAAA-MM-DD`, horas como `HH:MM`, instantes como
  ISO 8601 local sin zona. Aritmética de días con utilidades propias sobre `Date` en hora local a
  mediodía (evita saltos de horario de verano). Semana ISO (lunes a domingo) identificada por la
  fecha de su lunes.
- **Razón**: la app no cambia de zona horaria ni sincroniza; todos los cálculos son por día civil
  (FR-023, FR-040, FR-061). Sin librería de fechas (principio VI).
- **Alternativas**: `Temporal` (soporte irregular en Safari en la fecha de decisión); date-fns o
  Day.js (dependencia evitable).

## R10. Identificadores y unicidad

- **Decisión**: `crypto.randomUUID()` para todas las entidades. Unicidad por nombre normalizado
  (sin espacios extremos, sin distinguir mayúsculas ni tildes) en ingredientes; en ejercicios y
  recetas se permite repetir nombre. Los ejercicios del catálogo base conservan además su `baseId`
  de free-exercise-db, único.
- **Razón**: UUID evita colisiones al importar y al sembrar el catálogo; la unicidad de nombre en
  ingredientes la exige el CSV (FR-032).
- **Alternativas**: autoincrementales de IndexedDB (acoplan el formato de exportación al almacén).

## R11. Precisión numérica y reglas de validación

- **Decisión**:
  - Peso de series: número ≥ 0 con hasta 2 decimales (permite 1,25 kg). Repeticiones: entero ≥ 0.
  - RIR: el dato es un entero de 0 a 10 más una marca `failure` (al fallo, implica RIR 0). El
    control de entrada es un selector de una fila con 7 botones de al menos 44 px: `0 1 2 3 4 5
    Fallo`, que cabe en 360 px de ancho sin desplazamiento y se acierta sin mirar con la barra en las
    manos. Los valores 6–10 solo llegan por precarga o importación; si aparecen se muestran como un
    octavo botón seleccionado. El rango real de uso con rutinas a RIR 1–3 son cuatro botones.
  - Cantidades de alimentos y equivalencias: número > 0 con hasta 1 decimal. Raciones: número > 0
    con hasta 2 decimales.
  - Valores nutricionales por 100: número ≥ 0 con hasta 1 decimal.
  - Peso corporal: número > 0 con 1 decimal. Medidas corporales: número > 0 con 1 decimal (cm).
  - Los cálculos operan con números sin redondear; el redondeo solo se aplica al mostrar (kcal a
    entero, macros y gramos a 1 decimal, volumen a 0,5).
  - Comparaciones con tolerancia `1e-9` en redondeos hacia arriba (formatos de compra).
- **Razón**: cierra el punto "rango de RIR y precisión del peso" que quedó Outstanding en la
  clarificación. En el RIR manda el control de entrada, no el rango del dato: botones grandes para
  los valores que se usan de verdad. El redondeo solo en presentación sigue el principio IV.
- **Alternativas**: selector 0–10 (botones más pequeños o con desplazamiento para valores que no se
  registran); campo numérico con teclado (más toques y requiere mirar); RIR con medios puntos
  (precisión que la percepción de esfuerzo no tiene); "Fallo" como RIR 0 sin marca propia (pierde la
  distinción entre terminar sin margen y no completar la repetición).

## R12. Tests

- **Decisión**: Vitest sobre los módulos puros de `src/domain/`. Obligatorios (principio VII):
  `household.ts` (conversión y redondeo a medida casera), `scaling.ts` (escalado de raciones),
  `shopping.ts` (agregación de la lista de la compra y conservación de marcas) y `volume.ts`
  (volumen semanal). Además, por riesgo de pérdida de datos, se prueban `exportFormat.ts`
  (validación del documento) y `migrations.ts` (cada migración con su documento de ejemplo en
  `tests/fixtures/`, R14). Sin tests de UI.
- **Razón**: los casos de aceptación de la spec dan ejemplos numéricos directamente convertibles en
  tests (SC-006). Vitest comparte la configuración de Vite y no requiere navegador para funciones
  puras.
- **Alternativas**: Jest (configuración adicional para TS/ESM); tests end-to-end con Playwright (no
  exigidos por la constitución).

## R13. Gráficos de evolución

- **Decisión**: gráficos de línea en SVG generados por un componente propio (peso corporal con media
  móvil, peso y repeticiones por ejercicio, medidas corporales). Colores neutros, sin zonas
  "buenas" o "malas".
- **Razón**: solo se necesita un tipo de gráfico con eje temporal; un componente de ~100 líneas
  evita una librería de gráficos (principio VI) y controla la neutralidad visual (principio V).
- **Alternativas**: Chart.js, uPlot (dependencias con capacidades que no se usan).

## R14. Migración de datos entre versiones

- **Decisión**: `meta.schemaVersion` en el almacén y una única cadena de migraciones puras en
  `src/domain/migrations.ts` que transforma el documento de exportación de la versión `n` a `n + 1`.
  La misma cadena se usa al importar (R7) y al arrancar cuando los datos almacenados son de una
  versión anterior al código. En el arranque: construir el documento desde IndexedDB → guardar copia
  previa en `meta.preMigrationBackup` → migrar en memoria → validar → sustituir todo en una
  transacción. Si algo falla, no se escribe nada y se ofrece exportar el documento previo. La
  estructura de IndexedDB (`DB_VERSION`) solo crea almacenes; nunca transforma datos. Existe desde la
  versión 1, aunque la cadena empiece vacía. Detalle en [data-model.md](data-model.md#versionado-y-migraciones-research-r14).
- **Razón**: la app se modificará durante meses con datos reales dentro; sin un mecanismo desde el
  principio, el primer cambio de esquema obliga a elegir entre romperlo o perder el histórico
  (principio II). Reutilizar el formato de exportación como representación intermedia hace que haya
  un solo camino de migración, un solo validador y fixtures que son exportaciones reales (principio
  I).
- **Alternativas**: migrar registro a registro dentro de `onupgradeneeded` (transacción de upgrade
  limitada, sin validación global y difícil de probar sin navegador); migraciones separadas para
  importación y arranque (dos caminos que divergen); no versionar hasta que haga falta (el primer
  cambio llegaría sin datos de la versión anterior identificados).

## R15. Borrador de la serie en curso

- **Decisión**: el borrador de la siguiente serie pendiente de cada ejercicio se guarda en
  `SessionExercise.draft` con cada cambio de campo (evento `input`/selección), escribiendo la sesión
  en IndexedDB en ese mismo evento. Al restaurar, los valores del borrador se marcan "sin confirmar".
  Confirmar mueve el borrador a `sets` en una transacción.
- **Razón**: en iOS y Android el sistema descarta PWA en segundo plano con frecuencia; sin borrador,
  lo tecleado se pierde y además el fallo es invisible porque los campos reaparecen con valores
  precargados verosímiles. Escribir un registro de sesión de pocos KB por cambio es trivial para
  IndexedDB y elimina la única vía de pérdida de datos de la app.
- **Alternativas**: guardar en `visibilitychange`/`pagehide` (no se dispara de forma fiable cuando
  el sistema mata el proceso); `sessionStorage` (se pierde al descartar la PWA); guardar con
  temporizador (ventana de pérdida); no marcar el borrador restaurado (el usuario no distingue lo que
  tecleó de lo precargado).
