// Peso corporal con media móvil semanal y medidas corporales (FR-060 – FR-062). Sin valoraciones.
import { useState } from "preact/hooks";
import {
  deleteBodyMeasurement,
  deleteBodyWeight,
  deleteMeasurementType,
  saveMeasurementType,
  setBodyMeasurement,
  setBodyWeight,
} from "../../data/actions/progress.ts";
import { todayLocal, useAppState } from "../../data/store.ts";
import { formatLong } from "../../domain/dates.ts";
import { movingAverage } from "../../domain/bodyweight.ts";
import type { Id } from "../../domain/types.ts";
import { formatNumber, isBodyKg, isCm } from "../../domain/validation.ts";
import { LineChart } from "../components/LineChart.tsx";
import { NumberField } from "../components/NumberField.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";

export function Progress() {
  return (
    <div>
      <TopBar title="Progreso" />
      <WeightSection />
      <MeasurementsSection />
    </div>
  );
}

function WeightSection() {
  const weights = useAppState((s) => s.bodyWeights);
  const [date, setDate] = useState(todayLocal());
  const [kg, setKg] = useState<number | null>(weights.find((w) => w.date === todayLocal())?.kg ?? null);
  const [showAll, setShowAll] = useState(false);
  const { run, error } = useAction();

  const sorted = [...weights].sort((a, b) => (a.date < b.date ? 1 : -1));
  const rows = sorted.map((w) => ({ ...w, avg: movingAverage(weights, w.date)! }));
  const chartRows = [...rows].reverse().slice(-90);

  return (
    <section class="card stack">
      <h2>Peso corporal</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignItems: "end" }}>
        <label>
          Fecha
          <input type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <NumberField label="Peso" suffix="kg" value={kg} onValue={setKg} validate={(v) => (v === null || isBodyKg(v) ? null : "> 0 con 1 decimal")} />
      </div>
      <button type="button" class="primary" disabled={kg === null || !isBodyKg(kg)} onClick={() => void run(() => setBodyWeight(date, kg!))}>
        Guardar peso
      </button>
      {error && <p class="field-error">{error}</p>}
      {rows.length > 0 && (
        <>
          <LineChart
            series={[
              { label: "Media 7 días", points: chartRows.map((r) => ({ date: r.date, value: r.avg })) },
              { label: "Diario", points: chartRows.map((r) => ({ date: r.date, value: r.kg })) },
            ]}
          />
          <table class="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th class="num">Diario</th>
                <th class="num">Media 7 días</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(showAll ? rows : rows.slice(0, 14)).map((r) => (
                <tr key={r.date}>
                  <td>{formatLong(r.date)}</td>
                  <td class="num">{formatNumber(r.kg, 1)}</td>
                  <td class="num">{formatNumber(r.avg, 1)}</td>
                  <td>
                    <button type="button" class="link" aria-label="Eliminar pesaje" onClick={() => void run(() => deleteBodyWeight(r.date))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 14 && (
            <button type="button" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Ver menos" : "Ver todo"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function MeasurementsSection() {
  const types = useAppState((s) => s.measurementTypes);
  const measurements = useAppState((s) => s.bodyMeasurements);
  const sortedTypes = [...types].sort((a, b) => a.order - b.order);
  const [typeId, setTypeId] = useState<Id>(sortedTypes[0]?.id ?? "");
  const [date, setDate] = useState(todayLocal());
  const [cm, setCm] = useState<number | null>(null);
  const [newType, setNewType] = useState("");
  const [editTypes, setEditTypes] = useState(false);
  const { run, error } = useAction();

  const current = typeId || sortedTypes[0]?.id || "";
  const list = measurements.filter((m) => m.typeId === current).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <section class="card stack">
      <h2>Medidas corporales</h2>
      <label>
        Tipo
        <select value={current} onChange={(e) => setTypeId((e.currentTarget as HTMLSelectElement).value)}>
          {sortedTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignItems: "end" }}>
        <label>
          Fecha
          <input type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <NumberField label="Medida" suffix="cm" value={cm} onValue={setCm} validate={(v) => (v === null || isCm(v) ? null : "> 0 con 1 decimal")} />
      </div>
      <button type="button" class="primary" disabled={!current || cm === null || !isCm(cm)} onClick={() => void run(() => setBodyMeasurement(current, date, cm!))}>
        Guardar medida
      </button>
      {list.length > 0 && (
        <>
          <LineChart series={[{ label: "cm", points: [...list].reverse().map((m) => ({ date: m.date, value: m.cm })) }]} />
          <ul class="list">
            {list.map((m) => (
              <li key={m.id} class="spread">
                <span>
                  {formatLong(m.date)} <span class="num">{formatNumber(m.cm, 1)} cm</span>
                </span>
                <button type="button" class="link" aria-label="Eliminar medida" onClick={() => void run(() => deleteBodyMeasurement(m.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" onClick={() => setEditTypes(!editTypes)}>
        {editTypes ? "Cerrar tipos" : "Editar tipos de medida"}
      </button>
      {editTypes && (
        <div class="stack">
          <ul class="list">
            {sortedTypes.map((t) => (
              <li key={t.id} class="spread">
                <span>{t.name}</span>
                <button type="button" onClick={() => void run(() => deleteMeasurementType(t.id))}>
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
          <div class="row-nowrap">
            <input placeholder="Nuevo tipo" value={newType} onInput={(e) => setNewType((e.currentTarget as HTMLInputElement).value)} />
            <button type="button" onClick={() => void run(async () => (await saveMeasurementType(null, newType), setNewType("")))}>
              Añadir
            </button>
          </div>
        </div>
      )}
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}
