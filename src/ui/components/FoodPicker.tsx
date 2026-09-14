// Selección de ingrediente o receta con cantidad precargada con la última usada.
import { useMemo, useState } from "preact/hooks";
import { useAppState } from "../../data/store.ts";
import { refKey } from "../../domain/nutrition.ts";
import type { FoodRef } from "../../domain/types.ts";
import { isAmount, isServings, normalizeName } from "../../domain/validation.ts";
import { NumberField } from "./NumberField.tsx";

interface Props {
  onPick: (ref: FoodRef) => void;
  onCancel?: () => void;
  confirmLabel?: string;
}

type Choice = { type: "ingredient"; id: string; name: string; unit: "g" | "ml" } | { type: "recipe"; id: string; name: string };

export function FoodPicker({ onPick, onCancel, confirmLabel = "Añadir" }: Props) {
  const ingredients = useAppState((s) => s.ingredients);
  const recipes = useAppState((s) => s.recipes);
  const consumptions = useAppState((s) => s.consumptions);
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [quantity, setQuantity] = useState<number | null>(null);

  const lastRef = useMemo(() => {
    const m = new Map<string, { at: string; ref: FoodRef }>();
    for (const c of consumptions) {
      const k = refKey(c.ref);
      const cur = m.get(k);
      if (!cur || c.createdAt > cur.at) m.set(k, { at: c.createdAt, ref: c.ref });
    }
    return m;
  }, [consumptions]);

  const results = useMemo(() => {
    const q = normalizeName(query);
    const list: Choice[] = [
      ...ingredients.filter((i) => !i.archived).map((i) => ({ type: "ingredient" as const, id: i.id, name: i.name, unit: i.baseUnit })),
      ...recipes.filter((r) => !r.archived).map((r) => ({ type: "recipe" as const, id: r.id, name: r.name })),
    ].filter((c) => q === "" || normalizeName(c.name).includes(q));
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list.slice(0, 40);
  }, [ingredients, recipes, query]);

  const select = (c: Choice) => {
    setChoice(c);
    const last = lastRef.get(c.type === "ingredient" ? `i:${c.id}` : `r:${c.id}`)?.ref;
    if (c.type === "ingredient") setQuantity(last?.type === "ingredient" ? last.amount : 100);
    else setQuantity(last?.type === "recipe" ? last.servings : 1);
  };

  if (choice) {
    const valid = quantity !== null && (choice.type === "ingredient" ? isAmount(quantity) : isServings(quantity));
    return (
      <div class="card stack">
        <strong>{choice.name}</strong>
        <NumberField
          label={choice.type === "ingredient" ? "Cantidad" : "Raciones"}
          suffix={choice.type === "ingredient" ? choice.unit : undefined}
          value={quantity}
          onValue={setQuantity}
          autoFocus
        />
        <div class="row">
          <button
            type="button"
            class="primary"
            disabled={!valid}
            onClick={() =>
              onPick(
                choice.type === "ingredient"
                  ? { type: "ingredient", ingredientId: choice.id, amount: quantity! }
                  : { type: "recipe", recipeId: choice.id, servings: quantity! },
              )
            }
          >
            {confirmLabel}
          </button>
          <button type="button" onClick={() => setChoice(null)}>
            Cambiar
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="card stack">
      <div class="row-nowrap">
        <input
          type="search"
          placeholder="Buscar ingrediente o receta"
          value={query}
          autoFocus
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cerrar
          </button>
        )}
      </div>
      <ul class="list">
        {results.map((c) => (
          <li key={`${c.type}:${c.id}`}>
            <button type="button" class="link" style={{ width: "100%", justifyContent: "space-between" }} onClick={() => select(c)}>
              <span style={{ color: "var(--text)" }}>{c.name}</span>
              <span class="muted">{c.type === "recipe" ? "receta" : c.unit}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li class="muted">
            Sin resultados. <a href="#/ingredients">Crear ingrediente</a>
          </li>
        )}
      </ul>
    </div>
  );
}
