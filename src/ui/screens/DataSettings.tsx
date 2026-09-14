// Exportación e importación de todos los datos (FR-003, FR-004).
import { useState } from "preact/hooks";
import { commitImport, exportData, prepareImport, type PreparedImport } from "../../data/exportImport.ts";
import { useAction } from "../components/useAction.ts";

export function DataSettings() {
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { run, error, busy } = useAction();

  const onFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setDone(null);
    void run(async () => setPrepared(await prepareImport(file)));
  };

  return (
    <section class="card stack">
      <h2>Datos</h2>
      <p class="muted">
        La exportación completa es un ZIP con <code>lastries.json</code> y tus imágenes de demostración. La de solo
        datos es el mismo JSON sin imágenes.
      </p>
      <div class="row">
        <button type="button" class="primary" disabled={busy} onClick={() => void run(() => exportData("full"))}>
          Exportar todo (con imágenes)
        </button>
        <button type="button" disabled={busy} onClick={() => void run(() => exportData("data"))}>
          Exportar solo datos
        </button>
      </div>

      <label class="btn">
        Importar…
        <input type="file" accept=".zip,.json,application/zip,application/json" onChange={onFile} style={{ display: "none" }} />
      </label>

      {prepared && !prepared.ok && (
        <div>
          <p>No se ha importado nada. Motivos:</p>
          <ul>
            {prepared.errors.slice(0, 30).map((e, i) => (
              <li key={i} class="muted">
                {e}
              </li>
            ))}
            {prepared.errors.length > 30 && <li class="muted">… y {prepared.errors.length - 30} más</li>}
          </ul>
        </div>
      )}

      {prepared?.ok && (
        <div class="card stack">
          <p>
            El fichero contiene {prepared.summary.sessions} sesiones ({prepared.summary.sets} series),{" "}
            {prepared.summary.consumptions} consumos, {prepared.summary.ingredients} ingredientes, {prepared.summary.recipes}{" "}
            recetas y {prepared.summary.bodyWeights} pesajes.
          </p>
          {prepared.missingMedia > 0 && (
            <p class="muted">
              {prepared.missingMedia} demostraciones propias no están en el fichero; esos ejercicios quedarán sin
              demostración.
            </p>
          )}
          <p>
            <strong>Se sustituirán todos los datos actuales.</strong>
          </p>
          <div class="row">
            <button
              type="button"
              class="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await commitImport(prepared);
                  setPrepared(null);
                  setDone("Importación completada.");
                })
              }
            >
              Importar
            </button>
            <button type="button" onClick={() => setPrepared(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {done && <p>{done}</p>}
      {error && <p class="field-error">{error}</p>}
    </section>
  );
}
