// Campo numérico que acepta coma decimal y notifica en cada pulsación.
import { useEffect, useRef, useState } from "preact/hooks";
import { parseUserNumber } from "../../domain/validation.ts";

interface Props {
  label?: string;
  value: number | null;
  onValue: (v: number | null) => void;
  /** Devuelve el motivo si el valor no es válido. */
  validate?: (v: number | null) => string | null;
  isDraft?: boolean;
  suffix?: string;
  integer?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}

const toText = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

export function NumberField(props: Props) {
  const { label, value, onValue, validate, isDraft, suffix, integer, placeholder, autoFocus, ariaLabel } = props;
  // Campo no controlado: el DOM conserva lo tecleado y solo se sobrescribe cuando el valor
  // cambia desde fuera (p. ej. otra serie precargada). Evita perder pulsaciones al re-renderizar.
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const lastEmitted = useRef<number | null>(value);

  useEffect(() => {
    if (!Object.is(value, lastEmitted.current)) {
      if (inputRef.current) inputRef.current.value = toText(value);
      setError(null);
      lastEmitted.current = value;
    }
  }, [value]);

  const onInput = (e: Event) => {
    const t = (e.currentTarget as HTMLInputElement).value;
    const n = parseUserNumber(t);
    if (n !== null && Number.isNaN(n)) {
      setError("Número no válido");
      return;
    }
    if (integer && n !== null && !Number.isInteger(n)) {
      setError("Debe ser un número entero");
      return;
    }
    const reason = validate ? validate(n) : null;
    setError(reason);
    if (reason) return;
    lastEmitted.current = n;
    onValue(n);
  };

  const input = (
    <span class="row-nowrap" style={{ width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        defaultValue={toText(value)}
        onInput={onInput}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? label}
        class={isDraft ? "is-draft" : undefined}
      />
      {suffix && <span class="muted">{suffix}</span>}
    </span>
  );

  return (
    <div>
      {label ? (
        <label>
          {label} {isDraft && <span class="draft-mark">sin confirmar</span>}
          {input}
        </label>
      ) : (
        input
      )}
      {error && <div class="field-error">{error}</div>}
    </div>
  );
}
