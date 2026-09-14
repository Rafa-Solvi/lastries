# Contract: Importación de ingredientes desde CSV

**Requisitos**: FR-032, SC-009 | **Research**: R8

## Formato

- Codificación UTF-8, con o sin BOM.
- Primera fila: cabecera. Separador detectado en la cabecera: `;` si aparece, si no `,`.
- Campos entre comillas dobles opcionales; `""` dentro de comillas representa una comilla.
- Con separador `;` se acepta coma decimal (`12,5`); con `,` solo punto decimal.
- Filas completamente vacías se ignoran.

## Columnas

El orden es libre; los nombres de cabecera son exactos (sin distinguir mayúsculas ni espacios
extremos). Columnas desconocidas → error de cabecera.

| Cabecera | Obligatoria | Tipo | Regla | Campo |
|----------|-------------|------|-------|-------|
| `nombre` | sí | texto | 1–80 caracteres; único en el fichero y frente a ingredientes existentes (normalizado) | `name` |
| `unidad_base` | sí | `g` \| `ml` | | `baseUnit` |
| `kcal` | sí | número | ≥ 0 | `per100.kcal` |
| `proteinas` | sí | número | ≥ 0 | `per100.protein` |
| `hidratos` | sí | número | ≥ 0 | `per100.carbs` |
| `grasas` | sí | número | ≥ 0 | `per100.fat` |
| `seccion` | no | texto | vacío = sin sección | `section` |
| `formato_compra` | no | texto | si se indica, `formato_equivalencia` es obligatoria | `purchaseFormat.name` |
| `formato_equivalencia` | no | número | > 0, en la unidad base; si se indica, `formato_compra` es obligatoria | `purchaseFormat.amount` |

Los valores nutricionales son por 100 unidades base. Las medidas caseras no se importan por CSV.

## Ejemplo

```csv
nombre;unidad_base;kcal;proteinas;hidratos;grasas;seccion;formato_compra;formato_equivalencia
Arroz blanco;g;350;7;77;0,6;Despensa;paquete;1000
Pechuga de pollo;g;110;23;0;1,5;Carnicería;bandeja;500
Leche semidesnatada;ml;46;3,2;4,7;1,6;Lácteos;brik;1000
Aceite de oliva virgen extra;ml;824;0;0;91,6;Despensa;botella;1000
```

## Resultado

- **Todo válido**: se crean todos los ingredientes en una transacción y se informa del número
  creado.
- **Algún error**: no se crea ninguno. Se lista cada error como `fila N (nombre): motivo`, contando
  la cabecera como fila 1. Ejemplos de motivo: "falta kcal", "unidad_base debe ser g o ml",
  "ya existe un ingrediente con este nombre", "nombre repetido en la fila 7",
  "formato_compra sin formato_equivalencia".
