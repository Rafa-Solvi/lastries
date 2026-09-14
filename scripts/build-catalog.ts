// Script puntual: free-exercise-db → public/catalog (research R6).
// Uso: npm run catalog   (requiere red; el build normal no la usa)
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const SOURCE_COMMIT = "a859101d633a01c4a1a920d6a8ce41dabba0705f";
const RAW = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${SOURCE_COMMIT}`;
const OUT = join(import.meta.dirname, "..", "public", "catalog");
const BUDGET_BYTES = 40 * 1024 * 1024;
const CONCURRENCY = 12;

const CATEGORIES = new Set(["strength", "powerlifting", "olympic weightlifting", "strongman", "plyometrics"]);

const MUSCLES: Record<string, string> = {
  abdominals: "Abdominales",
  abductors: "Abductores",
  adductors: "Aductores",
  biceps: "Bíceps",
  calves: "Gemelos",
  chest: "Pecho",
  forearms: "Antebrazos",
  glutes: "Glúteos",
  hamstrings: "Isquiotibiales",
  lats: "Dorsales",
  "lower back": "Zona lumbar",
  "middle back": "Espalda media",
  neck: "Cuello",
  quadriceps: "Cuádriceps",
  shoulders: "Hombros",
  traps: "Trapecios",
  triceps: "Tríceps",
};

const EQUIPMENT: Record<string, string> = {
  "body only": "Peso corporal",
  machine: "Máquina",
  other: "Otro",
  "foam roll": "Rodillo de espuma",
  kettlebells: "Kettlebell",
  dumbbell: "Mancuernas",
  cable: "Polea",
  barbell: "Barra",
  bands: "Bandas elásticas",
  "medicine ball": "Balón medicinal",
  "exercise ball": "Fitball",
  "e-z curl bar": "Barra Z",
};

interface SourceExercise {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  images: string[];
}

interface CatalogExercise {
  baseId: string;
  originalName: string;
  primary: string[];
  secondary: string[];
  equipment: string | null;
  images: string[];
}

async function fetchWithRetry(url: string, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function pool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        await worker(items[i]!, i);
      }
    }),
  );
}

const source = (await (await fetchWithRetry(`${RAW}/dist/exercises.json`)).json()) as SourceExercise[];
const selected = source.filter((e) => CATEGORIES.has(e.category));

for (const e of selected) {
  for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
    if (!MUSCLES[m]) throw new Error(`Músculo sin traducción: ${m} (${e.id})`);
  }
  if (e.equipment !== null && !EQUIPMENT[e.equipment]) throw new Error(`Equipamiento sin traducción: ${e.equipment}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "img"), { recursive: true });

const jobs: { exercise: SourceExercise; image: string; index: number; out: string }[] = [];
const exercises: CatalogExercise[] = selected.map((e) => {
  const images = e.images.map((img, index) => {
    const out = `${e.id}/${index}.webp`;
    jobs.push({ exercise: e, image: img, index, out });
    return out;
  });
  const primary = [...new Set(e.primaryMuscles)];
  const secondary = [...new Set(e.secondaryMuscles)].filter((m) => !primary.includes(m));
  return {
    baseId: e.id,
    originalName: e.name.trim(),
    primary,
    secondary,
    equipment: e.equipment === null ? null : EQUIPMENT[e.equipment]!,
    images,
  };
});

let totalBytes = 0;
let done = 0;
await pool(jobs, async (job) => {
  const res = await fetchWithRetry(`${RAW}/exercises/${job.image}`);
  const input = Buffer.from(await res.arrayBuffer());
  const webp = await sharp(input).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
  const target = join(OUT, "img", job.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, webp);
  totalBytes += webp.length;
  done++;
  if (done % 100 === 0) console.log(`  ${done}/${jobs.length} imágenes`);
});

const catalog = {
  catalogVersion: SOURCE_COMMIT,
  muscles: Object.entries(MUSCLES).map(([baseKey, name]) => ({ baseKey, name })),
  exercises,
};
writeFileSync(join(OUT, "exercises.json"), JSON.stringify(catalog));
totalBytes += statSync(join(OUT, "exercises.json")).size;

const mb = (totalBytes / 1048576).toFixed(1);
console.log(`Catálogo: ${exercises.length} ejercicios, ${jobs.length} imágenes, ${mb} MB`);
if (totalBytes > BUDGET_BYTES) {
  console.error(`El catálogo supera el presupuesto de 40 MB (${mb} MB)`);
  process.exit(1);
}
