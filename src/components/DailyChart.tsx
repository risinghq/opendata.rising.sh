import { For } from "solid-js";

import { formatCompact, formatNumber, formatShortDate } from "../data/format.ts";
import type { Day } from "../data/stats-asistencia.ts";

export function DailyChart(props: { days: Day[] }) {
  const max = Math.max(...props.days.map((d) => d.total.central));
  const pct = (value: number) => (value / max) * 100;

  return (
    <figure class="chart">
      <figcaption>
        Columnas con la asistencia acumulada al final de cada día. La parte clara es lo acumulado
        hasta el día anterior y la oscura es lo de ese día. Las cifras están en la{" "}
        <a href="#por-dia">tabla por día</a>.
      </figcaption>
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
                    class="bar-fill-past"
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
      <div class="legend" aria-hidden="true">
        <span class="key-past">Acumulado hasta el día anterior</span>
        <span>Asistencia de ese día</span>
      </div>
    </figure>
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
