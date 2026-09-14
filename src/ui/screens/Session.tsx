// Sesión en curso (FR-016 – FR-021).
import { useState } from "preact/hooks";
import {
  addSessionExercise,
  confirmSet,
  deleteSet,
  finishSession,
  formatSetShort,
  moveSessionExercise,
  removeSessionExercise,
  saveDraft,
  toggleWarmup,
  updateSet,
  validateSetValues,
} from "../../data/actions/training.ts";
import { useAppState } from "../../data/store.ts";
import { extraSetFrom, lastTime, pendingSets, type PendingSet } from "../../domain/prefill.ts";
import type { Session as SessionT, SessionExercise, WorkSet } from "../../domain/types.ts";
import { ExercisePicker } from "../components/ExercisePicker.tsx";
import { SetEditor, type EditableSet } from "../components/SetEditor.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useAction } from "../components/useAction.ts";
import { navigate } from "../router.ts";

export function SetLine({ set, index }: { set: WorkSet | PendingSet; index?: number }) {
  return (
    <span class="num">
      {index !== undefined && <span class="muted">{index + 1}. </span>}
      {formatSetShort(set)}
      {set.warmup && (
        <>
          {" "}
          <span class="chip">calent.</span>
        </>
      )}
    </span>
  );
}

const strip = ({ isDraft: _d, ...rest }: PendingSet): EditableSet => rest;

export function Session() {
  const session = useAppState((s) => s.sessions.find((x) => x.endedAt === null) ?? null);
  const [picking, setPicking] = useState(false);
  const { run, error } = useAction();

  if (!session) {
    return (
      <div>
        <TopBar title="Sesión" />
        <div class="card stack">
          <p>No hay ninguna sesión en curso.</p>
          <a class="btn primary" href="#/">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={session.routineName ?? "Sesión libre"} />
      {session.exercises.length === 0 && <p class="muted card">Añade el primer ejercicio.</p>}
      {session.exercises.map((e, i) => (
        <SessionExerciseCard key={`${e.exerciseId}-${i}`} session={session} index={i} entry={e} />
      ))}
      {picking ? (
        <ExercisePicker
          onCancel={() => setPicking(false)}
          onPick={(ex) => {
            setPicking(false);
            void run(() => addSessionExercise(session.id, ex.id));
          }}
        />
      ) : (
        <button type="button" style={{ width: "100%" }} onClick={() => setPicking(true)}>
          Añadir ejercicio
        </button>
      )}
      {error && <p class="field-error">{error}</p>}
      <div class="card" style={{ marginTop: "12px" }}>
        <button
          type="button"
          style={{ width: "100%" }}
          onClick={() =>
            void run(async () => {
              await finishSession(session.id);
              navigate("/");
            })
          }
        >
          Finalizar sesión
        </button>
      </div>
    </div>
  );
}

function SessionExerciseCard({ session, index, entry }: { session: SessionT; index: number; entry: SessionExercise }) {
  const exercise = useAppState((s) => s.exercises.find((x) => x.id === entry.exerciseId));
  const sessions = useAppState((s) => s.sessions);
  const [editingSet, setEditingSet] = useState<{ index: number; value: EditableSet } | null>(null);
  const { run, error } = useAction();

  const last = lastTime(sessions, entry.exerciseId, session.id);
  const pending = pendingSets(last, entry.target, entry.sets.length, entry.draft);
  const next = pending[0];
  const t = entry.target;

  const onDraft = (value: EditableSet) => void run(() => saveDraft(session.id, index, value));

  return (
    <div class="card stack">
      <div class="spread">
        <div>
          <a href={`#/exercises/${entry.exerciseId}`} style={{ color: "var(--text)", fontWeight: 600 }}>
            {exercise?.name ?? "?"}
          </a>
          {t && (
            <div class="muted num">
              Objetivo: {t.targetSets} × {t.repsMin}–{t.repsMax} @ RIR {t.targetRir}
            </div>
          )}
        </div>
        <span class="row-nowrap">
          <button type="button" aria-label="Subir" onClick={() => void run(() => moveSessionExercise(session.id, index, index - 1))}>
            ↑
          </button>
          <button type="button" aria-label="Bajar" onClick={() => void run(() => moveSessionExercise(session.id, index, index + 1))}>
            ↓
          </button>
          <button type="button" aria-label="Quitar ejercicio" onClick={() => void run(() => removeSessionExercise(session.id, index))}>
            ✕
          </button>
        </span>
      </div>

      <div>
        <div class="muted">Última vez</div>
        {last ? (
          <ul class="list">
            {last.map((w, k) => (
              <li key={k}>
                <SetLine set={w} index={k} />
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">Sin registro previo.</p>
        )}
      </div>

      {entry.sets.length > 0 && (
        <div>
          <div class="muted">Hoy</div>
          <ul class="list">
            {entry.sets.map((w, k) =>
              editingSet?.index === k ? (
                <li key={k} class="stack">
                  <SetEditor value={editingSet.value} onChange={(v) => setEditingSet({ index: k, value: v })} />
                  <div class="row">
                    <button
                      type="button"
                      class="primary"
                      onClick={() =>
                        void run(async () => {
                          await updateSet(session.id, index, k, editingSet.value);
                          setEditingSet(null);
                        })
                      }
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEditingSet(null)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          await deleteSet(session.id, index, k);
                          setEditingSet(null);
                        })
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ) : (
                <li key={k} class="spread">
                  <SetLine set={w} index={k} />
                  <span class="row-nowrap">
                    <button type="button" onClick={() => void run(() => toggleWarmup(session.id, index, k))}>
                      {w.warmup ? "Efectiva" : "Calent."}
                    </button>
                    <button type="button" onClick={() => setEditingSet({ index: k, value: { ...w } })}>
                      Editar
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {next ? (
        <div class="stack">
          <div class="spread">
            <strong>Serie {entry.sets.length + 1}</strong>
            {next.isDraft && <span class="draft-mark">sin confirmar</span>}
          </div>
          <SetEditor value={strip(next)} isDraft={next.isDraft} onChange={onDraft} />
          <button
            type="button"
            class="primary"
            disabled={validateSetValues(next) !== null}
            onClick={() => void run(() => confirmSet(session.id, index, strip(next)))}
          >
            Confirmar
          </button>
          {validateSetValues(next) && <p class="muted">{validateSetValues(next)}</p>}
          {pending.length > 1 && (
            <ul class="list muted">
              {pending.slice(1).map((p, k) => (
                <li key={k}>
                  <SetLine set={p} index={entry.sets.length + 1 + k} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => onDraft(strip(extraSetFrom(entry.sets)))}>
          Añadir serie
        </button>
      )}
      {error && <p class="field-error">{error}</p>}
    </div>
  );
}
