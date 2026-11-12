import { For } from "solid-js";

import { formatCompact, formatNumber, formatShortDate } from "../data/format.ts";
import { actDate } from "../data/stats.ts";
import type { HeldAct } from "../data/types.ts";
import { niceScale } from "./chart-scale.ts";

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 12;
const CAP_HEIGHT = 10;

export function ActsChart(props: { acts: HeldAct[] }) {
  const scale = niceScale(Math.max(...props.acts.map((act) => act.high)));
  const pct = (value: number) => (value / scale.max) * 100;
  const barTop = (ROW_HEIGHT - BAR_HEIGHT) / 2;
  const mid = ROW_HEIGHT / 2;

  return (
    <figure class="chart">
      <figcaption>
        Gráfico de barras con la cifra central de cada acto realizado y una línea desde la cifra
        baja hasta la alta. Las mismas cifras están en la <a href="#actos">tabla de actos</a>.
      </figcaption>
      <div class="bars" aria-hidden="true">
        <For each={props.acts}>
          {(act) => (
            <div class="bar-row">
              <div class="bar-label">
                <span class="bar-date">{formatShortDate(actDate(act))}</span>
                {act.city}, {act.name}
              </div>
              <svg class="bar-plot" viewBox={`0 0 100 ${ROW_HEIGHT}`} preserveAspectRatio="none">
                <For each={scale.ticks.slice(1)}>
                  {(tick) => (
                    <line class="grid-line" x1={pct(tick)} x2={pct(tick)} y1="0" y2={ROW_HEIGHT} />
                  )}
                </For>
                <rect
                  class="bar-fill"
                  x="0"
                  y={barTop}
                  width={pct(act.central)}
                  height={BAR_HEIGHT}
                />
                {act.high > act.low ? (
                  <>
                    <line
                      class="range-line"
                      x1={pct(act.low)}
                      x2={pct(act.high)}
                      y1={mid}
                      y2={mid}
                    />
                    <line
                      class="range-line"
                      x1={pct(act.low)}
                      x2={pct(act.low)}
                      y1={mid - CAP_HEIGHT / 2}
                      y2={mid + CAP_HEIGHT / 2}
                    />
                    <line
                      class="range-line"
                      x1={pct(act.high)}
                      x2={pct(act.high)}
                      y1={mid - CAP_HEIGHT / 2}
                      y2={mid + CAP_HEIGHT / 2}
                    />
                  </>
                ) : null}
              </svg>
              <div class="bar-value">{formatNumber(act.central)}</div>
            </div>
          )}
        </For>
        <div class="bar-axis">
          <div class="bar-ticks">
            <For each={scale.ticks}>
              {(tick) => <span style={`left: ${pct(tick)}%`}>{formatCompact(tick)}</span>}
            </For>
          </div>
        </div>
      </div>
      <div class="legend" aria-hidden="true">
        <span>Cifra central</span>
        <span class="key-range">Desde la cifra baja hasta la alta</span>
      </div>
    </figure>
  );
}
