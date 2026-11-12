import { For } from "solid-js";

import { formatNumber } from "../data/format.ts";
import type { GoalPeriod } from "../forecast/events.ts";

const WIDTH = 100;
const HEIGHT = 40;

export function GoalTimingChart(props: { periods: GoalPeriod[] }) {
  const max = Math.max(1, ...props.periods.flatMap((p) => [p.home, p.away]));
  const slot = WIDTH / props.periods.length;
  const bar = slot / 3;
  const y = (v: number) => HEIGHT - (v / max) * HEIGHT;
  return (
    <figure class="chart">
      <figcaption>
        Goles por tramo de 15 minutos, separados entre el equipo local y el visitante. Las cifras
        están en la <a href="#goles-tabla">tabla por tramo</a>.
      </figcaption>
      <div class="histogram" aria-hidden="true">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <For each={props.periods}>
            {(p, i) => (
              <>
                <rect
                  class="bar-fill"
                  x={i() * slot + slot / 6}
                  y={y(p.home)}
                  width={bar}
                  height={HEIGHT - y(p.home)}
                />
                <rect
                  class="bar-fill-past"
                  x={i() * slot + slot / 6 + bar + 1}
                  y={y(p.away)}
                  width={bar}
                  height={HEIGHT - y(p.away)}
                />
              </>
            )}
          </For>
        </svg>
        <div class="histogram-labels">
          <For each={props.periods}>{(p) => <span>{p.label}</span>}</For>
        </div>
      </div>
      <div class="legend" aria-hidden="true">
        <span>Goles del local</span>
        <span class="key-past">Goles de la visita</span>
      </div>
    </figure>
  );
}

export function GoalTimingTable(props: { periods: GoalPeriod[] }) {
  return (
    <div class="table-scroll" tabindex="0" id="goles-tabla">
      <table class="timing-table">
        <caption class="visually-hidden">Goles por tramo de 15 minutos, local y visitante</caption>
        <thead>
          <tr>
            <th scope="col">Tramo (min)</th>
            <th scope="col" class="num">
              Local
            </th>
            <th scope="col" class="num">
              Visita
            </th>
            <th scope="col" class="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.periods}>
            {(p) => (
              <tr>
                <th scope="row">{p.label}</th>
                <td class="num">{formatNumber(p.home)}</td>
                <td class="num">{formatNumber(p.away)}</td>
                <td class="num strong">{formatNumber(p.home + p.away)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
