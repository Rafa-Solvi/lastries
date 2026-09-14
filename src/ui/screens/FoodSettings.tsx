// Ajustes de alimentación: objetivos con vigencia y momentos del día (FR-040, FR-044).
import { useState } from "preact/hooks";
import { deleteGoal, deleteMealMoment, saveMealMoment, setGoal } from "../../data/actions/food.ts";
import { todayLocal, useAppState } from "../../data/store.ts";
import { formatLong } from "../../domain/dates.ts";
import { momentRanges } from "../../domain/mealMoment.ts";
import { goalAt } from "../../domain/nutrition.ts";
import type { Goal, Id } from "../../domain/types.ts";
import { formatNumber } from "../../domain/validation.ts";
import { NumberField } from "../components/NumberField.tsx";
import { useAction } from "../components/useAction.ts";

const show = (v: number | null) => (v === null ? "—" : formatNumber(v, 1));

export function GoalsEditor() {
  const goals = useAppState((s) => s.goals);
  const current = goalAt(goals, todayLocal());
  const [form, setForm] = useState<Omit<Goal, "id">>({
    effectiveFrom: todayLocal(),
    kcal: current?.kcal ?? null,
    protein: current?.protein ?? null,
    carbs: current?.carbs ?? null,
    fat: current?.fat ?? null,
  });
  const [saved, setSaved] = useState(false);
  const { run, error } = useAction();
  const sorted = [...goals].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  const field = (k: "kcal" | "protein" | "carbs" | "fat", label: string) => (
    <NumberField
      label={label}
      value={form[k]}
      onValue={(v) => {
        setSaved(false);
        setForm({ ...form, [k]: v });
      }}
    />
  );

  return (
    <section class="card stack">
      <h2>Objetivos diarios</h2>
      <p class="muted">Vacío = sin objetivo para ese valor. Cada cambio se aplica desde la fecha indicada.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {field("kcal", "Calorías")}
        {field("protein", "Proteínas (g)")}
        {field("carbs", "Hidratos (g)")}
        {field("fat", "Grasas (g)")}
      </div>
      <label>
        Desde
        <input type="date" value={form.effectiveFrom} onInput={(e) => setForm({ ...form, effectiveFrom: (e.currentTarget as HTMLInputElement).value })} />
      </label>
      <button
        type="button"
        class="primary"
        onClick={() =>
          void run(async () => {
            await setGoal(form);
            setSaved(true);
          })
        }
      >
        Guardar objetivos
      </button>
      {saved && <p class="muted">Objetivos guardados.</p>}
      {error && <p class="field-error">{error}</p>}
      {sorted.length > 0 && (
        <table class="data">
          <thead>
            <tr>
              <th>Desde</th>
              <th class="num">kcal</th>
              <th class="num">P</th>
              <th class="num">H</th>
              <th class="num">G</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <tr key={g.id}>
                <td>{formatLong(g.effectiveFrom)}</td>
                <td class="num">{show(g.kcal)}</td>
                <td class="num">{show(g.protein)}</td>
                <td class="num">{show(g.carbs)}</td>
                <td class="num">{show(g.fat)}</td>
                <td>
                  <button type="button" class="link" onClick={() => void run(() => deleteGoal(g.id))}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function MealMomentsEditor() {
  const moments = useAppState((s) => s.mealMoments);
  const [editing, setEditing] = useState<{ id: Id | null; name: string; startTime: string } | null>(null);
  const { run, error } = useAction();

  return (
    <section class="card stack">
      <h2>Momentos del día</h2>
      <p class="muted">Lo que registras desde la pantalla principal va al momento cuya franja contiene la hora actual.</p>
      <ul class="list">
        {momentRanges(moments).map(({ moment, from, to }) => (
          <li key={moment.id} class="spread">
            <span>
              {moment.name} <span class="muted num">{from}–{to}</span>
            </span>
            <span class="row-nowrap">
              <button type="button" onClick={() => setEditing({ id: moment.id, name: moment.name, startTime: moment.startTime })}>
                Editar
              </button>
              <button type="button" onClick={() => void run(() => deleteMealMoment(moment.id))}>
                Eliminar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {editing ? (
        <div class="stack">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
            <label>
              Nombre
              <input value={editing.name} onInput={(e) => setEditing({ ...editing, name: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label>
              Empieza
              <input type="time" value={editing.startTime} onInput={(e) => setEditing({ ...editing, startTime: (e.currentTarget as HTMLInputElement).value })} />
            </label>
          </div>
          <div class="row">
            <button
              type="button"
              class="primary"
              onClick={() =>
                void run(async () => {
                  await saveMealMoment(editing.id, editing.name, editing.startTime);
                  setEditing(null);
                })
              }
            >
              Guardar
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing({ id: null, name: "", startTime: "11:00" })}>
          Añadir momento
        </button>
      )}
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}
