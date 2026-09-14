// Editor de una serie: peso, repeticiones, RIR y calentamiento.
import type { PendingSet } from "../../domain/prefill.ts";
import { isReps, isWeightKg } from "../../domain/validation.ts";
import { NumberField } from "./NumberField.tsx";
import { RirSelector } from "./RirSelector.tsx";

export type EditableSet = Omit<PendingSet, "isDraft">;

interface Props {
  value: EditableSet;
  isDraft?: boolean;
  onChange: (next: EditableSet) => void;
}

export function SetEditor({ value, isDraft, onChange }: Props) {
  return (
    <div class="stack">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <NumberField
          label="Peso"
          suffix="kg"
          value={value.weightKg}
          isDraft={isDraft}
          validate={(v) => (v === null || isWeightKg(v) ? null : "≥ 0, hasta 2 decimales")}
          onValue={(weightKg) => onChange({ ...value, weightKg })}
        />
        <NumberField
          label="Repeticiones"
          integer
          value={value.reps}
          isDraft={isDraft}
          validate={(v) => (v === null || isReps(v) ? null : "Entero ≥ 0")}
          onValue={(reps) => onChange({ ...value, reps })}
        />
      </div>
      <RirSelector rir={value.rir} failure={value.failure} onChange={(r) => onChange({ ...value, ...r })} />
      <label class="row-nowrap">
        <input type="checkbox" checked={value.warmup} onChange={() => onChange({ ...value, warmup: !value.warmup })} />
        Serie de calentamiento
      </label>
    </div>
  );
}
