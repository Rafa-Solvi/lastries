// Lista de la compra (FR-050 – FR-055).
import { useState } from "preact/hooks";
import {
  addManualLine,
  deleteManualLine,
  generateShoppingList,
  togglePurchased,
} from "../../data/actions/planning.ts";
import { todayLocal, useAppState } from "../../data/store.ts";
import { addDays, formatShort, weekStart } from "../../domain/dates.ts";
import { pluralize } from "../../domain/household.ts";
import { groupBySection } from "../../domain/shopping.ts";
import type { GeneratedLine, Ingredient } from "../../domain/types.ts";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { formatAmount } from "../format.ts";

function lineText(line: GeneratedLine, ing: Ingredient | undefined): string {
  const unit = ing?.baseUnit ?? "g";
  const amount = formatAmount(line.requiredAmount, unit);
  if (line.packs !== null && ing?.purchaseFormat) {
    const name = line.packs === 1 ? ing.purchaseFormat.name : pluralize(ing.purchaseFormat.name);
    return `${line.packs} ${name} · ${amount}`;
  }
  return amount;
}

export function ShoppingList() {
  const list = useAppState((s) => s.shoppingList);
  const ingredients = useAppState((s) => s.ingredients);
  const monday = weekStart(todayLocal());
  const [from, setFrom] = useState(list?.generatedLines.length ? list.from : monday);
  const [to, setTo] = useState(list?.generatedLines.length ? list.to : addDays(monday, 6));
  const [text, setText] = useState("");
  const [quantity, setQuantity] = useState("");
  const { run, error } = useAction();

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const groups = list ? groupBySection(list.generatedLines, byId) : [];

  return (
    <div>
      <TopBar title="Lista de la compra" />
      <div class="card stack">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <label>
            Desde
            <input type="date" value={from} onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
        <button type="button" class="primary" onClick={() => void run(() => generateShoppingList(from, to))}>
          Generar desde el plan
        </button>
        {list && list.generatedLines.length > 0 && (
          <p class="muted">
            Lista del plan del {formatShort(list.from)} al {formatShort(list.to)}. Al regenerar se conservan las líneas
            manuales y las marcas de comprado.
          </p>
        )}
      </div>

      {groups.map((g) => (
        <section key={g.section} class="card">
          <h2>{g.section}</h2>
          <ul class="list">
            {g.lines.map((l) => {
              const ing = byId.get(l.ingredientId);
              return (
                <li key={l.ingredientId}>
                  <label class="row-nowrap" style={{ color: "var(--text)", fontSize: "1rem" }}>
                    <input type="checkbox" checked={l.purchased} onChange={() => void run(() => togglePurchased({ ingredientId: l.ingredientId }))} />
                    <span style={{ flex: 1, textDecoration: l.purchased ? "line-through" : undefined }}>{ing?.name ?? "?"}</span>
                    <span class="num muted">{lineText(l, ing)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section class="card stack">
        <h2>Otros</h2>
        <ul class="list">
          {(list?.manualLines ?? []).map((m) => (
            <li key={m.id} class="spread">
              <label class="row-nowrap" style={{ color: "var(--text)", fontSize: "1rem", flex: 1 }}>
                <input type="checkbox" checked={m.purchased} onChange={() => void run(() => togglePurchased({ manualId: m.id }))} />
                <span style={{ textDecoration: m.purchased ? "line-through" : undefined }}>
                  {m.text}
                  {m.quantity && <span class="muted"> · {m.quantity}</span>}
                </span>
              </label>
              <button type="button" aria-label="Eliminar línea" onClick={() => void run(() => deleteManualLine(m.id))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "6px" }}>
          <input placeholder="Añadir línea" value={text} maxLength={120} onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} />
          <input placeholder="Cantidad" value={quantity} onInput={(e) => setQuantity((e.currentTarget as HTMLInputElement).value)} />
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await addManualLine(text, quantity || null);
                setText("");
                setQuantity("");
              })
            }
          >
            Añadir
          </button>
        </div>
      </section>
      {error && <p class="field-error">{error}</p>}
    </div>
  );
}
