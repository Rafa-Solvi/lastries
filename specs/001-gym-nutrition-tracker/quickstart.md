# Quickstart: validación de la feature

**Feature**: `001-gym-nutrition-tracker` | **Plan**: [plan.md](plan.md)

Guía para comprobar de principio a fin que la app cumple la spec. No contiene implementación.

## Requisitos previos

- Node 22 LTS y npm.
- Navegador Chromium de escritorio con DevTools (modo dispositivo y "Offline").
- Teléfono Android o iPhone para la validación final, y la app publicada en un hosting estático
  con HTTPS (necesario para instalar la PWA fuera de `localhost`).

## Comandos

```bash
npm install          # dependencias fijadas
npm test             # Vitest: tests de src/domain (principio VII)
npm run dev          # servidor de desarrollo en http://localhost:5173
npm run build        # build de producción en dist/ + generación de sw.js
npm run preview      # sirve dist/ en http://localhost:4173 con service worker activo
```

`scripts/build-catalog.ts` solo se ejecuta al actualizar el catálogo base (research R6); el
repositorio ya contiene `public/catalog/`.

## 1. Tests obligatorios

`npm test` pasa y cubre al menos los casos de [contracts/domain-functions.md](contracts/domain-functions.md)
para `household`, `scaling`, `shopping` y `volume`, además de `exportFormat` y `migrations` (con un
fixture por versión de esquema en `tests/fixtures/`). **Esperado**: 0 fallos.

## 2. Entrenamiento (US1, US5)

1. `npm run preview`, abrir en modo dispositivo móvil.
2. Buscar "bench press" en ejercicios → aparece "Barbell Bench Press" con imágenes y grupos en
   español. Renombrarlo a "Press banca"; buscar "bench press" y "press banca" → ambas lo encuentran.
3. Crear rutina "Torso A" con Press banca 3 × 6–8 @ RIR 2 y Fondos 3 × 8–12 @ RIR 1.
4. Iniciar sesión desde la pantalla principal. **Esperado**: 3 series de press banca con peso vacío,
   6 repeticiones (mínimo del rango) y RIR 2.
5. Registrar 3 calentamientos (20 × 10, 40 × 8, 60 × 5, marcados) y 3 efectivas (80 × 8 @ 2).
   Cerrar la pestaña, reabrir → la sesión sigue con las 6 series. Finalizar.
6. Iniciar otra sesión de "Torso A". **Esperado**: "última vez" muestra las 6 series con los
   calentamientos diferenciados; la primera serie precargada es 20 × 10 marcada; cada
   **Confirmar** registra con 1 toque ([contracts/logging-flows.md](contracts/logging-flows.md)).
7. Borrador: en la siguiente serie cambiar el peso a 82,5 y el RIR con el selector (botones
   `0 1 2 3 4 5 Fallo` en una fila, sin desplazamiento). Sin confirmar, cerrar la pestaña (en el
   teléfono: cambiar de app hasta que el sistema la descarte). Reabrir. **Esperado**: 82,5 y el RIR
   elegido, marcados "sin confirmar"; **Confirmar** los registra.
8. Deshacer: confirmar una serie y tocar **Deshacer** en el aviso. **Esperado**: la serie vuelve a
   pendiente con sus valores; el aviso desaparece solo al registrar otra cosa o pasados ≥ 8 s.
9. Añadir "Dominadas", quitar "Fondos", reordenar; abrir la rutina → sin cambios.
10. Ver volumen de la semana. **Esperado**: las series de calentamiento no cuentan; los valores
   coinciden con el cálculo manual (1 por primario, 0,5 por secundario).

## 3. Alimentación (US2, US4)

1. Ajustes → Importar ingredientes → CSV del ejemplo de
   [contracts/ingredients-csv.md](contracts/ingredients-csv.md) con separador `;` y coma decimal.
   **Esperado**: 4 ingredientes creados.
2. Importar un CSV con una fila sin `kcal`. **Esperado**: ningún ingrediente creado; error
   "fila N (nombre): falta kcal".
3. Configurar objetivos desde hoy: 2.500 kcal. Registrar 80 g de arroz. **Esperado**: 280 kcal,
   diferencia "−2.220 kcal", sin colores valorativos.
4. Añadir a la harina "vaso = 150 g" y "cucharada = 10 g"; receta de 2 raciones con 45 g de harina
   y 27 g de aceite ("cucharada = 13,5 g"). Vista medidas caseras → "4 y 1/2 cucharadas" y
   "2 cucharadas"; escalar a 3 → harina 67,5 g "6 y 3/4 cucharadas" (1/2 vaso descartado: 11 %) y
   aceite "3 cucharadas".
5. Registrar pollo a 110 kcal/100 g con fecha de ayer; corregir el pollo a 120. **Esperado**: el
   total de ayer no cambia.
6. Registrar ayer 200 g de pollo en la cena con 110 kcal/100 g; hoy corregir el pollo a 120 y tocar
   **Repetir cena** de ayer. **Esperado**: la cena de ayer sigue en 220 kcal; la de hoy se registra
   con 240 kcal y ya no cambia si el pollo se vuelve a editar.
7. Cambiar la hora del sistema a las 16:40 con "Comida" desde 13:00 y "Merienda" desde 17:00; tocar
   **+** en un frecuente. **Esperado**: se guarda en Comida sin preguntar.

## 4. Plan y lista de la compra (US6)

1. Planificar recetas e ingredientes en 3 días con tomate repetido; generar lista para el rango.
   **Esperado**: una línea de tomate con la suma; pollo en bandejas redondeando hacia arriba;
   agrupación por sección con "Sin sección" al final.
2. Marcar tomate como comprado, añadir línea manual, añadir al plan una receta que duplica el
   pollo y regenerar. **Esperado**: tomate sigue marcado, línea manual intacta, pollo desmarcado si
   sube el número de bandejas.

## 5. Progreso (US7)

Pesos 80,0 (lunes), 80,6 (miércoles), 79,8 (domingo). **Esperado**: domingo muestra 79,8 y media
80,1. Registrar cintura en varias fechas y ver su evolución.

## 6. Exportación e importación (US3)

1. Añadir un GIF propio a un ejercicio. Exportar completa → ZIP con `lastries.json` y `media/`.
   Extraer y abrir el JSON en un editor: legible, sangrado, sin imágenes del catálogo base.
2. Exportar solo datos → `.json` idéntico al del ZIP (salvo `exportedAt`).
3. Ajustes → borrar datos del sitio → importar el ZIP. **Esperado**: todo idéntico; el ejercicio
   conserva su GIF.
4. Importar el `.json` solo datos. **Esperado**: todos los datos restaurados; el ejercicio queda sin
   demostración, sin error.
5. Editar el JSON poniendo `"rir": 15` en una serie e importarlo. **Esperado**: aborta con la ruta del
   campo; los datos existentes no cambian.
6. Importar con datos existentes y cancelar en la confirmación. **Esperado**: nada cambia.

## 7. Sin conexión y pantalla principal (SC-005, SC-011)

1. Tras cargar `preview` una vez, activar "Offline" en DevTools y recargar. **Esperado**: la app
   arranca y todas las comprobaciones anteriores funcionan, incluidas las imágenes del catálogo.
2. DevTools → Network sin filtro durante una sesión de uso completa. **Esperado**: ninguna petición a
   orígenes externos.
3. Revisar todas las pantallas. **Esperado**: sin rachas, logros, avisos ni colores valorativos.

## 8. Migraciones y actualizaciones (research R5, R14)

1. `npm test` incluye `migrations.test.ts`: cada fixture `schema-v<n>.json` migra y valida; un
   documento con `schemaVersion` mayor que el del código se rechaza.
2. Al introducir la primera versión de esquema 2: con datos reales de la versión 1 en el navegador,
   desplegar el build nuevo y reabrir dos veces. **Esperado**: los datos aparecen migrados;
   `meta.preMigrationBackup` contiene el documento v1; un ejercicio con GIF propio lo conserva
   después de migrar.
3. Forzar un fallo de migración (build de prueba con una migración que lance error). **Esperado**:
   la app muestra la pantalla de error de migración, no modifica ningún almacén y permite exportar el
   documento previo.
4. Publicar un cambio y abrir la app instalada sin red. **Esperado**: versión anterior. Abrir con red
   y volver a abrir con una sesión en curso. **Esperado**: no recarga durante la sesión; Ajustes
   muestra la versión en espera y se aplica en el siguiente arranque.

## Resultados medidos (2026-09-14)

Datos sintéticos de `node scripts/gen-five-years.ts` (783 sesiones, 23.490 series, 7.300 consumos,
1.550 pesajes), Chrome headless con viewport 360 px y CPU ralentizada 4×:

| Medida | Objetivo | Resultado |
|--------|----------|-----------|
| Arranque en frío con 5 años | < 2 s | 425–632 ms |
| Historial de ejercicio | < 1 s | 471 ms |
| Resumen del día | < 1 s | 91 ms |
| Volumen semanal | < 1 s | 87 ms |
| Confirmar serie y ver la siguiente | < 100 ms | 42 ms |
| Importar el fichero de 5 años (sin ralentizar) | — | 1,4 s |

Pendiente repetir en un teléfono de gama media real.

## 9. Teléfono

Instalar la PWA desde el hosting en el teléfono, activar modo avión y repetir los apartados 2
(pasos 3–8, forzando el descarte de la app en segundo plano) y 6 (exportar mediante la hoja de compartir). En Ajustes, comprobar que el
almacenamiento figura como persistente.
