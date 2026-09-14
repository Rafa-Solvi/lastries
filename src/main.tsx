import { render, type ComponentType } from "preact";
import { getDB, loadAll, startupMigrate } from "./data/db.ts";
import { commitMeta, getState, setState } from "./data/store.ts";
import { registerServiceWorker } from "./data/swUpdates.ts";
import { UndoToast } from "./ui/components/UndoToast.tsx";
import { useRoute, type RoutePattern } from "./ui/router.ts";
import { seedMealMoments } from "./data/actions/food.ts";
import { seedCatalog } from "./data/catalogSeed.ts";
import { DayLog } from "./ui/screens/DayLog.tsx";
import { ExerciseHistory } from "./ui/screens/ExerciseHistory.tsx";
import { WeeklyVolume } from "./ui/screens/WeeklyVolume.tsx";
import { Ingredients } from "./ui/screens/Ingredients.tsx";
import { seedMeasurementTypes } from "./data/actions/progress.ts";
import { MealPlan } from "./ui/screens/MealPlan.tsx";
import { Progress } from "./ui/screens/Progress.tsx";
import { RecipeDetail, Recipes } from "./ui/screens/Recipes.tsx";
import { ShoppingList } from "./ui/screens/ShoppingList.tsx";
import { ExerciseDetail, Exercises } from "./ui/screens/Exercises.tsx";
import { Home } from "./ui/screens/Home.tsx";
import { MigrationError } from "./ui/screens/MigrationError.tsx";
import { Routines } from "./ui/screens/Routines.tsx";
import { Session } from "./ui/screens/Session.tsx";
import { Settings } from "./ui/screens/Settings.tsx";
import "./ui/styles.css";

type Screen = ComponentType<{ params: Record<string, string> }>;

const SCREENS: Partial<Record<RoutePattern, Screen>> = {
  "/": Home,
  "/session": Session,
  "/exercises": Exercises,
  "/exercises/:id": ExerciseDetail,
  "/routines": Routines,
  "/history/:exerciseId": ExerciseHistory,
  "/volume": WeeklyVolume,
  "/ingredients": Ingredients,
  "/recipes": Recipes,
  "/recipes/:id": RecipeDetail,
  "/plan": MealPlan,
  "/shopping": ShoppingList,
  "/progress": Progress,
  "/day/:date": DayLog,
  "/settings": Settings,
};

function App() {
  const route = useRoute();
  const Screen = (route.pattern && SCREENS[route.pattern]) || Home;
  return (
    <>
      <Screen key={route.path} params={route.params} />
      <UndoToast />
    </>
  );
}

/** Primer arranque: pide almacenamiento persistente (research R4). No bloquea el render. */
async function requestPersistence(): Promise<void> {
  if (getState().meta.persistGranted !== null || !navigator.storage?.persist) return;
  const granted = await navigator.storage.persist();
  await commitMeta({ persistGranted: granted });
}

async function boot() {
  const root = document.getElementById("app")!;
  const db = await getDB();
  const migration = await startupMigrate(db, __APP_VERSION__);
  if (!migration.ok) {
    render(<MigrationError reason={migration.reason} backupDocument={migration.backupDocument} />, root);
    return;
  }
  setState(await loadAll(db));
  await seedCatalog();
  await seedMealMoments();
  await seedMeasurementTypes();
  render(<App />, root);
  void requestPersistence();
  void registerServiceWorker();
}

void boot();
