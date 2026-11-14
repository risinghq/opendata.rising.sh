import { For } from "solid-js";

import { lineOf } from "../forecast/mcu.ts";
import { formatMoney, formatMoneyCompact, formatNumber, formatShortDate } from "../data/format.ts";
import type { CpiData } from "../data/cpi.ts";
import { realWorldwide } from "../data/stats-taquilla.ts";
import { WIKIPEDIA_LABEL } from "../data/notice.ts";
import type { ReleasedFilm } from "../data/types.ts";
import { Figure } from "./Figure.tsx";

const W = 100;
const H = 100;
/** Year labels are mono text of fixed size, so at most this many fit under the plot on a phone. */
const MAX_YEAR_LABELS = 8;

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

/** The first release of each year, skipping years that would crowd the previous label. */
function yearLabels(points: GrossPoint[]): { year: number; i: number }[] {
  const gap = points.length / MAX_YEAR_LABELS;
  const labels: { year: number; i: number }[] = [];
  points.forEach((point, i) => {
    const year = Number(point.release.slice(0, 4));
    const last = labels.at(-1);
    if (!last || (year !== last.year && i - last.i >= gap)) labels.push({ year, i });
  });
  return labels;
}

export function GrossChart(props: { points: GrossPoint[]; dollars: number }) {
  const max = Math.max(...props.points.map((p) => p.worldwide));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const count = props.points.length;
  const barW = (W / count) * 0.7;
  const x = (i: number) => ((i + 0.5) * W) / count - barW / 2;
  const y = (v: number) => H * (1 - v / top);
  const years = yearLabels(props.points);
  const top1 = props.points.reduce((best, p) => (p.worldwide > best.worldwide ? p : best));
  /** The record's bar centre as a fraction of the plot width; its label sits on the roomier side. */
  const topAt = (props.points.indexOf(top1) + 0.5) / count;

  return (
    <Figure
      title="Recaudación mundial por estreno"
      finding={`${top1.title} es la que más recaudó: ${formatMoneyCompact(top1.worldwide)} en dólares de ${props.dollars}.`}
      note={
        <>
          En dólares de {props.dollars}, para comparar películas de años distintos con el mismo
          dinero. Las películas de <em>Avengers</em> van en color y el resto en gris.
        </>
      }
      source={
        <>
          Box Office Mojo y {WIKIPEDIA_LABEL}, citadas por película en la{" "}
          <a href="#peliculas">tabla</a>; IPC de la BLS (<a href="#metodo">método</a>)
        </>
      }
      legend={
        <>
          <span>Película de Avengers</span>
          <span class="key-ink">Otras películas del UCM</span>
        </>
      }
    >
      <div class="gross-chart" aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <For each={ticks}>
            {(t) => <line class="grid-line" x1="0" x2={W} y1={y(t)} y2={y(t)} />}
          </For>
          <For each={props.points}>
            {(point, i) => (
              <rect
                class={point.avengers ? "bar-fill" : "bar-ink"}
                x={x(i())}
                y={y(point.worldwide)}
                width={barW}
                height={H - y(point.worldwide)}
              />
            )}
          </For>
        </svg>
        <For each={ticks}>
          {(t) => (
            <span class="tick-y" style={`bottom: ${(t / top) * 100}%`}>
              {t === 0 ? "0" : `${formatNumber(t / 1e6)} M`}
            </span>
          )}
        </For>
        <For each={years}>
          {(p) => (
            <span class="tick-x" style={`left: ${((p.i + 0.5) / count) * 100}%`}>
              {p.year}
            </span>
          )}
        </For>
        <span
          class={`chart-note ${topAt > 0.5 ? "point-left" : "point-right"}`}
          style={`left: ${topAt * 100}%; bottom: ${(top1.worldwide / top) * 100}%`}
        >
          {topAt > 0.5 ? `${top1.title} →` : `← ${top1.title}`}
        </span>
      </div>
    </Figure>
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
