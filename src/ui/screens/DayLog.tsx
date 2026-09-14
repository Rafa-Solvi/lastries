// Registro del día: consumos por momento y totales frente a objetivos (FR-041 – FR-044).
import { useState } from "preact/hooks";
import { addConsumption, deleteConsumption, updateConsumption } from "../../data/actions/food.ts";
import { todayLocal, useAppState } from "../../data/store.ts";
import { addDays, formatLong, formatShort } from "../../domain/dates.ts";
import { sortMoments } from "../../domain/mealMoment.ts";
import { consumptionTotals } from "../../domain/nutrition.ts";
import type { Consumption, FoodRef, Id } from "../../domain/types.ts";
import { isAmount, isServings } from "../../domain/validation.ts";
import { DaySummary } from "../components/DaySummary.tsx";
import { FoodPicker } from "../components/FoodPicker.tsx";
import { NumberField } from "../components/NumberField.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { formatKcal, formatRefQuantity } from "../format.ts";
import { navigate } from "../router.ts";

export function DayLog({ params }: { params: Record<string, string> }) {
  const date = params.date === "today" || !params.date ? todayLocal() : params.date;
  const moments = useAppState((s) => sortMoments(s.mealMoments));
  const consumptions = useAppState((s) => s.consumptions);
  const [adding, setAdding] = useState<Id | null>(null);
  const { run, error } = useAction();

  const day = consumptions.filter((c) => c.date === date);

  return (
    <div>
      <TopBar title={date === todayLocal() ? "Hoy" : formatShort(date)} />
      <div class="row card">
        <button type="button" onClick={() => navigate(`/day/${addDays(date, -1)}`)}>
          ← Día anterior
        </button>
        <button type="button" onClick={() => navigate(`/day/${todayLocal()}`)}>
          Hoy
        </button>
        <button type="button" onClick={() => navigate(`/day/${addDays(date, 1)}`)}>
          Siguiente →
        </button>
      </div>
      <p class="muted">{formatLong(date)}</p>

      <section class="card">
        <h2>Resumen</h2>
        <DaySummary date={date} />
      </section>

      {moments.map((m) => {
        const items = day.filter((c) => c.momentId === m.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
        return (
          <section key={m.id} class="card stack">
            <div class="spread">
              <h2>{m.name}</h2>
              <button type="button" onClick={() => setAdding(adding === m.id ? null : m.id)}>
                Añadir
              </button>
            </div>
            {adding === m.id && (
              <FoodPicker
                onCancel={() => setAdding(null)}
                onPick={(ref) =>
                  void run(async () => {
                    await addConsumption({ ref, date, momentId: m.id });
                    setAdding(null);
                  })
                }
              />
            )}
            <ul class="list">
              {items.map((c) => (
                <ConsumptionRow key={c.id} consumption={c} />
              ))}
              {items.length === 0 && <li class="muted">Nada registrado.</li>}
            </ul>
          </section>
        );
      })}
      {error && <p class="field-error">{error}</p>}
    </div>
  );
}

function ConsumptionRow({ consumption: c }: { consumption: Consumption }) {
  const ingredients = useAppState((s) => s.ingredients);
  const recipes = useAppState((s) => s.recipes);
  const moments = useAppState((s) => sortMoments(s.mealMoments));
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState<number | null>(c.ref.type === "ingredient" ? c.ref.amount : c.ref.servings);
  const [momentId, setMomentId] = useState(c.momentId);
  const { run, error } = useAction();

  const name =
    c.ref.type === "ingredient"
      ? (ingredients.find((i) => i.id === (c.ref as { ingredientId: Id }).ingredientId)?.name ?? "?")
      : (recipes.find((r) => r.id === (c.ref as { recipeId: Id }).recipeId)?.name ?? "?");
  const totals = consumptionTotals(c);

  if (editing) {
    const valid = qty !== null && (c.ref.type === "ingredient" ? isAmount(qty) : isServings(qty));
    return (
      <li class="stack">
        <strong>{name}</strong>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <NumberField label={c.ref.type === "ingredient" ? "Cantidad" : "Raciones"} value={qty} onValue={setQty} />
          <label>
            Momento
            <select value={momentId} onChange={(e) => setMomentId((e.currentTarget as HTMLSelectElement).value)}>
              {moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="row">
          <button
            type="button"
            class="primary"
            disabled={!valid}
            onClick={() =>
              void run(async () => {
                const ref: FoodRef = c.ref.type === "ingredient" ? { ...c.ref, amount: qty! } : { ...c.ref, servings: qty! };
                await updateConsumption(c.id, { ref, momentId });
                setEditing(false);
              })
            }
          >
            Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button type="button" onClick={() => void run(() => deleteConsumption(c.id))}>
            Eliminar
          </button>
        </div>
        {error && <p class="field-error">{error}</p>}
      </li>
    );
  }

  return (
    <li class="spread">
      <span>
        {name}
        <br />
        <span class="muted">
          {formatRefQuantity(c.ref, ingredients)} · {formatKcal(totals.kcal)}
        </span>
      </span>
      <button type="button" onClick={() => setEditing(true)}>
        Editar
      </button>
    </li>
  );
}
