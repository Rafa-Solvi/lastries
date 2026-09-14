# Contract: Flujos de registro desde la pantalla principal

**Constitución**: principio III (2.0.0) y "Flujo de desarrollo y puertas de calidad" |
**Requisitos**: FR-008, FR-009, FR-017–019, FR-021, FR-040–041, FR-045, SC-001, SC-003

Documenta, para cada registro conocido, las interacciones desde la pantalla principal. Interacción =
un toque o una confirmación. Presupuesto máximo: 2. Toda pantalla, diálogo o validación nueva en
estos flujos debe mantener el recuento.

## Pantalla principal (orden vertical)

1. **Sesión en curso** (si existe): ejercicio en curso con "última vez" y la siguiente serie
   precargada con botón **Confirmar**; acceso a la sesión completa.
   **Ejercicio en curso**: el de la última serie confirmada en la sesión si aún le quedan series
   pendientes; si no, el primero con series pendientes en el orden de la sesión.
   Sin sesión en curso: botones **Iniciar <rutina>** (rutinas usadas recientemente) e
   **Iniciar sesión vacía**.
2. **Hoy planificado**: elementos del plan de hoy con botón **Comido**.
3. **Frecuentes — <momento actual>**: hasta 10 elementos (FR-045), cada uno con botón **+**.
4. **Ayer**: por cada momento con consumos ayer, botón **Repetir <momento>**.
5. **Resumen del día**: totales frente a objetivos vigentes y diferencia neutra.
6. Navegación a Entrenamiento, Alimentación, Compra, Progreso y Ajustes.

## Recuento

| Registro | Interacciones | Detalle |
|----------|---------------|---------|
| Serie precargada del ejercicio en curso | **1** | Confirmar |
| Serie precargada de otro ejercicio de la sesión | **2** | Abrir sesión → Confirmar |
| Serie precargada con un valor ajustado | 1 + ajuste | Tocar campo y escribir, o un toque en el selector de RIR `0 1 2 3 4 5 Fallo` (el ajuste queda fuera del presupuesto, FR-008) + Confirmar. Cada cambio de campo se guarda como borrador (FR-021) |
| Serie sin confirmar tras volver a la app | **1** | Confirmar sobre los valores restaurados, marcados "sin confirmar" |
| Iniciar sesión desde rutina reciente y confirmar la primera serie | **2** | Iniciar <rutina> → Confirmar |
| Elemento planificado de hoy como comido | **1** | Comido (momento y cantidad del plan) |
| Frecuente del momento actual | **1** | + (momento por hora, cantidad del último consumo) |
| Comida de un momento de ayer | **1** | Repetir <momento> |
| Deshacer el último registro | 1 | FR-009: aviso no modal con **Deshacer** durante ≥ 8 s o hasta el siguiente registro; no bloquea ni añade pasos. Caduca también al editar la siguiente serie del mismo ejercicio. Deshacer una serie la devuelve a borrador; deshacer un consumo lo elimina |

Ninguno de estos flujos abre diálogos de confirmación. Los cambios de momento, cantidad o marca de
calentamiento se hacen editando el registro después.

## Fuera del presupuesto (FR-008)

Alta de ingredientes, recetas o ejercicios; primer registro de un elemento no presente en
frecuentes ni en el plan (búsqueda en el catálogo); importaciones; edición de registros pasados.
