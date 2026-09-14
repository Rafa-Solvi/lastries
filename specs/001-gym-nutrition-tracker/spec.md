# Feature Specification: Registro personal de entrenamiento y alimentación

**Feature Branch**: `001-gym-nutrition-tracker`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Aplicación personal única que centraliza entrenamiento de fuerza y alimentación para un solo usuario. ENTRENAMIENTO (rutinas, catálogo de ejercicios con demostración, sesiones con registro de series precargadas desde la última vez, cambios sobre la marcha, historial por ejercicio, volumen semanal por grupo muscular con secundarios a la mitad). ALIMENTACIÓN (catálogo de ingredientes por 100 g con medidas caseras propias, recetas en gramos con pasos y raciones base, vista en gramos o medidas caseras con escalado y redondeo a fracciones legibles, plan de comidas por día y momento, registro de lo comido, totales diarios frente a objetivos mostrados de forma neutra). LISTA DE LA COMPRA (desde un rango del plan, agregada, convertida a unidad de compra, agrupada por sección, marcable y con líneas manuales). PROGRESO (peso corporal con media móvil semanal y medidas corporales). FUERA DE ALCANCE: usuarios múltiples, autenticación, social, despensa, códigos de barras, planificación automática y recomendaciones."

## Clarifications

### Session 2026-09-14

- Q: ¿La app incluye de serie un catálogo de ejercicios con demostraciones o el usuario lo aporta
  todo? → A: Catálogo base incluido y editable, más ejercicios propios. El catálogo base procede de
  free-exercise-db (dominio público) y se empaqueta dentro de la app. Sus demostraciones son
  imágenes estáticas (normalmente inicio y final del movimiento), no animaciones. El campo de
  demostración admite imágenes estáticas y GIF, para que las grabaciones propias entren sin cambiar
  el modelo de datos.
- Q: ¿La app incluye una base de datos de alimentos o el usuario introduce cada ingrediente a mano?
  → A: Alta manual más importación de ingredientes desde un fichero CSV. No se empaqueta ninguna base
  de alimentos.
- Q: ¿Las series de calentamiento cuentan para el volumen? → A: No. Cada serie tiene una marca de
  calentamiento; las series marcadas se excluyen del volumen semanal, de la evolución y de las
  mejores marcas del historial.
- Q: ¿Corregir un ingrediente reescribe los totales de días pasados? → A: No. Cada consumo guarda una
  copia de calorías y macronutrientes congelada al registrarlo. En cambio, corregir los grupos
  musculares de un ejercicio sí recalcula el volumen histórico (es una clasificación, no un hecho).
- Q: ¿A qué se aplica el límite de dos interacciones? → A: A repetir algo que la app ya conoce: una
  serie de un ejercicio de la sesión, un alimento o receta frecuente, un elemento planificado del
  día o una comida registrada el día anterior. Dar de alta ingredientes, recetas o ejercicios nuevos
  queda exento.
- Q: ¿Qué pasa si el redondeo a medida casera se aleja mucho de la cantidad real? → A: Si la
  cantidad redondeada se desvía más de un 10 % de la real, no se usa esa medida.
- Q: ¿Qué se conserva al regenerar la lista de la compra? → A: Las líneas manuales y las marcas de
  comprado.
- Q: ¿Se pueden iniciar sesiones sin rutina? → A: Sí, se puede iniciar una sesión vacía y añadir
  ejercicios sobre la marcha.
- Q: ¿En qué momento del día se guarda un alimento no planificado registrado desde la pantalla
  principal? → A: En el momento cuya franja horaria (editable por el usuario) contiene la hora
  actual.
- Q: ¿Qué se traduce al español del catálogo free-exercise-db? → A: Grupos musculares y
  equipamiento se traducen al empaquetar; los nombres de ejercicio quedan en inglés y son
  renombrables, y la búsqueda encuentra cada ejercicio del catálogo base también por su nombre
  original en inglés.
- Q: ¿Cómo cuenta en el volumen un ejercicio con varios grupos primarios? → A: Se permiten varios
  grupos primarios por ejercicio; cada primario suma 1 por serie y cada secundario 0,5.
- Q: ¿Cómo entran en la exportación las imágenes y GIF de demostración propios? → A: Fichero
  comprimido que contiene el documento JSON de datos y una carpeta con las imágenes propias, con una
  variante adicional de exportación solo de datos que produce el documento JSON sin medios.
  (Alineado con la constitución 2.0.0, principio II.)
- Q: ¿La importación sustituye los datos existentes o los fusiona? → A: Los sustituye por completo
  tras confirmación; nunca fusiona, para no mezclar históricos con identificadores solapados.
- Q: ¿Qué alimentos y recetas aparecen como frecuentes en la pantalla principal? → A: Los 10 con más
  consumos registrados en el momento del día actual durante los últimos 30 días.
- Q: ¿Qué pasa con los valores tecleados en una serie sin confirmar si el sistema descarta la app?
  → A: Se guardan como borrador con cada cambio de campo y se restauran marcados como "sin
  confirmar".
- Q: ¿Qué rango de RIR ofrece el control de entrada? → A: Botones 0 a 5 y "Fallo"; el dato admite
  enteros de 0 a 10.
- Q: ¿Repetir la comida de ayer reutiliza los valores congelados de ayer? → A: No; congela de nuevo
  con los valores vigentes hoy, igual que cualquier registro.
- Q: ¿Se puede deshacer un registro rápido? → A: Sí, con un aviso no modal tras cada registro
  rápido (FR-009).
- Q: ¿Cómo se deja la app preparada sin darlo todo de alta a mano? → A: Con un JSON de configuración
  escrito por el usuario (formato `lastries-configuracion`) que referencia todo por nombre y crea o
  actualiza ejercicios, rutinas, ingredientes, recetas, momentos del día, objetivos y tipos de medida,
  sin borrar registros (FR-063, contracts/setup-import.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una sesión de entrenamiento (Priority: P1)

El usuario crea rutinas reutilizables (p. ej. "Torso A", "Pierna A") con ejercicios ordenados del
catálogo, cada uno con series objetivo, rango de repeticiones y RIR objetivo. En el gimnasio inicia
una sesión desde una rutina, o una sesión vacía si ese día improvisa. Para cada ejercicio ve lo que
hizo la última vez, incluidas las series de calentamiento, y las series pendientes aparecen
precargadas con esos valores (peso, repeticiones, RIR y marca de calentamiento); si coinciden, las
confirma con un solo toque, y si no, ajusta lo necesario antes de confirmar. Durante la sesión puede
añadir, quitar o reordenar ejercicios sin que la rutina guardada cambie.

**Why this priority**: es el uso más frecuente y el más sensible a la fricción (se registra entre
series). Sin él la parte de entrenamiento no aporta nada.

**Independent Test**: con el catálogo base, crear una rutina, iniciar una sesión, registrar series
de calentamiento y efectivas, cerrarla, iniciar otra sesión de la misma rutina y comprobar que se
muestran y precargan los valores anteriores y que la rutina original no cambia al modificar la
sesión.

**Acceptance Scenarios**:

1. **Given** una rutina "Torso A" con "Press banca: 3 series, 6–8 reps, RIR 2", **When** el usuario
   inicia una sesión desde ella, **Then** la sesión lista los ejercicios de la rutina en su orden con
   sus objetivos visibles.
2. **Given** que la última vez hizo press banca con barra sola × 10, 40 kg × 8 y 60 kg × 5 como
   calentamiento y 80 kg × 8 RIR 2 como primera serie efectiva, **When** llega a press banca en una
   nueva sesión, **Then** ve esas series con las de calentamiento diferenciadas, y las series
   pendientes aparecen precargadas en el mismo orden, con la marca de calentamiento en las tres
   primeras.
3. **Given** una sesión en curso visible en la pantalla principal, **When** el usuario confirma la
   serie precargada, **Then** la serie queda registrada con un único toque y se pasa a la siguiente.
4. **Given** una serie precargada con 80 kg, **When** el usuario cambia el peso a 82,5 kg y
   confirma, **Then** se registra 82,5 kg y la siguiente serie conserva su propio valor precargado.
5. **Given** una sesión iniciada desde "Torso A", **When** el usuario añade un ejercicio, quita otro
   y reordena el resto, **Then** la sesión refleja los cambios y la rutina "Torso A" permanece
   idéntica.
6. **Given** un ejercicio que el usuario nunca ha entrenado dentro de una rutina, **When** llega a
   él, **Then** se indica que no hay registro previo y se precargan tantas series efectivas como
   series objetivo, con las repeticiones mínimas del rango, el RIR objetivo y el peso vacío.
7. **Given** la pantalla principal sin sesión en curso, **When** el usuario inicia una sesión vacía
   y añade "Dominadas", **Then** puede registrar series de dominadas precargadas con su última vez.
8. **Given** una serie registrada, **When** el usuario activa o desactiva su marca de calentamiento,
   **Then** el cambio se guarda y afecta al volumen y al historial.
9. **Given** un ejercicio del catálogo, **When** el usuario lo consulta, **Then** ve su nombre, grupo
   musculares primarios, grupos secundarios, equipamiento y su demostración (imágenes o GIF) si la
   tiene.
10. **Given** "Barbell Bench Press" del catálogo base renombrado por el usuario a "Press banca",
    **When** busca "bench press" o "press banca", **Then** ambas búsquedas lo encuentran y se muestra
    como "Press banca".
11. **Given** una serie precargada con 80 kg × 8 en la que el usuario ha cambiado el peso a 82,5 kg
    sin confirmar, **When** cambia de app y el sistema descarta la app de memoria, **Then** al volver
    la serie muestra 82,5 kg × 8 marcada como "sin confirmar", y confirmarla la registra con esos
    valores.
12. **Given** una serie pendiente, **When** el usuario elige el RIR, **Then** lo hace con un único
    toque en un selector con los botones 0 a 5 y "Fallo", visibles a la vez sin desplazamiento.
13. **Given** una serie recién confirmada por error, **When** el usuario toca "Deshacer" en el aviso
    que aparece tras confirmarla, **Then** la serie desaparece y vuelve a quedar pendiente con los
    valores que tenía.

---

### User Story 2 - Registrar lo que come y ver el total del día frente a sus objetivos (Priority: P2)

El usuario mantiene un catálogo de ingredientes con valores nutricionales por 100 g, que puede dar de
alta a mano o importar desde un fichero CSV, y registra lo que come en cada momento del día. La app
suma calorías y macronutrientes del día y los muestra junto a los objetivos diarios que el usuario
ha configurado, con la diferencia expresada de forma neutra. Lo registrado conserva los valores
nutricionales del momento en que se apuntó.

**Why this priority**: es el segundo registro diario y el que da sentido a la parte de
alimentación; funciona sin recetas, plan ni lista de la compra.

**Independent Test**: importar ingredientes desde un CSV, configurar objetivos, registrar consumos
en distintos momentos del día y comprobar totales, diferencias neutras y que corregir un ingrediente
no altera días pasados.

**Acceptance Scenarios**:

1. **Given** el ingrediente "Arroz blanco" con 350 kcal/100 g, **When** el usuario registra 80 g en
   la comida, **Then** el total del día suma 280 kcal y sus macronutrientes proporcionales.
2. **Given** un objetivo diario de 2.500 kcal y 1.900 kcal registradas, **When** el usuario mira el
   resumen del día, **Then** ve "1.900 / 2.500 kcal" y una diferencia de "−600 kcal", sin colores ni
   textos que valoren el resultado.
3. **Given** 200 g de yogur natural registrados 12 veces en el desayuno en los últimos 30 días y 3
   veces en la merienda, **When** el usuario abre la pantalla principal a las 8:30, **Then** el yogur
   aparece entre los frecuentes del desayuno y se registra con 200 g en dos interacciones o menos;
   a las 17:30 aparece entre los de la merienda solo si está entre los 10 con más consumos de ese
   momento.
4. **Given** el desayuno de ayer registrado, **When** el usuario elige repetirlo hoy desde la
   pantalla principal, **Then** todos sus elementos quedan registrados en el desayuno de hoy en dos
   interacciones o menos.
5. **Given** 150 g de pechuga de pollo registrados en enero con 110 kcal/100 g, **When** en marzo el
   usuario corrige el pollo a 120 kcal/100 g, **Then** el total de aquel día de enero sigue contando
   165 kcal por el pollo y los registros posteriores a la corrección usan 120 kcal/100 g.
6. **Given** los momentos "comida" desde las 13:00 y "merienda" desde las 17:00, **When** a las
   16:40 el usuario registra un frecuente desde la pantalla principal, **Then** se guarda en la
   comida de hoy sin preguntar el momento, y puede moverlo después a la merienda.
7. **Given** un consumo registrado, **When** el usuario cambia su cantidad, **Then** sus valores se
   reescalan a partir de los valores congelados de ese consumo, no de los actuales del ingrediente.
8. **Given** que el usuario cambia su objetivo de calorías a partir de hoy, **When** consulta un día
   anterior, **Then** ese día se contrasta con el objetivo vigente en esa fecha.
9. **Given** un CSV con 80 filas válidas de ingredientes, **When** el usuario lo importa, **Then** se
   crean los 80 ingredientes con sus valores.
10. **Given** un CSV con alguna fila inválida, **When** el usuario lo importa, **Then** no se importa
   ninguna fila y se indica qué filas fallan y por qué.

---

### User Story 3 - Exportar e importar todos los datos (Priority: P3)

El usuario puede exportar en cualquier momento todos sus datos, con o sin sus archivos de
demostración, y restaurarlos desde ese fichero, por ejemplo al cambiar de dispositivo o como copia de
seguridad. Restaurar sustituye todo lo que hay en la app.

**Why this priority**: garantiza la propiedad de los datos exigida por la constitución y protege el
historial acumulado en las historias anteriores.

**Independent Test**: generar datos en todas las áreas, exportar, borrar los datos de la app,
importar el fichero y comprobar que todo el contenido es idéntico.

**Acceptance Scenarios**:

1. **Given** datos de entrenamiento, alimentación, lista de la compra, progreso y objetivos,
   **When** el usuario elige la exportación completa, **Then** obtiene un único fichero comprimido
   con un documento JSON que contiene la totalidad de esos datos y una carpeta con las
   demostraciones que haya añadido él, sin las imágenes del catálogo base; **When** elige la
   exportación solo de datos, **Then** obtiene ese mismo documento JSON sin archivos de medios.
2. **Given** un fichero exportado, **When** el usuario lo importa en una app sin datos, **Then** el
   estado resultante es idéntico al del momento de la exportación.
3. **Given** una app con datos existentes, **When** el usuario importa un fichero, **Then** se le
   avisa de que todos los datos actuales se sustituirán y, solo tras confirmarlo, se sustituyen por
   completo: no queda ningún dato previo mezclado con los importados.
4. **Given** un fichero cuyo documento JSON no se puede leer o no supera la validación, **When** el
   usuario intenta importarlo, **Then** la importación se aborta con un mensaje explícito y los
   datos existentes no se modifican.
5. **Dado** un fichero de exportación solo de datos, o un fichero comprimido al que le falta algún
   archivo de demostración, **cuando** el usuario lo importa, **entonces** se restauran todos los
   datos y los ejercicios sin archivo disponible se muestran sin demostración, sin bloquear la
   importación ni mostrar un error.

---

### User Story 4 - Recetas con medidas caseras y escalado de raciones (Priority: P4)

El usuario define para cada ingrediente, si quiere, sus propias medidas caseras (vaso, cucharada,
cucharadita, puñado, unidad) con su equivalencia en gramos. Crea recetas con ingredientes en gramos,
pasos de preparación y un número de raciones base. Al ver una receta elige entre gramos y medidas
caseras y puede cambiar el número de raciones viendo cómo se recalculan ambas representaciones. Una
medida casera solo se muestra si representa fielmente la cantidad real.

**Why this priority**: facilita cocinar y planificar, pero el registro diario (P2) funciona sin
recetas.

**Independent Test**: definir ingredientes con y sin medidas caseras, crear una receta de 2
raciones, visualizarla en ambas vistas y escalar a 3 raciones comprobando cantidades, redondeos y
el límite de desviación.

**Acceptance Scenarios**:

1. **Given** el aceite de oliva con "cucharada = 13,5 g" y una receta de 2 raciones con 27 g de
   aceite, **When** el usuario la ve en medidas caseras, **Then** aparece "2 cucharadas".
2. **Given** esa receta, **When** el usuario la escala a 3 raciones, **Then** la vista en gramos
   muestra 40,5 g y la vista en medidas caseras "3 cucharadas".
3. **Given** la harina con "vaso = 150 g" y 100 g en la receta (0,67 vasos), **When** se muestra en
   medidas caseras, **Then** aparece "2/3 de vaso", y los gramos usados en cálculos no se alteran.
4. **Given** la harina con "vaso = 150 g" y "cucharada = 10 g" y 45 g en la receta, **When** se
   muestra en medidas caseras, **Then** se descarta "1/3 de vaso" (desviación del 11 %) y aparece
   "4 y 1/2 cucharadas".
5. **Given** la sal con "cucharadita = 6 g" como única medida y 1,8 g en la receta (0,3
   cucharaditas), **When** se muestra en medidas caseras, **Then** aparece "1,8 g", porque "1/3 de
   cucharadita" se desvía un 11 %.
6. **Given** un ingrediente sin medidas caseras definidas, **When** la receta se ve en medidas
   caseras, **Then** ese ingrediente se muestra en gramos.
7. **Given** una receta, **When** el usuario la consulta, **Then** ve las calorías y macronutrientes
   por ración y totales, calculados con los valores actuales de sus ingredientes.

---

### User Story 5 - Historial por ejercicio y volumen semanal por grupo muscular (Priority: P5)

El usuario consulta la evolución de peso y repeticiones de cada ejercicio a lo largo del tiempo y
las series efectivas completadas por grupo muscular en cada semana, donde cada serie cuenta entera
para cada grupo primario y la mitad para cada grupo secundario. Las series de calentamiento no
cuentan.

**Why this priority**: da valor a los datos acumulados en P1, pero no es necesario para registrar.

**Independent Test**: registrar varias sesiones en semanas distintas con ejercicios que compartan
grupos musculares y con series de calentamiento, y comparar historial y volumen con un cálculo
manual.

**Acceptance Scenarios**:

1. **Given** varias sesiones con press banca, **When** el usuario abre su historial, **Then** ve por
   fecha las series realizadas, con las de calentamiento diferenciadas, y la evolución del peso y
   las repeticiones calculada solo con series efectivas.
2. **Given** una semana con 3 series efectivas y 3 de calentamiento de press banca (primario: pecho;
   secundarios: tríceps, hombro anterior) y 4 series efectivas de fondos (primario: tríceps;
   secundario: pecho), **When** el usuario consulta el volumen de esa semana, **Then** ve pecho 5,
   tríceps 5,5 y hombro anterior 1,5.
3. **Given** sesiones en dos semanas distintas, **When** consulta el volumen, **Then** cada serie se
   cuenta solo en la semana en que se realizó.
4. **Given** que el usuario corrige los grupos secundarios de un ejercicio, **When** consulta el
   volumen de semanas pasadas, **Then** se recalcula con la clasificación corregida.
5. **Given** una semana con 4 series efectivas de peso muerto rumano (primarios: isquiotibiales y
   glúteos; secundario: zona lumbar), **When** consulta el volumen, **Then** ve isquiotibiales 4,
   glúteos 4 y zona lumbar 2.

---

### User Story 6 - Planificar comidas y generar la lista de la compra (Priority: P6)

El usuario asigna recetas (con número de raciones) o ingredientes sueltos (con cantidad) a días y
momentos del día. Registra como comido lo planificado con un toque, ajustándolo si difiere. A partir
de un rango de fechas genera una lista de la compra que suma cada ingrediente, lo expresa en el
formato en que se vende y lo agrupa por sección del supermercado; puede marcar elementos como
comprados, añadir líneas manuales y regenerar la lista sin perder lo que ya ha marcado.

**Why this priority**: ahorra tiempo semanal, pero depende de ingredientes y recetas ya existentes.

**Independent Test**: planificar varios días con recetas e ingredientes repetidos, generar la lista
para ese rango, marcar líneas, cambiar el plan y regenerar, comparando con un cálculo manual.

**Acceptance Scenarios**:

1. **Given** el martes planificado "Lentejas, 2 raciones" en la comida, **When** el usuario lo marca
   como comido, **Then** se registra el consumo de esas 2 raciones sin más pasos.
2. **Given** tomate en dos recetas planificadas (150 g y 250 g) y 100 g como ingrediente suelto en
   el rango, **When** se genera la lista, **Then** aparece una única línea de tomate con 500 g.
3. **Given** la pechuga de pollo con formato de compra "bandeja de 500 g" y 650 g necesarios,
   **When** se genera la lista, **Then** la línea indica "2 bandejas" junto con la cantidad necesaria
   (650 g).
4. **Given** ingredientes con sección "Frutería" y "Lácteos", **When** se muestra la lista, **Then**
   las líneas aparecen agrupadas por sección; los ingredientes sin sección aparecen en "Sin sección".
5. **Given** una lista generada, **When** el usuario marca una línea como comprada y añade la línea
   manual "Papel de cocina", **Then** ambos cambios se conservan al volver a abrir la lista.
6. **Given** una lista con el tomate marcado como comprado y una línea manual, **When** el usuario
   añade una receta sin tomate al plan y regenera la lista, **Then** el tomate sigue marcado, la
   línea manual se conserva y aparecen las líneas nuevas sin marcar.
7. **Given** el pollo marcado como comprado con "1 bandeja", **When** tras cambiar el plan la
   regeneración pide "2 bandejas", **Then** la línea de pollo aparece sin marcar.

---

### User Story 7 - Registrar peso y medidas corporales (Priority: P7)

El usuario registra con fecha su peso corporal y medidas corporales (p. ej. cintura, cadera, brazo).
El peso se muestra con el valor diario y la media móvil semanal.

**Why this priority**: es un registro de baja frecuencia e independiente del resto.

**Independent Test**: registrar pesos en días no consecutivos y comprobar la media móvil frente a un
cálculo manual; registrar medidas y ver su evolución.

**Acceptance Scenarios**:

1. **Given** pesos de 80,0 kg (lunes), 80,6 kg (miércoles) y 79,8 kg (domingo), **When** el usuario
   ve el domingo, **Then** ve el dato diario 79,8 kg y una media móvil semanal de 80,1 kg.
2. **Given** un día sin pesaje, **When** se muestra la evolución, **Then** ese día no tiene dato
   diario y la media se calcula solo con los pesajes disponibles en los 7 días.
3. **Given** medidas de cintura registradas en varias fechas, **When** el usuario consulta la
   cintura, **Then** ve su evolución por fecha.

---

### Edge Cases

- **Sesión interrumpida**: si la app se cierra o el sistema la descarta con una sesión en curso, al
  volver la sesión sigue abierta con todas las series confirmadas y con los valores tecleados en la
  serie sin confirmar, marcados como "sin confirmar".
- **Deshacer tras empezar la siguiente serie**: si el usuario confirma una serie y empieza a teclear
  la siguiente del mismo ejercicio, el aviso de deshacer desaparece; la serie confirmada se corrige
  editándola.
- **Más series que la última vez**: si ahora hay más series efectivas que la última vez, las
  adicionales se precargan con la última serie efectiva de aquella ocasión.
- **Ejercicio añadido sobre la marcha o en sesión vacía**: muestra y precarga la última vez que se
  entrenó, aunque fuera en otra rutina; si nunca se entrenó y no tiene objetivos, se ofrece una
  serie con todos los valores vacíos.
- **Ejercicios con peso corporal**: el peso puede ser 0 (o el lastre añadido) y la serie es válida.
- **Rutina editada o eliminada**: las sesiones pasadas conservan los ejercicios y series que
  realmente se hicieron.
- **Grupo repetido como primario y secundario**: un mismo grupo muscular no puede estar a la vez
  entre los primarios y los secundarios de un ejercicio; si llega así del catálogo base, cuenta solo
  como primario.
- **Semana solo con calentamiento**: si un grupo muscular solo tiene series de calentamiento en una
  semana, su volumen es 0.
- **Ejercicio del catálogo base editado**: los cambios del usuario sobre un ejercicio del catálogo
  base se conservan; el catálogo base no sobrescribe ejercicios ya existentes.
- **Ejercicio sin demostración**: es válido y se muestra sin imagen.
- **Consumo con ingrediente o receta sustituidos**: si el usuario cambia el ingrediente o la receta
  de un consumo ya registrado, los valores congelados se toman de nuevo del elemento elegido.
- **Receta modificada después de registrar un consumo**: el consumo conserva sus valores congelados.
- **Medida casera sin representación fiel**: si ninguna medida del ingrediente queda dentro del
  10 % de desviación, se muestra en gramos.
- **Cantidades casi enteras**: 1,96 cucharadas se muestra como "2 cucharadas", nunca "1 y 1/1".
- **Ingrediente sin formato de compra**: la lista de la compra lo muestra en gramos o mililitros.
- **Ingrediente en uso**: un ingrediente o ejercicio referenciado en recetas, planes o registros no
  se elimina; se ofrece archivarlo para que deje de aparecer al elegir pero mantenga el historial.
- **Receta sin ingredientes o sin raciones**: no se puede guardar una receta sin ingredientes ni con
  raciones base menores o iguales a 0.
- **CSV con nombres ya existentes**: las filas cuyo nombre coincide con un ingrediente existente se
  señalan como error y, como cualquier fila inválida, impiden la importación del fichero.
- **Sin historial de consumos**: con la app recién estrenada no hay frecuentes; la pantalla principal
  muestra solo lo planificado y el acceso a buscar o crear.
- **Registro de madrugada**: un consumo registrado a las 00:30, antes del inicio del primer momento,
  se guarda en el último momento del día (p. ej. cena) de la fecha actual.
- **Día sin objetivos configurados**: se muestran los totales sin objetivo ni diferencia.
- **Valores inválidos**: pesos, cantidades o repeticiones negativos y RIR fuera de rango se rechazan
  al introducirlos.
- **Semana parcial**: las semanas van de lunes a domingo; la semana en curso muestra lo registrado
  hasta el momento.

## Requirements *(mandatory)*

### Functional Requirements

**Generales**

- **FR-001**: La app MUST funcionar para un único usuario sin cuentas, inicio de sesión ni
  autenticación.
- **FR-002**: Todos los datos y recursos, incluido el catálogo base de ejercicios con sus imágenes,
  MUST estar almacenados en el dispositivo, y todas las funciones MUST estar disponibles sin conexión
  de red.
- **FR-003**: La aplicación ofrece dos variantes de exportación: completa, que produce un fichero
  comprimido con el documento JSON de datos y una carpeta con los archivos de demostración propios
  del usuario; y solo datos, que produce el mismo documento JSON sin archivos de medios. Los archivos
  de demostración del catálogo base no se incluyen en ninguna de las dos, porque vienen con la
  aplicación.
- **FR-004**: La importación acepta tanto un fichero comprimido como un documento JSON suelto. Si el
  documento JSON no se puede leer o no supera la validación, la importación se aborta sin modificar
  ningún dato existente. Los archivos de demostración ausentes no se consideran un error: los datos
  se restauran íntegramente y los ejercicios afectados quedan sin demostración, pudiendo el usuario
  añadirla después. Una importación válida sustituye por completo todos los datos existentes, previa
  confirmación del usuario; nunca los fusiona con los datos importados.
- **FR-005**: La app MUST NOT mostrar rachas, logros, puntuaciones, avisos de incumplimiento ni
  mensajes o colores que valoren lo comido, lo entrenado o el progreso corporal.
- **FR-006**: La app MUST NOT proponer objetivos, rutinas, dietas ni cantidades; todos los objetivos
  son introducidos y editados por el usuario.
- **FR-007**: Los registros pasados (series, consumos, pesajes y medidas) MUST poder editarse y
  eliminarse.
- **FR-008**: El límite de dos interacciones (un toque o una confirmación cada una) desde la
  pantalla principal MUST cumplirse al repetir algo que la app ya conoce: registrar una serie de un
  ejercicio de la sesión en curso con sus valores precargados, registrar un alimento o receta
  frecuente, marcar como comido un elemento planificado del día o repetir una comida registrada el
  día anterior. Dar de alta ingredientes, recetas o ejercicios nuevos, y ajustar valores precargados,
  quedan fuera de ese límite.
- **FR-009**: Tras cada registro rápido (serie confirmada, consumo de un frecuente, elemento
  planificado marcado como comido o comida repetida), la app MUST ofrecer una acción de deshacer no
  modal, visible durante al menos 8 segundos o hasta el siguiente registro, que elimina por completo
  ese registro. Deshacer MUST NOT añadir interacciones al flujo de registro. El deshacer de una
  serie confirmada caduca además en cuanto el usuario modifica algún valor de la siguiente serie de
  ese ejercicio, de modo que deshacer nunca sustituye valores ya tecleados.

**Entrenamiento**

- **FR-010**: La app MUST incluir de serie un catálogo base de ejercicios procedente de
  free-exercise-db, empaquetado en la app, con nombre, grupos musculares primarios, grupos secundarios,
  equipamiento e imágenes de demostración. Los grupos musculares y el equipamiento MUST mostrarse en
  español; los nombres de ejercicio MUST conservar su nombre original en inglés.
- **FR-011**: El usuario MUST poder crear ejercicios propios y editar o archivar cualquier ejercicio,
  incluidos los del catálogo base, con nombre, grupos musculares primarios (uno o más), grupos secundarios
  (cero o más), equipamiento y demostración opcional.
- **FR-012**: La demostración de un ejercicio MUST admitir una o varias imágenes estáticas o GIF, sin
  distinción entre las del catálogo base y las aportadas por el usuario.
- **FR-013**: Los grupos musculares MUST elegirse de una lista que el usuario puede ampliar y editar,
  inicializada con los grupos del catálogo base traducidos al español.
- **FR-014**: El usuario MUST poder crear, editar y eliminar rutinas con nombre y una lista ordenada
  de ejercicios, cada uno con series objetivo, rango de repeticiones (mínimo y máximo) y RIR
  objetivo.
- **FR-015**: El usuario MUST poder iniciar una sesión a partir de una rutina, que copia sus
  ejercicios y objetivos en ese momento, o una sesión vacía sin rutina.
- **FR-016**: Cada serie registrada MUST guardar peso (kg), repeticiones, RIR (entero de 0 a 10), una
  marca de serie al fallo y una marca de calentamiento (sí/no), asociada a un ejercicio y a la fecha
  de la sesión. Una serie al fallo tiene RIR 0.
- **FR-017**: Junto a cada ejercicio de la sesión MUST mostrarse las series de la última sesión en
  que se entrenó ese ejercicio, con independencia de la rutina, diferenciando las de calentamiento.
- **FR-018**: Las series pendientes de un ejercicio MUST precargarse con las de la última vez en el
  mismo orden, incluidos los valores y la marca de calentamiento; si ahora hay más series efectivas
  (según las series objetivo), las adicionales repiten la última serie efectiva de aquella ocasión.
  Sin historial, MUST precargarse tantas series efectivas como series objetivo, con las repeticiones
  mínimas del rango, el RIR objetivo y el peso vacío.
- **FR-019**: Una serie precargada MUST poder confirmarse con una única interacción, y la marca de
  calentamiento de cualquier serie MUST poder cambiarse. El RIR MUST introducirse con un selector de
  botones de acceso directo 0, 1, 2, 3, 4, 5 y "Fallo", sin desplazamiento; un valor mayor que 5
  (precargado o importado) MUST mostrarse como botón adicional seleccionado.
- **FR-020**: Durante una sesión el usuario MUST poder añadir, quitar y reordenar ejercicios sin que
  la rutina de origen se modifique.
- **FR-021**: Una sesión en curso MUST conservarse si la app se cierra o el sistema la descarta de
  memoria, y MUST poder finalizarse explícitamente. Los valores introducidos en una serie aún no
  confirmada (borrador) MUST guardarse con cada cambio de campo y restaurarse al volver, marcados
  visiblemente como "sin confirmar" para distinguirlos de los valores precargados.
- **FR-022**: Para cada ejercicio MUST mostrarse un historial por fecha de todas las series
  realizadas y la evolución en el tiempo del peso y las repeticiones calculada solo con series
  efectivas; cualquier mejor marca que se muestre MUST excluir las series de calentamiento.
- **FR-023**: La app MUST calcular, por semana (lunes a domingo) y grupo muscular, las series
  efectivas completadas, sumando 1 por serie a cada grupo primario y 0,5 por serie a cada grupo
  secundario; las series de calentamiento MUST NOT contar.
- **FR-024**: El volumen semanal MUST calcularse con los grupos musculares actuales de cada
  ejercicio, de modo que corregir su clasificación recalcula también las semanas pasadas.
- **FR-025**: La búsqueda de ejercicios MUST encontrar cada ejercicio por su nombre actual y, en los
  del catálogo base, también por su nombre original en inglés aunque el usuario lo haya renombrado.

**Alimentación**

- **FR-030**: El usuario MUST poder crear, editar, archivar y consultar ingredientes con nombre,
  unidad base (g o ml), calorías, proteínas, hidratos de carbono y grasas por cada 100 unidades base,
  sección del supermercado opcional y formato de compra opcional.
- **FR-031**: El formato de compra de un ingrediente MUST tener un nombre y su equivalencia en la
  unidad base (p. ej. "bandeja" = 500 g, "bote" = 400 g, "docena" = 720 g, "brik" = 1.000 ml).
- **FR-032**: El usuario MUST poder importar ingredientes desde un fichero CSV con una fila por
  ingrediente y columnas para nombre, unidad base, calorías, proteínas, hidratos, grasas, sección
  (opcional), nombre del formato de compra (opcional) y su equivalencia (opcional). La app MUST
  validar todo el fichero antes de importar: si alguna fila es inválida o repite el nombre de un
  ingrediente existente, MUST NOT importar ninguna fila y MUST indicar cada fila con error y el
  motivo.
- **FR-033**: Cada ingrediente MUST poder tener cero o más medidas caseras propias (p. ej. vaso,
  cucharada, cucharadita, puñado, unidad) con su equivalencia en la unidad base; no existe ninguna
  equivalencia compartida entre ingredientes.
- **FR-034**: Todas las cantidades MUST almacenarse y calcularse en gramos o mililitros; las medidas
  caseras MUST usarse solo para mostrar e introducir cantidades.
- **FR-035**: El usuario MUST poder crear, editar y eliminar recetas con nombre, lista de
  ingredientes con cantidad, pasos de preparación ordenados y número de raciones base (mayor que 0).
- **FR-036**: Al ver una receta el usuario MUST poder alternar entre la vista en gramos y la vista en
  medidas caseras, y cambiar el número de raciones, recalculando todas las cantidades por el factor
  raciones elegidas / raciones base en ambas vistas.
- **FR-037**: En la vista en medidas caseras, para cada cantidad la app MUST recorrer las medidas del
  ingrediente de mayor a menor equivalencia y, para cada una, redondear la cantidad al valor más
  cercano de la forma "entero + fracción" con fracción en {0, 1/4, 1/3, 1/2, 2/3, 3/4} y valor
  mayor que 0; MUST mostrar la primera medida cuyo valor redondeado se desvíe como máximo un 10 % de
  la cantidad real. Si ninguna lo cumple, o el ingrediente no tiene medidas, MUST mostrarse en gramos
  o mililitros.
- **FR-038**: La app MUST mostrar calorías y macronutrientes totales y por ración de cada receta,
  calculados con los valores actuales de sus ingredientes.
- **FR-039**: El usuario MUST poder planificar recetas (con número de raciones) e ingredientes
  sueltos (con cantidad) en días concretos y momentos del día.
- **FR-040**: Los momentos del día MUST ser una lista ordenada editable por el usuario (por defecto:
  desayuno, comida, merienda, cena), cada uno con una hora de inicio editable; la franja de un
  momento va desde su hora de inicio hasta la hora de inicio del siguiente, y la del último hasta
  el final del día. Las horas anteriores al inicio del primer momento pertenecen al último momento
  del día.
- **FR-041**: El usuario MUST poder registrar lo que come: marcar un elemento planificado como
  comido (ajustando cantidad o raciones si difiere), registrar una receta o ingrediente no
  planificado, o repetir todos los consumos de un momento del día anterior. Un consumo no
  planificado registrado desde la pantalla principal MUST asignarse sin preguntar a la fecha actual
  y al momento del día cuya franja contiene la hora actual; el momento MUST poder cambiarse después
  editando el consumo. Repetir una comida del día anterior MUST crear consumos nuevos idénticos a un
  registro normal: con fecha de hoy y con su copia de valores nutricionales congelada en el momento
  de repetirla con los valores vigentes hoy (FR-042), sin reutilizar las copias congeladas de ayer.
- **FR-042**: Cada consumo MUST guardar, en el momento de registrarlo, una copia de sus calorías y
  macronutrientes calculados con los valores vigentes del ingrediente o receta. Los cambios
  posteriores en ingredientes o recetas MUST NOT alterar consumos ya registrados; cambiar la cantidad
  de un consumo MUST reescalar sus valores congelados.
- **FR-043**: La app MUST sumar los valores congelados de los consumos de cada día y mostrarlos junto
  a los objetivos diarios vigentes en esa fecha y la diferencia numérica (valor − objetivo), sin
  valoración.
- **FR-044**: El usuario MUST poder configurar y cambiar sus objetivos diarios de calorías y
  macronutrientes; cada cambio MUST aplicarse desde la fecha indicada sin alterar los objetivos de
  días anteriores.
- **FR-045**: La pantalla principal MUST mostrar como frecuentes los 10 ingredientes o recetas con
  más consumos registrados en el momento del día actual durante los últimos 30 días, con los
  empates resueltos por el consumo más reciente. Cada frecuente MUST registrarse con la cantidad o
  raciones de su último consumo. Si hay menos de 10 con consumos en ese periodo, MUST mostrarse los
  que haya; los ingredientes y recetas archivados MUST NOT aparecer.

**Lista de la compra**

- **FR-050**: El usuario MUST poder generar una lista de la compra para un rango de fechas del plan
  de comidas.
- **FR-051**: La generación MUST sumar la cantidad de cada ingrediente de todas las recetas
  (escaladas a las raciones planificadas) e ingredientes sueltos del rango, en una única línea por
  ingrediente.
- **FR-052**: Cada línea MUST expresarse en el formato de compra del ingrediente, redondeando hacia
  arriba al número entero de formatos, y mostrar también la cantidad necesaria en gramos o
  mililitros; sin formato de compra, solo en gramos o mililitros.
- **FR-053**: Las líneas MUST agruparse por sección del supermercado; las de ingredientes sin
  sección MUST agruparse en "Sin sección".
- **FR-054**: El usuario MUST poder marcar y desmarcar líneas como compradas y añadir, editar y
  eliminar líneas manuales de texto libre con cantidad opcional.
- **FR-055**: Al regenerar la lista, la app MUST recalcular las líneas generadas, conservar las
  líneas manuales con su marca y conservar la marca de comprado de cada ingrediente que siga en la
  lista, salvo que el número de formatos de compra necesario haya aumentado, en cuyo caso la línea
  MUST quedar sin marcar. Las líneas de ingredientes que ya no estén en el rango MUST desaparecer.

**Progreso**

- **FR-060**: El usuario MUST poder registrar su peso corporal con fecha (un valor por día).
- **FR-061**: Para cada día con datos, la app MUST mostrar el peso diario y la media móvil semanal,
  definida como la media de los pesajes existentes en los 7 días que terminan en ese día.
- **FR-062**: El usuario MUST poder registrar medidas corporales con fecha, de una lista de tipos de
  medida editable por el usuario, y consultar la evolución de cada tipo.

**Configuración inicial**

- **FR-063**: El usuario MUST poder importar un fichero JSON de configuración escrito a mano, con el
  formato de contracts/setup-import.md, que crea o actualiza por nombre (sin distinguir mayúsculas ni
  tildes) grupos musculares, ejercicios (incluido renombrar ejercicios del catálogo base), rutinas,
  ingredientes con medidas caseras y formato de compra, recetas, momentos del día, objetivos y tipos de
  medida. La importación MUST validar todo el fichero y, si hay errores, MUST NOT aplicar nada y MUST
  listar cada error con su ruta; si es válido, MUST mostrar un resumen de nuevos y actualizados antes de
  aplicar en una única transacción. MUST NOT borrar sesiones, consumos, pesajes ni medidas, y reimportar
  el mismo fichero MUST NOT crear duplicados. La app MUST ofrecer la descarga de una plantilla de
  ejemplo.

### Key Entities *(include if feature involves data)*

- **Grupo muscular**: nombre; lista editable por el usuario.
- **Ejercicio**: nombre, nombre original en inglés (solo catálogo base), grupos musculares primarios (uno o más),
  grupos secundarios, equipamiento, demostración (cero o más imágenes estáticas o GIF), origen
  (catálogo base o propio), estado archivado.
- **Rutina**: nombre y lista ordenada de ejercicios de rutina.
- **Ejercicio de rutina**: ejercicio, posición, series objetivo, repeticiones mínima y máxima, RIR
  objetivo.
- **Sesión**: fecha y hora de inicio y fin, rutina de origen opcional, lista ordenada de ejercicios
  realizados con sus objetivos copiados (si los hay) y, por ejercicio, el borrador de la siguiente
  serie sin confirmar.
- **Serie**: pertenece a un ejercicio dentro de una sesión; peso (kg), repeticiones, RIR, marca al
  fallo (implica RIR 0), marca de calentamiento, orden.
- **Ingrediente**: nombre, unidad base (g o ml), calorías y macronutrientes por 100 unidades base,
  sección del supermercado, formato de compra (nombre y equivalencia), estado archivado.
- **Medida casera**: pertenece a un ingrediente; nombre y equivalencia en la unidad base.
- **Receta**: nombre, raciones base, pasos ordenados y líneas de ingrediente (ingrediente y cantidad
  en unidad base).
- **Momento del día**: nombre, orden y hora de inicio de su franja; lista editable.
- **Elemento planificado**: fecha, momento del día y receta con raciones o ingrediente con cantidad.
- **Consumo**: fecha, momento del día, receta con raciones o ingrediente con cantidad, y copia
  congelada de calorías, proteínas, hidratos y grasas; opcionalmente vinculado al elemento
  planificado del que procede.
- **Objetivos diarios**: calorías, proteínas, hidratos y grasas, con fecha de inicio de vigencia.
- **Lista de la compra**: rango de fechas y líneas.
- **Línea de la compra**: ingrediente con cantidad calculada y número de formatos (generada) o texto
  libre con cantidad opcional (manual); estado comprado.
- **Pesaje**: fecha y peso en kg.
- **Tipo de medida corporal** y **Medida corporal**: tipo, fecha y valor en cm.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con una sesión en curso, el 100 % de las series del ejercicio en curso cuyos valores
  coinciden con los precargados se registran con una sola interacción desde la pantalla principal, y
  las de cualquier otro ejercicio de la sesión con dos o menos.
- **SC-002**: Registrar una serie precargada lleva menos de 3 segundos desde que el usuario mira la
  pantalla.
- **SC-003**: El 100 % de los elementos planificados del día, de los alimentos y recetas frecuentes
  y de las comidas del día anterior se registran como comidos con dos interacciones o menos desde la
  pantalla principal.
- **SC-004**: Una exportación seguida de importación en una app vacía reproduce el 100 % de los
  datos sin diferencias.
- **SC-005**: Todas las funciones se completan con el dispositivo sin conexión de red.
- **SC-006**: Los totales nutricionales diarios, las cantidades escaladas y su representación en
  medidas caseras, la lista de la compra y el volumen semanal coinciden con el cálculo manual en el
  100 % de los casos de prueba de los escenarios de aceptación.
- **SC-007**: Ninguna cantidad mostrada en medida casera se desvía más de un 10 % de la cantidad
  real.
- **SC-008**: Corregir los valores de un ingrediente no modifica el total de ningún día anterior a la
  corrección.
- **SC-009**: Un fichero CSV de 80 ingredientes se importa en menos de 1 minuto de principio a fin.
- **SC-010**: Con 5 años de datos acumulados (≈ 750 sesiones y ≈ 7.000 consumos), las pantallas de
  historial, resumen del día y volumen semanal se muestran en menos de 1 segundo.
- **SC-011**: Ninguna pantalla contiene rachas, logros, avisos de incumplimiento ni textos o colores
  valorativos (verificable por revisión de todas las pantallas).

## Assumptions

- La app se usa principalmente en un teléfono, en el gimnasio y en la cocina; hay un único
  dispositivo y no hay sincronización.
- La pantalla principal muestra la sesión en curso (si la hay) con la siguiente serie precargada, el
  acceso para iniciar una sesión, los elementos planificados del día, los frecuentes del momento del
  día actual (FR-045) y las comidas del día anterior, con acción directa de registro.
- El catálogo base se toma de free-exercise-db (dominio público) y se empaqueta en la app; la
  traducción de grupos musculares y equipamiento se hace una sola vez al empaquetar.
- Las demostraciones del catálogo base son imágenes estáticas (inicio y final del movimiento), no
  animaciones.
- El peso se registra en kilogramos y las medidas corporales en centímetros; no hay cambio de
  sistema de unidades.
- Una serie de calentamiento es la que el usuario marca como tal; no se infiere a partir del peso.
- Los valores nutricionales considerados son calorías, proteínas, hidratos de carbono y grasas.
- Los líquidos se gestionan en mililitros con valores nutricionales por 100 ml; no se convierte entre
  gramos y mililitros.
- Las medidas caseras se añaden desde la app, no desde el CSV de ingredientes.
- Las recetas, el plan de comidas y la lista de la compra usan siempre los valores actuales de los
  ingredientes; solo los consumos registrados guardan valores congelados.
- Hay una única lista de la compra activa a la vez.
- Fuera de alcance: usuarios múltiples, autenticación, funciones sociales, control de despensa,
  escaneo de códigos de barras, base de datos de alimentos empaquetada, planificación automática de
  dietas o rutinas, recomendaciones de cualquier tipo, temporizador de descanso, estimación de 1RM y
  sincronización entre dispositivos.
