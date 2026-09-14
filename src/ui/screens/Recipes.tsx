// Recetas: edición, vista en gramos o medidas caseras y escalado de raciones (FR-035 – FR-038).
import { useMemo, useState } from "preact/hooks";
import { deleteRecipe, saveRecipe, setRecipeArchived } from "../../data/actions/food.ts";
import { useAppState } from "../../data/store.ts";
import { toHousehold } from "../../domain/household.ts";
import { recipeNutrition, scaleNutrition } from "../../domain/nutrition.ts";
import { scaleRecipeLines } from "../../domain/scaling.ts";
import type { Recipe, RecipeLine } from "../../domain/types.ts";
import { formatNumber, isServings, normalizeName } from "../../domain/validation.ts";
import { NumberField } from "../components/NumberField.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { formatAmount, formatKcal, formatMacros, formatServings } from "../format.ts";
import { navigate } from "../router.ts";

export function Recipes() {
  const recipes = useAppState((s) => s.recipes);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const list = useMemo(() => {
    const q = normalizeName(query);
    return recipes
      .filter((r) => r.archived === showArchived && (q === "" || normalizeName(r.name).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [recipes, query, showArchived]);

  return (
    <div>
      <TopBar title="Recetas">
        <a class="btn primary" href="#/recipes/new">
          Nueva
        </a>
      </TopBar>
      <div class="card stack">
        <input type="search" placeholder="Buscar" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
        <label class="row-nowrap">
          <input type="checkbox" checked={showArchived} onChange={() => setShowArchived(!showArchived)} />
          Ver archivadas
        </label>
      </div>
      <ul class="list card">
        {list.map((r) => (
          <li key={r.id}>
            <a href={`#/recipes/${r.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>
              {r.name}
              <br />
              <span class="muted">{formatServings(r.baseServings)} · {r.lines.length} ingredientes</span>
            </a>
          </li>
        ))}
        {list.length === 0 && <li class="muted">Sin recetas.</li>}
      </ul>
    </div>
  );
}

export function RecipeDetail({ params }: { params: Record<string, string> }) {
  const id = params.id!;
  const recipe = useAppState((s) => s.recipes.find((r) => r.id === id) ?? null);
  const [editing, setEditing] = useState(id === "new");

  if (editing || id === "new") {
    return (
      <div>
        <TopBar title={recipe ? "Editar receta" : "Nueva receta"} fallback="/recipes" />
        <RecipeEditor
          recipe={recipe}
          onDone={(saved) => {
            setEditing(false);
            if (!recipe && saved) navigate(`/recipes/${saved.id}`);
            else if (!recipe) navigate("/recipes");
          }}
        />
      </div>
    );
  }
  if (!recipe) {
    return (
      <div>
        <TopBar title="Receta" fallback="/recipes" />
        <p class="muted">No encontrada.</p>
      </div>
    );
  }
  return <RecipeView recipe={recipe} onEdit={() => setEditing(true)} />;
}

function RecipeView({ recipe, onEdit }: { recipe: Recipe; onEdit: () => void }) {
  const ingredients = useAppState((s) => s.ingredients);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const [mode, setMode] = useState<"base" | "household">("base");
  const [servings, setServings] = useState<number | null>(recipe.baseServings);
  const { run, error } = useAction();

  const target = servings !== null && isServings(servings) ? servings : recipe.baseServings;
  const lines = scaleRecipeLines(recipe, target);
  const { perServing } = recipeNutrition(recipe, byId);
  const total = scaleNutrition(perServing, target);

  return (
    <div>
      <TopBar title={recipe.name} fallback="/recipes" />
      <div class="card stack">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignItems: "end" }}>
          <NumberField label={`Raciones (base ${formatNumber(recipe.baseServings, 2)})`} value={servings} onValue={setServings} />
          <div class="row-nowrap" role="radiogroup" aria-label="Unidades">
            <button type="button" class={mode === "base" ? "selected" : undefined} onClick={() => setMode("base")}>
              Gramos
            </button>
            <button type="button" class={mode === "household" ? "selected" : undefined} onClick={() => setMode("household")}>
              Caseras
            </button>
          </div>
        </div>
        <ul class="list">
          {lines.map((l, i) => {
            const ing = byId.get(l.ingredientId);
            const unit = ing?.baseUnit ?? "g";
            const shown = mode === "base" ? formatAmount(l.amount, unit) : toHousehold(l.amount, unit, ing?.householdMeasures ?? []).text;
            return (
              <li key={i} class="spread">
                <span>{ing?.name ?? "?"}</span>
                <span class="num">{shown}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {recipe.steps.length > 0 && (
        <div class="card">
          <h2>Preparación</h2>
          <ol>
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      <div class="card stack">
        <h2>Nutrición</h2>
        <p>
          Por ración: {formatKcal(perServing.kcal)} · {formatMacros(perServing)}
        </p>
        <p>
          Total ({formatServings(target)}): {formatKcal(total.kcal)} · {formatMacros(total)}
        </p>
      </div>
      {error && <p class="field-error">{error}</p>}
      <div class="row">
        <button type="button" class="primary" onClick={onEdit}>
          Editar
        </button>
        <button type="button" onClick={() => void run(() => setRecipeArchived(recipe.id, !recipe.archived))}>
          {recipe.archived ? "Desarchivar" : "Archivar"}
        </button>
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              await deleteRecipe(recipe.id);
              navigate("/recipes");
            })
          }
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function RecipeEditor({ recipe, onDone }: { recipe: Recipe | null; onDone: (saved: Recipe | null) => void }) {
  const ingredients = useAppState((s) => s.ingredients);
  const sortedIngredients = [...ingredients].filter((i) => !i.archived).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const [name, setName] = useState(recipe?.name ?? "");
  const [baseServings, setBaseServings] = useState<number | null>(recipe?.baseServings ?? 2);
  const [lines, setLines] = useState<{ ingredientId: string; amount: number | null }[]>(recipe?.lines ?? []);
  const [steps, setSteps] = useState((recipe?.steps ?? []).join("\n"));
  const { run, error } = useAction();

  const unitOf = (id: string) => ingredients.find((i) => i.id === id)?.baseUnit ?? "g";

  return (
    <div class="stack">
      <div class="card stack">
        <label>
          Nombre
          <input value={name} maxLength={120} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <NumberField label="Raciones base" value={baseServings} onValue={setBaseServings} />
      </div>
      <div class="card stack">
        <h3>Ingredientes</h3>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "6px", alignItems: "end" }}>
            <label>
              Ingrediente
              <select
                value={l.ingredientId}
                onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, ingredientId: (e.currentTarget as HTMLSelectElement).value } : x)))}
              >
                {!ingredients.some((g) => g.id === l.ingredientId) && <option value="">Elegir…</option>}
                {sortedIngredients.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="Cantidad"
              suffix={unitOf(l.ingredientId)}
              value={l.amount}
              onValue={(amount) => setLines(lines.map((x, k) => (k === i ? { ...x, amount } : x)))}
            />
            <button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))}>
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={sortedIngredients.length === 0}
          onClick={() => setLines([...lines, { ingredientId: sortedIngredients[0]?.id ?? "", amount: null }])}
        >
          Añadir ingrediente
        </button>
        {sortedIngredients.length === 0 && (
          <p class="muted">
            Primero crea ingredientes en <a href="#/ingredients">Ingredientes</a>.
          </p>
        )}
      </div>
      <div class="card">
        <label>
          Pasos (uno por línea)
          <textarea value={steps} onInput={(e) => setSteps((e.currentTarget as HTMLTextAreaElement).value)} />
        </label>
      </div>
      {error && <p class="field-error">{error}</p>}
      <div class="row">
        <button
          type="button"
          class="primary"
          onClick={() =>
            void run(async () => {
              const saved = await saveRecipe(recipe?.id ?? null, {
                name,
                baseServings: baseServings ?? 0,
                lines: lines.map((l) => ({ ingredientId: l.ingredientId, amount: l.amount ?? 0 }) as RecipeLine),
                steps: steps.split("\n"),
              });
              onDone(saved);
            })
          }
        >
          Guardar
        </button>
        <button type="button" onClick={() => onDone(null)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
