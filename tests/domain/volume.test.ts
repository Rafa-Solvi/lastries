import { describe, expect, it } from "vitest";
import { exerciseProgress, weeklyVolume, weekStart } from "../../src/domain/volume.ts";
import type { Exercise, Session, WorkSet } from "../../src/domain/types.ts";

const ex = (id: string, primary: string[], secondary: string[]): Exercise => ({
  id,
  source: "user",
  baseId: null,
  originalName: null,
  name: id,
  primaryMuscleIds: primary,
  secondaryMuscleIds: secondary,
  equipment: null,
  demos: [],
  archived: false,
});

const set = (weightKg: number, reps: number, opts: Partial<WorkSet> = {}): WorkSet => ({
  weightKg,
  reps,
  rir: 2,
  failure: false,
  warmup: false,
  confirmedAt: "2026-09-14T18:00:00",
  ...opts,
});

const session = (id: string, date: string, entries: [string, WorkSet[]][]): Session => ({
  id,
  routineId: null,
  routineName: null,
  date,
  startedAt: `${date}T18:00:00`,
  endedAt: `${date}T19:00:00`,
  exercises: entries.map(([exerciseId, sets]) => ({ exerciseId, target: null, sets, draft: null })),
});

const exercises = new Map<string, Exercise>([
  ["banca", ex("banca", ["pecho"], ["triceps", "hombros"])],
  ["fondos", ex("fondos", ["triceps"], ["pecho"])],
  ["rumano", ex("rumano", ["isquios", "gluteos"], ["lumbar"])],
]);

describe("weekStart", () => {
  it("devuelve el lunes de la semana ISO", () => {
    expect(weekStart("2026-09-14")).toBe("2026-09-14"); // lunes
    expect(weekStart("2026-09-20")).toBe("2026-09-14"); // domingo
    expect(weekStart("2026-09-21")).toBe("2026-09-21"); // lunes siguiente
    expect(weekStart("2026-01-01")).toBe("2025-12-29"); // cruza año
    expect(weekStart("2026-03-29")).toBe("2026-03-23"); // cambio de hora
  });
});

describe("weeklyVolume (casos mínimos del contrato)", () => {
  const warm = { warmup: true };

  it("press banca 3 efectivas + 3 calentamiento y fondos 4 → pecho 5, tríceps 5,5, hombros 1,5", () => {
    const sessions = [
      session("s1", "2026-09-15", [
        ["banca", [set(20, 10, warm), set(40, 8, warm), set(60, 5, warm), set(80, 8), set(80, 8), set(80, 7)]],
        ["fondos", [set(0, 12), set(0, 10), set(0, 10), set(0, 9)]],
      ]),
    ];
    const v = weeklyVolume(sessions, exercises, "2026-09-14");
    expect(v.get("pecho")).toBe(5);
    expect(v.get("triceps")).toBe(5.5);
    expect(v.get("hombros")).toBe(1.5);
  });

  it("peso muerto rumano 4 efectivas con dos primarios → 4, 4, 2", () => {
    const sessions = [session("s1", "2026-09-16", [["rumano", [set(100, 8), set(100, 8), set(100, 8), set(100, 8)]]])];
    const v = weeklyVolume(sessions, exercises, "2026-09-14");
    expect(v.get("isquios")).toBe(4);
    expect(v.get("gluteos")).toBe(4);
    expect(v.get("lumbar")).toBe(2);
  });

  it("solo calentamiento → 0 o ausente", () => {
    const sessions = [session("s1", "2026-09-16", [["banca", [set(20, 10, warm), set(40, 5, warm)]]])];
    const v = weeklyVolume(sessions, exercises, "2026-09-14");
    expect(v.get("pecho") ?? 0).toBe(0);
  });

  it("las series al fallo cuentan como efectivas", () => {
    const sessions = [session("s1", "2026-09-16", [["banca", [set(80, 8, { failure: true, rir: 0 })]]])];
    expect(weeklyVolume(sessions, exercises, "2026-09-14").get("pecho")).toBe(1);
  });

  it("domingo y lunes siguiente caen en semanas distintas", () => {
    const sessions = [
      session("dom", "2026-09-20", [["banca", [set(80, 8)]]]),
      session("lun", "2026-09-21", [["banca", [set(80, 8), set(80, 8)]]]),
    ];
    expect(weeklyVolume(sessions, exercises, "2026-09-14").get("pecho")).toBe(1);
    expect(weeklyVolume(sessions, exercises, "2026-09-21").get("pecho")).toBe(2);
  });

  it("usa la clasificación actual: cambiar secundarios cambia semanas pasadas", () => {
    const sessions = [session("s1", "2026-09-01", [["banca", [set(80, 8), set(80, 8)]]])];
    const before = weeklyVolume(sessions, exercises, "2026-08-31");
    expect(before.get("hombros")).toBe(1);
    const corrected = new Map(exercises);
    corrected.set("banca", ex("banca", ["pecho"], ["triceps"]));
    const after = weeklyVolume(sessions, corrected, "2026-08-31");
    expect(after.get("hombros") ?? 0).toBe(0);
    expect(after.get("triceps")).toBe(1);
  });

  it("un grupo en primarios y secundarios cuenta solo como primario", () => {
    const weird = new Map([["x", ex("x", ["pecho"], ["pecho", "triceps"])]]);
    const sessions = [session("s1", "2026-09-16", [["x", [set(50, 10), set(50, 10)]]])];
    const v = weeklyVolume(sessions, weird, "2026-09-14");
    expect(v.get("pecho")).toBe(2);
    expect(v.get("triceps")).toBe(1);
  });
});

describe("exerciseProgress", () => {
  it("por sesión, la serie efectiva de mayor peso (desempate por repeticiones), sin calentamientos", () => {
    const sessions = [
      session("a", "2026-09-01", [["banca", [set(100, 1, { warmup: true }), set(80, 6), set(80, 8), set(75, 10)]]]),
      session("b", "2026-09-08", [["banca", [set(82.5, 6)]]]),
      session("c", "2026-09-10", [["fondos", [set(0, 10)]]]),
    ];
    const { points, best } = exerciseProgress(sessions, "banca");
    expect(points).toEqual([
      { date: "2026-09-01", weightKg: 80, reps: 8 },
      { date: "2026-09-08", weightKg: 82.5, reps: 6 },
    ]);
    expect(best).toEqual({ date: "2026-09-08", weightKg: 82.5, reps: 6 });
  });
});
