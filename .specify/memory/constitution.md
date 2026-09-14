# Lastries Constitution

Aplicación personal de uso individual para registrar entrenamiento y alimentación. Hay un solo
usuario y un solo dispositivo; no existen cuentas, usuarios múltiples ni autenticación.

## Core Principles

### I. Simplicidad sobre generalidad

- NO se construyen abstracciones, capas de configuración ni puntos de extensión para casos que no
  existen hoy. Hay un solo usuario y un solo dispositivo, y el diseño DEBE asumirlo.
- Quedan excluidos por defecto: gestión de usuarios, autenticación, permisos, sincronización entre
  dispositivos, multi-tenancy e internacionalización genérica.
- Toda abstracción nueva DEBE apoyarse en al menos dos usos concretos ya existentes en el código;
  en caso contrario se escribe la solución directa.

**Razón**: cada capa de generalidad añade coste de mantenimiento sin beneficio para un único
usuario. El código directo es más fácil de leer, probar y cambiar.

### II. Los datos son del usuario

- Todo el almacenamiento es local en el dispositivo. No hay backend propio ni de terceros.
- La exportación DEBE estar disponible en todo momento y DEBE producir un único fichero comprimido
  que contiene un documento JSON con todos los datos y una carpeta con los archivos de demostración
  aportados por el usuario.
- El documento JSON DEBE ser legible y editable de forma independiente una vez extraído, sin
  necesidad de la app ni de los archivos de medios.
- DEBE existir además una exportación solo de datos, sin archivos de medios, que produzca el mismo
  documento JSON.
- La importación DEBE aceptar ambas variantes. Si faltan archivos de medios, DEBE restaurar todos
  los datos y dejar sin demostración los ejercicios afectados, sin fallar por ello.
- Ninguna funcionalidad puede depender de un servicio externo en tiempo de ejecución: la app DEBE
  funcionar íntegramente sin conexión de red.

**Razón**: el usuario conserva el control total de su historial, puede hacer copias de seguridad y
migrar sin depender de la disponibilidad de ningún servicio.

### III. Velocidad de registro por encima de todo

- Repetir un registro que la app ya conoce NO puede requerir más de dos interacciones desde la
  pantalla principal. Son registros conocidos una serie de un ejercicio de la sesión en curso y un
  alimento o receta de la lista de frecuentes.
- Dar de alta un ingrediente, ejercicio o receta nuevos queda fuera de esta regla.
- Una interacción es un toque o una confirmación; escribir en un campo ya abierto no cuenta como
  interacción separada.
- Para cumplirlo, los valores del registro DEBEN precargarse con datos razonables (p. ej. la última
  serie del ejercicio o la última ración del alimento), de modo que ajustarlos sea opcional.
- Cualquier funcionalidad, pantalla intermedia, diálogo o validación que alargue el flujo de repetir
  un registro conocido se rechaza, independientemente de su valor en otros aspectos.

**Razón**: el registro ocurre entre series o delante del plato. Si registrar cuesta, se deja de
registrar, y sin registros la app no sirve para nada.

### IV. Gramos y mililitros como unidad canónica

- Toda cantidad de alimento se almacena y se calcula internamente en gramos (sólidos) o mililitros
  (líquidos). Ningún cálculo opera sobre medidas caseras.
- Las medidas caseras (cucharada, taza, unidad, rebanada…) son exclusivamente capa de presentación
  y de entrada, y se convierten a la unidad canónica en el borde.
- La equivalencia de cada medida casera se define por ingrediente. Está prohibida una tabla global
  de conversión (p. ej. "1 taza = 240 g" para cualquier alimento).

**Razón**: una cucharada de aceite y una de harina no pesan lo mismo. Una unidad canónica única
evita errores acumulados en escalado, totales y lista de la compra.

### V. Registrar y mostrar, no juzgar

- La app registra datos y los muestra. NO incluye rachas, logros, puntuaciones, notificaciones de
  incumplimiento ni mensajes valorativos sobre lo comido o lo entrenado.
- La presentación de datos frente a objetivos DEBE ser neutra (valores y diferencias), sin colores
  o textos que califiquen el resultado como bueno o malo.
- Todos los objetivos (calorías, macros, volumen, etc.) son datos editables por el usuario y
  forman parte de la exportación. Ningún objetivo ni umbral puede ser una constante en el código.

**Razón**: la herramienta sirve al criterio del usuario, no lo sustituye. Los juicios automáticos
generan presión y distorsionan el registro.

### VI. Dependencias mínimas y recursos empaquetados

- Cada dependencia de terceros DEBE justificarse frente a la alternativa de escribir el código
  directamente; se prefiere la plataforma estándar.
- Ninguna funcionalidad requiere claves de API ni credenciales.
- Los recursos de terceros (fuentes, iconos, bases de datos de alimentos o ejercicios, imágenes)
  se empaquetan en la app. Está prohibido enlazarlos en caliente desde CDNs o servidores externos.

**Razón**: menos dependencias significa menos roturas, menos actualizaciones forzadas y coherencia
con el funcionamiento sin conexión del principio II.

### VII. Tests obligatorios en la lógica de cálculo

- Tienen tests automatizados obligatorios, y DEBEN pasar antes de integrar cualquier cambio que les
  afecte, estas cuatro áreas:
  1. Conversión de unidades (medidas caseras ↔ gramos/mililitros).
  2. Escalado de raciones.
  3. Agregación de la lista de la compra.
  4. Cálculo de volumen semanal de entrenamiento.
- Esta lógica DEBE vivir en funciones puras separadas de la UI para poder probarse sin ella.
- El resto de la UI no requiere cobertura de tests.

**Razón**: un error en estos cálculos corrompe datos o decisiones de forma silenciosa; un error de
UI se ve a simple vista. El esfuerzo de testing se concentra donde el fallo es invisible.

## Restricciones técnicas

- **Funcionamiento sin conexión**: la app arranca, registra, calcula, exporta e importa sin red.
- **Formato de exportación**: el documento JSON exportado incluye un campo de versión de esquema,
  igual en la exportación completa y en la de solo datos. La importación de un fichero de una
  versión anterior DEBE funcionar o fallar de forma explícita, sin modificar ni corromper los datos
  existentes. La ausencia de archivos de medios no es motivo de fallo (principio II).
- **Datos, no código**: objetivos, medidas caseras por ingrediente y cualquier preferencia del
  usuario se almacenan como datos y viajan en la exportación.
- **Sin telemetría**: no se envían analíticas, informes de errores ni ningún dato fuera del
  dispositivo.

## Flujo de desarrollo y puertas de calidad

- Cada plan de implementación (`/speckit-plan`) DEBE superar el "Constitution Check" evaluando
  explícitamente los principios I–VII antes de la fase de diseño y de nuevo tras ella.
- Cada especificación que toque el registro de series o comidas DEBE describir el flujo de repetir
  un registro conocido desde la pantalla principal y demostrar que requiere dos interacciones o
  menos (principio III).
- Cualquier violación de un principio DEBE documentarse en la tabla de seguimiento de complejidad
  del plan con su justificación y la alternativa más simple descartada; sin justificación, el
  cambio se rechaza.
- Los tests del principio VII se ejecutan y pasan antes de dar por terminada una tarea que afecte
  a esa lógica.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica, preferencia o plantilla del proyecto.
- Las enmiendas se realizan editando este documento mediante `/speckit-constitution`, registrando
  el cambio en el Sync Impact Report y actualizando la versión y la fecha de última enmienda.
- Versionado semántico:
  - **MAJOR**: eliminación o redefinición incompatible de un principio.
  - **MINOR**: principio o sección nuevos, o ampliación material de las normas.
  - **PATCH**: aclaraciones, redacción y correcciones sin cambio de significado.
- Revisión de cumplimiento: cada spec, plan y lista de tareas se contrasta con esta constitución;
  `/speckit-analyze` DEBE señalar como crítico cualquier conflicto con un principio.

**Version**: 2.0.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-14
