import { For } from "solid-js";

import { formatCompact, formatNumber, formatShortDate } from "../data/format.ts";
import type { Day } from "../data/stats-asistencia.ts";
import { Figure } from "./Figure.tsx";

export function DailyChart(props: { days: Day[] }) {
  const max = Math.max(...props.days.map((d) => d.total.central));
  const pct = (value: number) => (value / max) * 100;
  const last = props.days[props.days.length - 1];
  const busiest = props.days.reduce((best, day) =>
    day.day.central > best.day.central ? day : best,
  );

  return (
    <Figure
      title="Asistencia acumulada por día"
      finding={`Al ${formatShortDate(last.date)} se acumulan ${formatNumber(last.total.central)} asistentes. El día con más gente fue el ${formatShortDate(busiest.date)}, con ${formatNumber(busiest.day.central)}.`}
      note={
        <>
          Columnas con la asistencia acumulada al final de cada día. La parte en gris es lo
          acumulado hasta el día anterior y la parte en color es lo de ese día. Las cifras están en
          la <a href="#por-dia">tabla por día</a>.
        </>
      }
      source={<a href="#actos">los informes citados en cada fila de la tabla de actos</a>}
      legend={
        <>
          <span class="key-ink">Acumulado hasta el día anterior</span>
          <span>Asistencia de ese día</span>
        </>
      }
    >
      <div class="days" aria-hidden="true" style={`--days: ${props.days.length}`}>
        <For each={props.days}>
          {(day) => (
            <div>
              <div class="day-plot">
                <span class="day-total" style={`bottom: ${pct(day.total.central)}%`}>
                  {formatCompact(day.total.central)}
                </span>
                <svg viewBox="0 0 10 100" preserveAspectRatio="none">
                  <rect
                    class="bar-ink"
                    x="0"
                    y={100 - pct(day.total.central - day.day.central)}
                    width="10"
                    height={pct(day.total.central - day.day.central)}
                  />
                  <rect
                    class="bar-fill"
                    x="0"
                    y={100 - pct(day.total.central)}
                    width="10"
                    height={pct(day.day.central)}
                  />
                </svg>
              </div>
              <span class="day-date">{formatShortDate(day.date)}</span>
            </div>
          )}
        </For>
      </div>
    </Figure>
  );
}

export function DailyTable(props: { days: Day[] }) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="days-table">
        <caption class="visually-hidden">Asistencia por día y acumulada, con su rango</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col" class="num">
              Ese día
            </th>
            <th scope="col" class="num">
              Acumulado
            </th>
            <th scope="col" class="num">
              Acumulado, baja
            </th>
            <th scope="col" class="num">
              Acumulado, alta
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.days}>
            {(day) => (
              <tr>
                <th scope="row">{formatShortDate(day.date)}</th>
                <td class="num">{formatNumber(day.day.central)}</td>
                <td class="num">{formatNumber(day.total.central)}</td>
                <td class="num">{formatNumber(day.total.low)}</td>
                <td class="num">{formatNumber(day.total.high)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
