// Plan de comidas semanal (FR-037, FR-039, FR-041).
import { useState } from "preact/hooks";
import { refName } from "../../data/actions/food.ts";
import { addPlannedItem, copyPlannedDay, deletePlannedItem, markPlannedEaten } from "../../data/actions/planning.ts";
import { todayLocal, useAppState } from "../../data/store.ts";
import { addDays, formatShort, weekStart } from "../../domain/dates.ts";
import { sortMoments } from "../../domain/mealMoment.ts";
import type { Id, LocalDate } from "../../domain/types.ts";
import { FoodPicker } from "../components/FoodPicker.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { formatRefQuantity } from "../format.ts";

export function MealPlan() {
  const [week, setWeek] = useState(weekStart(todayLocal()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  return (
    <div>
      <TopBar title="Plan de comidas" />
      <div class="card spread">
        <button type="button" aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))}>
          ←
        </button>
        <strong>
          {formatShort(week)} – {formatShort(addDays(week, 6))}
        </strong>
        <button type="button" aria-label="Semana siguiente" onClick={() => setWeek(addDays(week, 7))}>
          →
        </button>
      </div>
      <p class="row">
        <a class="btn" href="#/shopping">
          Lista de la compra
        </a>
      </p>
      {days.map((d) => (
        <PlanDay key={d} date={d} />
      ))}
    </div>
  );
}

function PlanDay({ date }: { date: LocalDate }) {
  const moments = useAppState((s) => s.mealMoments);
  const planned = useAppState((s) => s.plannedItems);
  const consumptions = useAppState((s) => s.consumptions);
  const ingredients = useAppState((s) => s.ingredients);
  const [adding, setAdding] = useState<Id | null>(null);
  const [copyTo, setCopyTo] = useState(addDays(date, 7));
  const { run, error } = useAction();
  const items = planned.filter((p) => p.date === date);
  const isToday = date === todayLocal();

  return (
    <section class="card stack">
      <div class="spread">
        <h2>
          {formatShort(date)}
          {isToday && <span class="chip"> hoy</span>}
        </h2>
      </div>
      {sortMoments(moments).map((m) => {
        const list = items
          .filter((p) => p.momentId === m.id)
          .sort((a, b) => refName(a.ref).localeCompare(refName(b.ref), "es"));
        return (
          <div key={m.id} class="stack">
            <div class="spread">
              <strong>{m.name}</strong>
              <button type="button" onClick={() => setAdding(adding === m.id ? null : m.id)}>
                Planificar
              </button>
            </div>
            {adding === m.id && (
              <FoodPicker
                confirmLabel="Planificar"
                onCancel={() => setAdding(null)}
                onPick={(ref) =>
                  void run(async () => {
                    await addPlannedItem({ date, momentId: m.id, ref });
                    setAdding(null);
                  })
                }
              />
            )}
            <ul class="list">
              {list.map((p) => {
                const eaten = consumptions.some((c) => c.plannedItemId === p.id);
                return (
                  <li key={p.id} class="spread">
                    <span>
                      {refName(p.ref)}
                      <br />
                      <span class="muted">
                        {formatRefQuantity(p.ref, ingredients)}
                        {eaten && " · comido"}
                      </span>
                    </span>
                    <span class="row-nowrap">
                      {!eaten && (
                        <button type="button" class="primary" onClick={() => void run(() => markPlannedEaten(p.id))}>
                          Comido
                        </button>
                      )}
                      <button type="button" aria-label="Quitar del plan" onClick={() => void run(() => deletePlannedItem(p.id))}>
                        ✕
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {items.length > 0 && (
        <div class="row-nowrap">
          <input type="date" value={copyTo} onInput={(e) => setCopyTo((e.currentTarget as HTMLInputElement).value)} />
          <button type="button" onClick={() => void run(() => copyPlannedDay(date, copyTo))}>
            Copiar día
          </button>
        </div>
      )}
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}
