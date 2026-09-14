// Selector de RIR: 0 1 2 3 4 5 Fallo en una fila, sin desplazamiento (FR-019, research R11).

interface Props {
  rir: number | null;
  failure: boolean;
  onChange: (v: { rir: number; failure: boolean }) => void;
  isDraft?: boolean;
}

const VALUES = [0, 1, 2, 3, 4, 5];

export function RirSelector({ rir, failure, onChange, isDraft }: Props) {
  const extra = !failure && rir !== null && rir > 5 ? rir : null;
  return (
    <div>
      <div class="spread">
        <span class="muted">RIR</span>
        {isDraft && <span class="draft-mark">sin confirmar</span>}
      </div>
      <div class="rir-selector" role="radiogroup" aria-label="RIR">
        {VALUES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={!failure && rir === v}
            class={!failure && rir === v ? "selected" : undefined}
            onClick={() => onChange({ rir: v, failure: false })}
          >
            {v}
          </button>
        ))}
        {extra !== null && (
          <button type="button" role="radio" aria-checked class="selected" onClick={() => onChange({ rir: extra, failure: false })}>
            {extra}
          </button>
        )}
        <button
          type="button"
          role="radio"
          aria-checked={failure}
          class={failure ? "selected" : undefined}
          onClick={() => onChange({ rir: 0, failure: true })}
        >
          Fallo
        </button>
      </div>
    </div>
  );
}
