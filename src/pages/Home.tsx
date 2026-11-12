import { For } from "solid-js";

import { formatDateLima, formatDateRange } from "../data/format.ts";
import { eventStatus, summarize } from "../data/stats.ts";
import type { EventRecord } from "../data/types.ts";

function EventRow(props: { event: EventRecord }) {
  const event = props.event;
  const summary = summarize(event);
  return (
    <tr>
      <th scope="row">
        <a class="link-block" href={`/eventos/${event.slug}`}>
          {event.title}
        </a>
        <div class="muted">{eventStatus(event)}</div>
      </th>
      <td data-label="Tipo">{summary.kindLabel}</td>
      <td data-label="Fechas">{formatDateRange(event.start, event.end)}</td>
      <td data-label="Lugares">{event.places.join(", ")}</td>
      <td data-label="Avance" class="num">
        {summary.progress}
      </td>
      <td data-label={summary.figureLabel} class="num">
        {summary.figure}
        <div class="muted figure-label">{summary.figureLabel}</div>
      </td>
      <td data-label="Actualizado">{formatDateLima(event.updated)}</td>
    </tr>
  );
}

export function Home(props: { events: EventRecord[] }) {
  return (
    <>
      <h1>Eventos públicos</h1>
      <p class="lead">
        Cifras de eventos públicos, cada una con su fuente: la asistencia a actos con quién la
        estimó, y los resultados de torneos calculados partido por partido.
      </p>
      <section class="section" aria-labelledby="eventos">
        <h2 id="eventos" class="visually-hidden">
          Lista de eventos
        </h2>
        <div class="table-scroll" tabindex="0">
          <table class="events-table">
            <caption class="visually-hidden">
              Eventos con su tipo, su avance, una cifra clave y la fecha de la última actualización
            </caption>
            <thead>
              <tr>
                <th scope="col">Evento</th>
                <th scope="col">Tipo</th>
                <th scope="col">Fechas</th>
                <th scope="col">Lugares</th>
                <th scope="col" class="num">
                  Avance
                </th>
                <th scope="col" class="num">
                  Cifra clave
                </th>
                <th scope="col">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.events}>{(event) => <EventRow event={event} />}</For>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
