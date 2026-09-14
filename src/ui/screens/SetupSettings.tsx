// Importación de configuración inicial en JSON (FR-063).
import { useState } from "preact/hooks";
import { commitSetup, downloadSetupTemplate, prepareSetup } from "../../data/setupImport.ts";
import type { SetupPlan, SetupSection } from "../../domain/setupImport.ts";
import type { Result } from "../../domain/types.ts";
import { useAction } from "../components/useAction.ts";

const LABELS: Record<SetupSection, string> = {
  gruposMusculares: "Grupos musculares",
  ejercicios: "Ejercicios",
  rutinas: "Rutinas",
  ingredientes: "Ingredientes",
  recetas: "Recetas",
  momentos: "Momentos del día",
  objetivos: "Objetivos",
  tiposMedida: "Tipos de medida",
};

export function SetupSettings() {
  const [plan, setPlan] = useState<Result<SetupPlan> | null>(null);
  const [done, setDone] = useState(false);
  const { run, error, busy } = useAction();

  const onFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setDone(false);
    void run(async () => setPlan(await prepareSetup(file)));
  };

  const rows = plan?.ok
    ? (Object.entries(plan.value.summary) as [SetupSection, { creados: number; actualizados: number }][]).filter(
        ([, c]) => c.creados + c.actualizados > 0,
      )
    : [];

  return (
    <section class="card stack">
      <h2>Configuración inicial</h2>
      <p class="muted">
        Un JSON escrito por ti con ejercicios, rutinas, ingredientes, recetas, momentos del día, objetivos y tipos de
        medida, todo por nombre. Crea lo que falta y actualiza lo que ya existe con el mismo nombre; no borra sesiones
        ni registros. Puedes corregir el fichero e importarlo otra vez.
      </p>
      <div class="row">
        <button type="button" onClick={() => void run(() => downloadSetupTemplate())}>
          Descargar plantilla
        </button>
        <label class="btn primary">
          Importar configuración…
          <input type="file" accept=".json,application/json" onChange={onFile} style={{ display: "none" }} />
        </label>
      </div>

      {plan && !plan.ok && (
        <div>
          <p>No se ha aplicado nada. Corrige estos puntos:</p>
          <ul>
            {plan.errors.slice(0, 40).map((e, i) => (
              <li key={i} class="muted">
                {e}
              </li>
            ))}
            {plan.errors.length > 40 && <li class="muted">… y {plan.errors.length - 40} más</li>}
          </ul>
        </div>
      )}

      {plan?.ok && (
        <div class="card stack">
          {rows.length === 0 ? (
            <p>El fichero no contiene cambios.</p>
          ) : (
            <table class="data">
              <thead>
                <tr>
                  <th />
                  <th class="num">Nuevos</th>
                  <th class="num">Actualizados</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([k, c]) => (
                  <tr key={k}>
                    <td>{LABELS[k]}</td>
                    <td class="num">{c.creados}</td>
                    <td class="num">{c.actualizados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {plan.value.deleteMealMoments.length > 0 && (
            <p class="muted">Se quitarán {plan.value.deleteMealMoments.length} momentos del día sin registros que no están en el fichero.</p>
          )}
          {plan.value.warnings.map((w, i) => (
            <p key={i} class="muted">
              {w}
            </p>
          ))}
          <div class="row">
            <button
              type="button"
              class="primary"
              disabled={busy || rows.length === 0}
              onClick={() =>
                void run(async () => {
                  await commitSetup(plan.value);
                  setPlan(null);
                  setDone(true);
                })
              }
            >
              Aplicar
            </button>
            <button type="button" onClick={() => setPlan(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {done && <p>Configuración aplicada.</p>}
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}
