// Ajustes: versión, persistencia y última exportación (base); el resto de secciones se añaden por historia.
import { useEffect, useState } from "preact/hooks";
import { useAppState } from "../../data/store.ts";
import { activateWaiting, getSwVersions, type SwVersions } from "../../data/swUpdates.ts";
import { datePart, formatLong, timePart } from "../../domain/dates.ts";
import { TopBar } from "../components/TopBar.tsx";
import { DataSettings } from "./DataSettings.tsx";
import { GoalsEditor, MealMomentsEditor } from "./FoodSettings.tsx";

function AppStatus() {
  const meta = useAppState((s) => s.meta);
  const sessionInProgress = useAppState((s) => s.sessions.some((x) => x.endedAt === null));
  const [versions, setVersions] = useState<SwVersions>({ active: null, waiting: null });

  useEffect(() => {
    void getSwVersions().then(setVersions);
  }, []);

  return (
    <section class="card stack">
      <h2>App</h2>
      <p>
        Versión {__APP_VERSION__}
        {versions.active && <span class="muted"> · build {versions.active}</span>}
      </p>
      {versions.waiting && (
        <div class="stack">
          <p>Hay una versión nueva descargada (build {versions.waiting}). Se aplicará en el próximo arranque.</p>
          <button type="button" disabled={sessionInProgress} onClick={() => void activateWaiting()}>
            Aplicar ahora
          </button>
          {sessionInProgress && <p class="muted">Disponible cuando no haya una sesión en curso.</p>}
        </div>
      )}
      <p>
        Almacenamiento persistente:{" "}
        {meta.persistGranted === null ? "sin comprobar" : meta.persistGranted ? "sí" : "no concedido por el navegador"}
      </p>
      <p>
        Última exportación:{" "}
        {meta.lastExportAt ? `${formatLong(datePart(meta.lastExportAt))} ${timePart(meta.lastExportAt)}` : "nunca"}
      </p>
    </section>
  );
}

export function Settings() {
  return (
    <div>
      <TopBar title="Ajustes" />
      <GoalsEditor />
      <MealMomentsEditor />
      <DataSettings />
      <AppStatus />
    </div>
  );
}
