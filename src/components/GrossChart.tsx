import { For } from "solid-js";

import { lineOf } from "../forecast/mcu.ts";
import { formatMoney, formatMoneyCompact, formatShortDate } from "../data/format.ts";
import type { CpiData } from "../data/cpi.ts";
import { realWorldwide } from "../data/stats-taquilla.ts";
import type { ReleasedFilm } from "../data/types.ts";

const W = 640;
const H = 240;
const PAD_L = 44;
const PAD_B = 28;
const PAD_T = 8;
const PAD_R = 4;

export interface GrossPoint {
  title: string;
  originalTitle: string;
  release: string;
  worldwide: number;
  avengers: boolean;
}

export function grossPoints(films: ReleasedFilm[], cpi: CpiData): GrossPoint[] {
  return films.map((film) => ({
    title: film.title,
    originalTitle: film.originalTitle,
    release: film.release,
    worldwide: realWorldwide(film, cpi),
    avengers: lineOf(film.originalTitle) === "avengers",
  }));
}

function niceStep(max: number): number {
  for (const step of [2e8, 5e8, 1e9, 2e9]) if (max / step <= 4) return step;
  return 2e9;
}

export function GrossChart(props: { points: GrossPoint[]; dollars: number }) {
  const max = Math.max(...props.points.map((p) => p.worldwide));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const barW = Math.max(4, (plotW / props.points.length) * 0.7);
  const x = (i: number) => PAD_L + ((i + 0.5) * plotW) / props.points.length - barW / 2;
  const y = (v: number) => PAD_T + plotH * (1 - v / top);
  const years = props.points.map((p, i) => ({ year: Number(p.release.slice(0, 4)), i }));

  return (
    <figure class="chart">
      <figcaption>
        Recaudación mundial de cada estreno en dólares de {props.dollars}. Las películas de{" "}
        <em>Avengers</em> van marcadas con el color de acento. Las cifras están en la{" "}
        <a href="#peliculas">tabla de películas</a>.
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true" class="gross-chart">
        <For each={ticks}>
          {(t) => (
            <>
              <line class="grid-line" x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} />
              <text class="chart-tick" x={PAD_L - 6} y={y(t) + 4} text-anchor="end">
                {t === 0 ? "0" : formatMoneyCompact(t)}
              </text>
            </>
          )}
        </For>
        <For each={props.points}>
          {(point, i) => (
            <rect
              class={point.avengers ? "bar-fill avengers" : "bar-fill"}
              x={x(i())}
              y={y(point.worldwide)}
              width={barW}
              height={Math.max(1, PAD_T + plotH - y(point.worldwide))}
            >
              <title>{`${point.title}: ${formatMoney(point.worldwide)}`}</title>
            </rect>
          )}
        </For>
        <For each={years.filter((p, i) => i === 0 || p.year !== years[i - 1]!.year)}>
          {(p) => (
            <text class="chart-tick" x={x(p.i) + barW / 2} y={H - 8} text-anchor="middle">
              {p.year}
            </text>
          )}
        </For>
      </svg>
      <div class="legend" aria-hidden="true">
        <span class="key-avengers">Película de Avengers</span>
        <span>Otras películas del UCM</span>
      </div>
    </figure>
  );
}

export function GrossTable(props: { points: GrossPoint[]; dollars: number }) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="gross-table">
        <caption class="visually-hidden">
          Recaudación mundial de cada estreno en dólares de {props.dollars}
        </caption>
        <thead>
          <tr>
            <th scope="col">Película</th>
            <th scope="col">Estreno</th>
            <th scope="col" class="num">
              Mundial ({props.dollars})
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.points}>
            {(point) => (
              <tr>
                <th scope="row">
                  {point.title}
                  {point.avengers ? <span class="tag">Avengers</span> : null}
                </th>
                <td>{formatShortDate(point.release)}</td>
                <td class="num">{formatMoney(point.worldwide)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
