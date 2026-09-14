# Contract: Configuración inicial en JSON

**Requisitos**: FR-063 | **Código**: `src/domain/setupImport.ts`, plantilla en `src/domain/setupTemplate.ts`

Fichero escrito a mano para dejar la app preparada: ejercicios, rutinas, ingredientes, recetas,
momentos del día, objetivos y tipos de medida. En la app: **Ajustes → Configuración inicial →
Importar configuración…** (y **Descargar plantilla** para partir de un ejemplo completo).

No confundir con la exportación completa (`format: "lastries"`, [export-format.md](export-format.md)),
que sustituye todos los datos.

## Reglas generales

- UTF-8, JSON estándar (sin comentarios ni comas finales).
- Todas las secciones son opcionales. Una clave desconocida es un error (evita erratas silenciosas).
- Todo se referencia **por nombre**, sin distinguir mayúsculas ni tildes (`"triceps"` = `"Tríceps"`).
- **Fusión**: lo que existe con el mismo nombre se actualiza; lo que no, se crea. Nunca se borran
  sesiones, consumos, pesajes ni medidas. Reimportar el mismo fichero no duplica nada.
- En una actualización, los campos omitidos conservan su valor actual (salvo en `objetivos`, donde
  cada objeto es el objetivo completo de esa fecha).
- Validación de todo el fichero antes de aplicar: si hay algún error no se aplica nada y se listan
  todos con su ruta (`rutinas[0].ejercicios[2].rir: entero de 0 a 10`).
- Antes de aplicar se muestra un resumen de nuevos y actualizados por sección; se aplica en una única
  transacción.
- Nombres repetidos dentro de una misma sección son error.
- Números con más decimales de los admitidos se redondean: nutrientes y cantidades a 1 decimal,
  raciones a 2.

## Estructura

```json
{
  "formato": "lastries-configuracion",
  "version": 1,
  "gruposMusculares": ["Core"],
  "ejercicios": [],
  "rutinas": [],
  "ingredientes": [],
  "recetas": [],
  "momentos": [],
  "objetivos": [],
  "tiposMedida": []
}
```

`formato` y `version` son obligatorios y exactos.

## gruposMusculares

Lista de nombres (1–60 caracteres) de grupos **nuevos**. Los del catálogo ya existen y no hace falta
declararlos: Abdominales, Abductores, Aductores, Bíceps, Gemelos, Pecho, Antebrazos, Glúteos,
Isquiotibiales, Dorsales, Zona lumbar, Espalda media, Cuello, Cuádriceps, Hombros, Trapecios, Tríceps.
Usar en `primarios`/`secundarios` un grupo que no exista ni esté declarado aquí es error.

## ejercicios

| Campo | Tipo | Regla |
|-------|------|-------|
| `nombre` | texto 1–120 | obligatorio; nombre con el que aparecerá en la app |
| `catalogo` | texto | opcional; nombre original en inglés (`"Barbell Squat"`) o id de free-exercise-db. El ejercicio del catálogo se renombra a `nombre` y conserva sus imágenes |
| `primarios` | lista de grupos | obligatoria (≥ 1) si el ejercicio es nuevo y no usa `catalogo`; si se indica, sustituye a los actuales |
| `secundarios` | lista de grupos | opcional; si se indica, sustituye a los actuales (se ignoran los que ya sean primarios) |
| `equipamiento` | texto o null | opcional |

Sin `catalogo`: si ya existe un ejercicio con ese `nombre` se actualiza; si no, se crea uno propio.
Si hay varios con el mismo nombre, es error: usa `catalogo` para desambiguar.

## rutinas

| Campo | Tipo | Regla |
|-------|------|-------|
| `nombre` | texto 1–60 | obligatorio; si existe una rutina con ese nombre, **sus ejercicios se sustituyen** por los del fichero |
| `ejercicios` | lista | obligatoria, en orden |
| `ejercicios[].ejercicio` | texto | nombre de un ejercicio de este fichero, o de uno existente (nombre actual o nombre en inglés del catálogo) |
| `ejercicios[].series` | entero 1–20 | obligatorio |
| `ejercicios[].repeticiones` | entero 1–100 o `[mín, máx]` | obligatorio; `10` equivale a `[10, 10]` |
| `ejercicios[].rir` | entero 0–10 | obligatorio |

## ingredientes

| Campo | Tipo | Regla |
|-------|------|-------|
| `nombre` | texto 1–80 | obligatorio |
| `unidad` | `"g"` o `"ml"` | opcional; por defecto `"g"` al crear |
| `kcal`, `proteinas`, `hidratos`, `grasas` | número ≥ 0 | obligatorios al crear; por cada 100 g o 100 ml |
| `seccion` | texto o null | sección del supermercado |
| `formatoCompra` | `{ "nombre": texto 1–30, "cantidad": número > 0 }` o null | cantidad en la unidad del ingrediente (bandeja de 500 g, docena de 720 g) |
| `medidas` | lista de `{ "nombre": texto 1–30, "cantidad": número > 0 }` | medidas caseras propias, nombre en singular; si se indica, sustituye la lista actual |

## recetas

| Campo | Tipo | Regla |
|-------|------|-------|
| `nombre` | texto 1–120 | obligatorio |
| `raciones` | número > 0 | obligatorio al crear; raciones base |
| `ingredientes` | lista de `{ "ingrediente": nombre, "cantidad": número > 0 }` | obligatoria al crear (≥ 1); cantidad en la unidad del ingrediente; el ingrediente puede venir de este fichero o existir ya |
| `pasos` | lista de textos | opcional |

## momentos

Lista de `{ "nombre": texto 1–30, "inicio": "HH:MM" }`. Si la sección está presente, define los
momentos del día: se crean o actualizan los del fichero y **se quitan los que no aparecen y no tienen
consumos ni planificación** (los que sí tienen se conservan con un aviso). Dos momentos no pueden
empezar a la misma hora.

## objetivos

Lista de `{ "desde": "AAAA-MM-DD", "kcal", "proteinas", "hidratos", "grasas" }`. `desde` por defecto es
hoy. Cada valor es número ≥ 0 o null (sin objetivo); los omitidos se guardan como null. Si ya existe un
objetivo con esa fecha, se sustituye.

## tiposMedida

Lista de nombres (1–30) de tipos de medida corporal; se añaden los que falten.

## Ejemplo completo

Es el mismo que descarga **Descargar plantilla**:

```json
{
  "formato": "lastries-configuracion",
  "version": 1,
  "gruposMusculares": ["Core"],
  "ejercicios": [
    { "nombre": "Press banca", "catalogo": "Barbell Bench Press - Medium Grip" },
    { "nombre": "Sentadilla", "catalogo": "Barbell Squat" },
    { "nombre": "Peso muerto rumano", "catalogo": "Romanian Deadlift", "primarios": ["Isquiotibiales", "Glúteos"], "secundarios": ["Zona lumbar"] },
    { "nombre": "Dominadas", "catalogo": "Pullups" },
    { "nombre": "Remo con barra", "catalogo": "Bent Over Barbell Row" },
    { "nombre": "Press militar", "catalogo": "Standing Military Press" },
    { "nombre": "Rueda abdominal", "primarios": ["Core"], "secundarios": ["Hombros"], "equipamiento": "Rueda" }
  ],
  "rutinas": [
    {
      "nombre": "Torso A",
      "ejercicios": [
        { "ejercicio": "Press banca", "series": 3, "repeticiones": [6, 8], "rir": 2 },
        { "ejercicio": "Dominadas", "series": 3, "repeticiones": [6, 10], "rir": 2 },
        { "ejercicio": "Press militar", "series": 3, "repeticiones": [8, 10], "rir": 2 },
        { "ejercicio": "Remo con barra", "series": 3, "repeticiones": [8, 10], "rir": 2 }
      ]
    },
    {
      "nombre": "Pierna A",
      "ejercicios": [
        { "ejercicio": "Sentadilla", "series": 4, "repeticiones": [5, 8], "rir": 2 },
        { "ejercicio": "Peso muerto rumano", "series": 3, "repeticiones": [8, 10], "rir": 2 },
        { "ejercicio": "Rueda abdominal", "series": 3, "repeticiones": 10, "rir": 3 }
      ]
    }
  ],
  "ingredientes": [
    {
      "nombre": "Arroz blanco", "unidad": "g", "kcal": 350, "proteinas": 7, "hidratos": 77, "grasas": 0.6,
      "seccion": "Despensa", "formatoCompra": { "nombre": "paquete", "cantidad": 1000 },
      "medidas": [{ "nombre": "vaso", "cantidad": 180 }]
    },
    {
      "nombre": "Pechuga de pollo", "unidad": "g", "kcal": 110, "proteinas": 23, "hidratos": 0, "grasas": 1.5,
      "seccion": "Carnicería", "formatoCompra": { "nombre": "bandeja", "cantidad": 500 }
    },
    {
      "nombre": "Aceite de oliva virgen extra", "unidad": "ml", "kcal": 824, "proteinas": 0, "hidratos": 0, "grasas": 91.6,
      "seccion": "Despensa", "formatoCompra": { "nombre": "botella", "cantidad": 1000 },
      "medidas": [{ "nombre": "cucharada", "cantidad": 13.5 }, { "nombre": "cucharadita", "cantidad": 4.5 }]
    },
    {
      "nombre": "Huevo", "unidad": "g", "kcal": 143, "proteinas": 12.6, "hidratos": 0.7, "grasas": 9.5,
      "seccion": "Huevos", "formatoCompra": { "nombre": "docena", "cantidad": 720 },
      "medidas": [{ "nombre": "unidad", "cantidad": 60 }]
    }
  ],
  "recetas": [
    {
      "nombre": "Arroz con pollo", "raciones": 2,
      "ingredientes": [
        { "ingrediente": "Arroz blanco", "cantidad": 160 },
        { "ingrediente": "Pechuga de pollo", "cantidad": 300 },
        { "ingrediente": "Aceite de oliva virgen extra", "cantidad": 20 }
      ],
      "pasos": ["Dorar el pollo troceado en el aceite", "Añadir el arroz y el doble de agua", "Cocer 18 minutos"]
    }
  ],
  "momentos": [
    { "nombre": "Desayuno", "inicio": "07:00" },
    { "nombre": "Comida", "inicio": "13:30" },
    { "nombre": "Merienda", "inicio": "17:30" },
    { "nombre": "Cena", "inicio": "21:00" }
  ],
  "objetivos": [{ "desde": "2026-09-14", "kcal": 2500, "proteinas": 160, "hidratos": null, "grasas": 70 }],
  "tiposMedida": ["Cintura", "Cadera", "Brazo"]
}
```

## Buscar nombres del catálogo

Los nombres en inglés para `catalogo` están en `public/catalog/exercises.json` (`originalName`) y en la
app: **Ejercicios**, buscando en inglés; el detalle muestra "Nombre original".
