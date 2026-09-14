// Arranque bloqueado por una migración de datos fallida (research R14).
import { deliverFile } from "../../data/exportImport.ts";
import { toLocalDate } from "../../domain/dates.ts";

export function MigrationError({ reason, backupDocument }: { reason: string; backupDocument: string | null }) {
  const exportBackup = () => {
    if (!backupDocument) return;
    const blob = new Blob([backupDocument], { type: "application/json" });
    void deliverFile(blob, `lastries-copia-previa-${toLocalDate(new Date())}.json`);
  };
  return (
    <div class="card stack">
      <h1>No se han podido abrir los datos</h1>
      <p style={{ whiteSpace: "pre-wrap" }}>{reason}</p>
      <p class="muted">
        Tus datos guardados siguen como estaban. Puedes exportar una copia del documento previo para
        conservar el histórico e importarlo más adelante.
      </p>
      <button type="button" class="primary" disabled={!backupDocument} onClick={exportBackup}>
        Exportar copia previa
      </button>
    </div>
  );
}
