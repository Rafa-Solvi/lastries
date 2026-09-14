// Aviso no modal de deshacer (FR-009).
import { useEffect, useState } from "preact/hooks";
import { getUndo, runUndo, subscribeUndo } from "../../data/store.ts";

export function UndoToast() {
  const [entry, setEntry] = useState(getUndo());
  useEffect(() => subscribeUndo(() => setEntry(getUndo())), []);
  if (!entry) return null;
  return (
    <div class="toast" role="status" aria-live="polite">
      <span>{entry.label}</span>
      <button type="button" onClick={() => void runUndo()}>
        Deshacer
      </button>
    </div>
  );
}
