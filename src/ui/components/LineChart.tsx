// Gráfico de línea SVG propio, colores neutros, sin zonas valorativas (research R13).
import { parseLocalDate, formatShort } from "../../domain/dates.ts";
import type { LocalDate } from "../../domain/types.ts";
import { formatNumber } from "../../domain/validation.ts";

export interface Series {
  label: string;
  points: { date: LocalDate; value: number }[];
}

interface Props {
  series: Series[];
  height?: number;
  decimals?: number;
}

const W = 320;

export function LineChart({ series, height = 160, decimals = 1 }: Props) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <p class="muted">Sin datos todavía.</p>;

  const times = all.map((p) => parseLocalDate(p.date).getTime());
  const values = all.map((p) => p.value);
  let tMin = Math.min(...times);
  let tMax = Math.max(...times);
  if (tMin === tMax) {
    tMin -= 86_400_000;
    tMax += 86_400_000;
  }
  let vMin = Math.min(...values);
  let vMax = Math.max(...values);
  const margin = (vMax - vMin) * 0.1 || Math.max(Math.abs(vMax) * 0.05, 1);
  vMin -= margin;
  vMax += margin;

  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 20;
  const x = (t: number) => padL + ((t - tMin) / (tMax - tMin)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - vMin) / (vMax - vMin)) * (height - padT - padB);

  const firstDate = all.reduce((a, b) => (a.date < b.date ? a : b)).date;
  const lastDate = all.reduce((a, b) => (a.date > b.date ? a : b)).date;

  return (
    <div>
      <svg class="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={series.map((s) => s.label).join(", ")}>
        <line class="axis" x1={padL} y1={height - padB} x2={W - padR} y2={height - padB} />
        <line class="axis" x1={padL} y1={padT} x2={padL} y2={height - padB} />
        <text class="label" x={padL - 4} y={padT + 8} text-anchor="end">
          {formatNumber(vMax - margin, decimals)}
        </text>
        <text class="label" x={padL - 4} y={height - padB} text-anchor="end">
          {formatNumber(vMin + margin, decimals)}
        </text>
        <text class="label" x={padL} y={height - 4}>
          {formatShort(firstDate)}
        </text>
        <text class="label" x={W - padR} y={height - 4} text-anchor="end">
          {formatShort(lastDate)}
        </text>
        {series.map((s, i) => {
          const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
          const d = pts
            .map((p, j) => `${j === 0 ? "M" : "L"}${x(parseLocalDate(p.date).getTime()).toFixed(1)},${y(p.value).toFixed(1)}`)
            .join(" ");
          return (
            <g key={s.label}>
              <path class={`series-${i % 2}`} d={d} fill="none" stroke-width="1.5" />
              {pts.length <= 60 &&
                pts.map((p) => (
                  <circle
                    key={p.date}
                    class={`dot-${i % 2}`}
                    cx={x(parseLocalDate(p.date).getTime())}
                    cy={y(p.value)}
                    r="2"
                  />
                ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div class="row muted">
          {series.map((s, i) => (
            <span key={s.label}>
              {i === 0 ? "— " : "- - "}
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
