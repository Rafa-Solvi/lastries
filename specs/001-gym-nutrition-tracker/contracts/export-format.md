# Contract: Formato de exportación e importación

**Requisitos**: FR-003, FR-004, SC-004 | **Constitución**: principio II, Restricciones técnicas

Contrato estable a largo plazo: un fichero exportado hoy debe poder importarse en cualquier versión
futura de la app (migrando) o ser rechazado explícitamente.

## Variantes

| Variante | Nombre de fichero | Contenido |
|----------|-------------------|-----------|
| Completa | `lastries-AAAA-MM-DD.zip` | `lastries.json` + `media/<fileName>` por cada `Media` |
| Solo datos | `lastries-AAAA-MM-DD.json` | el mismo documento que `lastries.json` |

- El documento JSON es idéntico en ambas variantes (misma lista `data.media` con metadatos).
- Las imágenes del catálogo base (`DemoRef.kind = "bundled"`) nunca se incluyen.
- Codificación UTF-8 sin BOM, sangría de 2 espacios, salto de línea `\n`.

## Documento JSON

```json
{
  "format": "lastries",
  "schemaVersion": 1,
  "exportedAt": "2026-09-14T21:05:00",
  "appVersion": "1.0.0",
  "catalogVersion": "<commit free-exercise-db>",
  "data": {
    "muscleGroups": [],
    "exercises": [],
    "media": [],
    "routines": [],
    "sessions": [],
    "ingredients": [],
    "recipes": [],
    "mealMoments": [],
    "plannedItems": [],
    "consumptions": [],
    "goals": [],
    "shoppingList": null,
    "bodyWeights": [],
    "measurementTypes": [],
    "bodyMeasurements": []
  }
}
```

- Cada colección contiene las entidades con exactamente los campos definidos en
  [data-model.md](../data-model.md), en inglés y con los mismos tipos. `media[]` omite `blob`.
- `shoppingList` es el objeto `ShoppingList` o `null`.
- Las sesiones se exportan con sus `draft` (borradores sin confirmar) tal cual; `meta` no se exporta
  (`preMigrationBackup` es interno).
- Las claves desconocidas se rechazan en validación (evita importar ficheros de otra app o con
  errores tipográficos silenciosos).

## Importación

Entrada aceptada: fichero `.zip` (variante completa) o `.json` (variante solo datos o JSON
extraído y editado a mano).

| Fase | Acción | Si falla |
|------|--------|----------|
| 1. Leer | ZIP: descomprimir y localizar `lastries.json` en la raíz. JSON: leer como texto | Aborta: "El fichero no es una exportación de Lastries" |
| 2. Parsear | `JSON.parse`; `format` debe ser `"lastries"` | Aborta con el error de sintaxis y su posición |
| 3. Migrar | Si `schemaVersion` < actual, aplicar la cadena de `migrations.ts` (la misma que se usa al arrancar, research R14); si > actual | Aborta: "Exportado con una versión más reciente de la app" |
| 4. Validar | Tipos, rangos y reglas de data-model; unicidad de ids y claves; integridad referencial; invariante de una sola sesión en curso | Aborta listando cada error con su ruta (`data.sessions[12].exercises[3].sets[0].rir: debe ser entero 0–10`) |
| 5. Resolver medios | Para cada `media[i]`, buscar `media/<fileName>` en el ZIP. Si falta (o la entrada es JSON suelto), eliminar ese `Media` y todas las `DemoRef` que lo referencian | Nunca falla. Se informa de forma neutra cuántas demostraciones no estaban disponibles |
| 6. Confirmar | Mostrar resumen (nº de sesiones, consumos, ingredientes…) y aviso de sustitución total | Cancelar no modifica nada |
| 7. Sustituir | Una única transacción IndexedDB: vaciar todos los almacenes y escribir todo lo importado | La transacción se revierte; los datos previos quedan intactos |

Tras sustituir, se vuelve a ejecutar la siembra del catálogo base (solo inserta `baseId` ausentes).

**Nunca se fusiona** con los datos existentes (FR-004).

## Garantías verificables

- Exportar → importar en app vacía → exportar produce un `lastries.json` idéntico salvo
  `exportedAt` (SC-004).
- Un JSON con un único error de validación no modifica ningún almacén.
- Un ZIP sin la carpeta `media/` importa todos los datos y deja sin demostraciones propias a los
  ejercicios que las tenían.
