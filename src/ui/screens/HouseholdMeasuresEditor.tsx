// Medidas caseras propias de un ingrediente (FR-033). Sin tabla global de conversión.
import { useState } from "preact/hooks";
import { setHouseholdMeasures } from "../../data/actions/food.ts";
import type { HouseholdMeasure, Ingredient } from "../../domain/types.ts";
import { NumberField } from "../components/NumberField.tsx";
import { useAction } from "../components/useAction.ts";

export function HouseholdMeasuresEditor({ ingredient }: { ingredient: Ingredient }) {
  const [rows, setRows] = useState<{ name: string; amount: number | null }[]>(ingredient.householdMeasures);
  const [saved, setSaved] = useState(false);
  const { run, error } = useAction();

  const update = (i: number, patch: Partial<{ name: string; amount: number | null }>) => {
    setSaved(false);
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  };

  return (
    <div class="card stack">
      <h3>Medidas caseras</h3>
      <p class="muted">Equivalencias propias de este ingrediente, en {ingredient.baseUnit}. Nombre en singular.</p>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "6px", alignItems: "end" }}>
          <label>
            Medida
            <input value={r.name} placeholder="cucharada" onInput={(e) => update(i, { name: (e.currentTarget as HTMLInputElement).value })} />
          </label>
          <NumberField label="Equivale a" suffix={ingredient.baseUnit} value={r.amount} onValue={(amount) => update(i, { amount })} />
          <button type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))}>
            Quitar
          </button>
        </div>
      ))}
      <div class="row">
        <button type="button" onClick={() => setRows([...rows, { name: "", amount: null }])}>
          Añadir medida
        </button>
        <button
          type="button"
          class="primary"
          onClick={() =>
            void run(async () => {
              await setHouseholdMeasures(
                ingredient.id,
                rows.map((r) => ({ name: r.name, amount: r.amount ?? 0 }) as HouseholdMeasure),
              );
              setSaved(true);
            })
          }
        >
          Guardar medidas
        </button>
      </div>
      {saved && <p class="muted">Medidas guardadas.</p>}
      {error && <p class="field-error">{error}</p>}
    </div>
  );
}
