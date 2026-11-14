import { For, Show } from "solid-js";

import { ActsChart } from "../components/ActsChart.tsx";
import { ActsTable } from "../components/ActsTable.tsx";
import { ArchiveCopy } from "../components/ArchiveCopy.tsx";
import { DailyChart, DailyTable } from "../components/DailyChart.tsx";
import {
  formatDateLima,
  formatDateRange,
  formatNumber,
  formatShortDate,
  formatStamp,
} from "../data/format.ts";
import {
  actDate,
  dailyTotals,
  heldActs,
  largestAct,
  plannedActs,
  sumRange,
} from "../data/stats-asistencia.ts";
import { eventStatus } from "../data/stats.ts";
import type { AsistenciaRecord, EventRecord } from "../data/types.ts";
import { SITE_NAME, SITE_URL } from "../site.ts";

function eventUrl(event: EventRecord): string {
  return `${SITE_URL}/analisis/${event.slug}`;
}

export function AsistenciaPage(props: { event: AsistenciaRecord }) {
  const event = props.event;
  const held = heldActs(event);
  const planned = plannedActs(event);
  const total = sumRange(held);
  const largest = largestAct(event);
  const days = dailyTotals(event);
  const status = eventStatus(event);
  const comparison = [...(event.comparison ?? [])].sort((a, b) => b.figure - a.figure);

  return (
    <>
      <h1>{event.title}</h1>
      <p class="lead">{event.summary}</p>
      <dl class="facts">
        <div>
          <dt>Fechas</dt>
          <dd>{formatDateRange(event.start, event.end)}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd class="status" data-state={status}>
            {status}
          </dd>
        </div>
        <div>
          <dt>Actualizado</dt>
          <dd>{formatStamp(event.updated)}</dd>
        </div>
      </dl>

      <dl class="figures">
        <div>
          <dt>Asistencia total de los actos realizados</dt>
          <dd class="value">{formatNumber(total.central)}</dd>
          <dd class="note">
            Entre {formatNumber(total.low)} y {formatNumber(total.high)}
          </dd>
        </div>
        <div>
          <dt>Actos realizados</dt>
          <dd class="value">
            {held.length} de {event.acts.length}
          </dd>
          <dd class="note">
            {planned.length === 0 ? "Todos realizados" : `${planned.length} por realizar`}
          </dd>
        </div>
        <Show when={largest}>
          {(act) => (
            <div>
              <dt>Acto más grande</dt>
              <dd class="value">{formatNumber(act().central)}</dd>
              <dd class="note">
                {act().name}, {act().city}, {formatShortDate(actDate(act()))}
              </dd>
            </div>
          )}
        </Show>
      </dl>

      <Show when={held.length > 0}>
        <section class="section" aria-labelledby="por-acto">
          <h2 id="por-acto">Asistencia por acto</h2>
          <ActsChart acts={held} />
        </section>

        <section class="section" aria-labelledby="por-dia">
          <h2 id="por-dia">Asistencia por día</h2>
          <DailyChart days={days} />
          <DailyTable days={days} />
        </section>
      </Show>

      <section class="section" id="actos" aria-labelledby="actos-titulo">
        <h2 id="actos-titulo">Actos</h2>
        <p>
          Cada fila dice quién dio la cifra y enlaza al informe. La cifra esperada la dan los
          organizadores o una autoridad antes del acto y no entra en los totales. En un acto
          realizado, la diferencia compara la cifra central con la esperada.
        </p>
        <ActsTable acts={event.acts} />
      </section>

      <Show when={comparison.length > 0}>
        <section class="section" aria-labelledby="comparacion">
          <h2 id="comparacion">Comparación con otros actos</h2>
          <div class="table-scroll" tabindex="0">
            <table class="compare-table">
              <caption class="visually-hidden">
                Asistencia a otros actos multitudinarios, con su fuente
              </caption>
              <thead>
                <tr>
                  <th scope="col">Acto</th>
                  <th scope="col" class="num">
                    Asistencia
                  </th>
                  <th scope="col">Quién la informa</th>
                  <th scope="col">Fuente</th>
                </tr>
              </thead>
              <tbody>
                <For each={comparison}>
                  {(row) => (
                    <tr>
                      <th scope="row">{row.label}</th>
                      <td class="num">{formatNumber(row.figure)}</td>
                      <td>{row.attribution}</td>
                      <td>
                        <a class="link-block" href={row.source.url}>
                          {row.source.outlet}
                        </a>
                        <ArchiveCopy archive={row.source.archive} class="link-block" />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </section>
      </Show>

      <section class="section" aria-labelledby="metodo">
        <h2 id="metodo">Método</h2>
        <p>{event.method}</p>
      </section>

      <section class="section" aria-labelledby="descargas">
        <h2 id="descargas">Descargas</h2>
        <ul class="downloads">
          <li>
            <a class="link-block" href={`/analisis/${event.slug}.json`}>
              Datos en JSON
            </a>
          </li>
          <li>
            <a class="link-block" href={`/analisis/${event.slug}.csv`}>
              Actos en CSV
            </a>
          </li>
        </ul>
      </section>

      <section class="section" aria-labelledby="citar">
        <h2 id="citar">Cómo citar</h2>
        <p class="cite">
          {event.title}. {SITE_NAME}, actualizado el {formatDateLima(event.updated)}.{" "}
          {eventUrl(event)}
        </p>
      </section>
    </>
  );
}
