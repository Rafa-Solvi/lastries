import type { ComponentChildren } from "preact";
import { back } from "../router.ts";

export function TopBar({ title, fallback = "/", children }: { title: string; fallback?: string; children?: ComponentChildren }) {
  return (
    <div class="topbar">
      <button type="button" aria-label="Volver" onClick={() => back(fallback)}>
        ←
      </button>
      <h1 style={{ flex: 1, margin: 0 }}>{title}</h1>
      {children}
    </div>
  );
}
