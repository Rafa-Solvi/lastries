// Ingredientes: alta, edición, archivo e importación CSV (FR-030 – FR-033).
import { useMemo, useState } from "preact/hooks";
import {
  deleteIngredient,
  importIngredients,
  saveIngredient,
  setIngredientArchived,
  type IngredientForm,
} from "../../data/actions/food.ts";
import { useAppState } from "../../data/store.ts";
import type { Ingredient } from "../../domain/types.ts";
import { normalizeName } from "../../domain/validation.ts";
import { formatMacros } from "../format.ts";
import { NumberField } from "../components/NumberField.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { HouseholdMeasuresEditor } from "./HouseholdMeasuresEditor.tsx";

export function Ingredients() {
  const ingredients = useAppState((s) => s.ingredients);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);

  const list = useMemo(() => {
    const q = normalizeName(query);
    return ingredients
      .filter((i) => i.archived === showArchived && (q === "" || normalizeName(i.name).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [ingredients, query, showArchived]);

  if (editing) {
    return (
      <div>
        <TopBar title={editing === "new" ? "Nuevo ingrediente" : "Editar ingrediente"} fallback="/ingredients" />
        <IngredientEditor ingredient={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Ingredientes">
        <button type="button" class="primary" onClick={() => setEditing("new")}>
          Nuevo
        </button>
      </TopBar>
      <div class="card stack">
        <input type="search" placeholder="Buscar" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
        <label class="row-nowrap">
          <input type="checkbox" checked={showArchived} onChange={() => setShowArchived(!showArchived)} />
          Ver archivados
        </label>
      </div>
      <ul class="list card">
        {list.map((i) => (
          <li key={i.id}>
            <button type="button" class="link" style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }} onClick={() => setEditing(i)}>
              <span style={{ color: "var(--text)" }}>
                {i.name}
                <br />
                <span class="muted">
                  {i.per100.kcal} kcal/100 {i.baseUnit} · {formatMacros(i.per100)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li class="muted">Sin ingredientes.</li>}
      </ul>
      <CsvImport />
    </div>
  );
}

function CsvImport() {
  const [result, setResult] = useState<{ ok: true; count: number } | { ok: false; errors: string[] } | null>(null);
  const { run, error } = useAction();
  const onFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    void run(async () => setResult(await importIngredients(await file.text())));
  };
  return (
    <div class="card stack">
      <h2>Importar CSV</h2>
      <p class="muted">
        Columnas: nombre, unidad_base, kcal, proteinas, hidratos, grasas, seccion, formato_compra, formato_equivalencia.
        Valores por 100 g o 100 ml. Si alguna fila tiene errores no se importa ninguna.
      </p>
      <label class="btn">
        Elegir fichero CSV
        <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
      </label>
      {error && <p class="field-error">{error}</p>}
      {result?.ok && <p>Ingredientes creados: {result.count}</p>}
      {result && !result.ok && (
        <div>
          <p>No se ha importado nada. Errores:</p>
          <ul>
            {result.errors.map((e, i) => (
              <li key={i} class="muted">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function IngredientEditor({ ingredient, onDone }: { ingredient: Ingredient | null; onDone: () => void }) {
  const [form, setForm] = useState<IngredientForm>({
    name: ingredient?.name ?? "",
    baseUnit: ingredient?.baseUnit ?? "g",
    per100: ingredient?.per100 ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    section: ingredient?.section ?? "",
    purchaseFormat: ingredient?.purchaseFormat ?? null,
  });
  const [formatName, setFormatName] = useState(ingredient?.purchaseFormat?.name ?? "");
  const [formatAmount, setFormatAmount] = useState<number | null>(ingredient?.purchaseFormat?.amount ?? null);
  const { run, error } = useAction();
  const current = useAppState((s) => (ingredient ? s.ingredients.find((i) => i.id === ingredient.id) ?? null : null));

  const nutrient = (key: keyof IngredientForm["per100"], label: string) => (
    <NumberField label={label} value={form.per100[key]} onValue={(v) => setForm({ ...form, per100: { ...form.per100, [key]: v ?? 0 } })} />
  );

  const save = () =>
    void run(async () => {
      const purchaseFormat = formatName.trim() || formatAmount !== null ? { name: formatName, amount: formatAmount ?? 0 } : null;
      await saveIngredient(ingredient?.id ?? null, { ...form, purchaseFormat });
      onDone();
    });

  return (
    <div class="stack">
      <div class="card stack">
        <label>
          Nombre
          <input value={form.name} maxLength={80} onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })} />
        </label>
        <label>
          Unidad base
          <select value={form.baseUnit} onChange={(e) => setForm({ ...form, baseUnit: (e.currentTarget as HTMLSelectElement).value as "g" | "ml" })}>
            <option value="g">gramos (g)</option>
            <option value="ml">mililitros (ml)</option>
          </select>
        </label>
      </div>
      <div class="card stack">
        <h3>Por cada 100 {form.baseUnit}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {nutrient("kcal", "Calorías")}
          {nutrient("protein", "Proteínas (g)")}
          {nutrient("carbs", "Hidratos (g)")}
          {nutrient("fat", "Grasas (g)")}
        </div>
      </div>
      <div class="card stack">
        <label>
          Sección del supermercado
          <input value={form.section ?? ""} onInput={(e) => setForm({ ...form, section: (e.currentTarget as HTMLInputElement).value })} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <label>
            Formato de compra
            <input placeholder="bandeja, bote…" value={formatName} onInput={(e) => setFormatName((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <NumberField label="Equivale a" suffix={form.baseUnit} value={formatAmount} onValue={setFormatAmount} />
        </div>
      </div>
      {error && <p class="field-error">{error}</p>}
      <div class="row">
        <button type="button" class="primary" onClick={save}>
          Guardar
        </button>
        <button type="button" onClick={onDone}>
          Cancelar
        </button>
        {ingredient && current && (
          <>
            <button type="button" onClick={() => void run(async () => (await setIngredientArchived(ingredient.id, !current.archived), onDone()))}>
              {current.archived ? "Desarchivar" : "Archivar"}
            </button>
            <button type="button" onClick={() => void run(async () => (await deleteIngredient(ingredient.id), onDone()))}>
              Eliminar
            </button>
          </>
        )}
      </div>
      {current && <HouseholdMeasuresEditor ingredient={current} />}
    </div>
  );
}
