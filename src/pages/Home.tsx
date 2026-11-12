import { For } from "solid-js";

import { formatDateLima, formatDateRange, formatNumber } from "../data/format.ts";
import { eventStatus, heldActs, sumRange } from "../data/stats.ts";
import type { EventRecord } from "../data/types.ts";

function EventRow(props: { event: EventRecord }) {
  const event = props.event;
  const held = heldActs(event);
  return (
    <tr>
      <th scope="row">
        <a class="link-block" href={`/eventos/${event.slug}`}>
          {event.title}
        </a>
        <div class="muted">{eventStatus(event)}</div>
      </th>
      <td>{formatDateRange(event.start, event.end)}</td>
      <td>{event.places.join(", ")}</td>
      <td class="num">
        {held.length} de {event.acts.length}
      </td>
      <td class="num">{formatNumber(sumRange(held).central)}</td>
      <td>{formatDateLima(event.updated)}</td>
    </tr>
  );
}

export function Home(props: { events: EventRecord[] }) {
  return (
    <>
      <h1>Eventos públicos</h1>
      <p class="lead">
        Cifras de asistencia a eventos públicos, cada una con quién la estimó y un enlace al informe
        que la publica.
      </p>
      <section class="section" aria-labelledby="eventos">
        <h2 id="eventos" class="visually-hidden">
          Lista de eventos
        </h2>
        <div class="table-scroll" tabindex="0">
          <table class="events-table">
            <caption class="visually-hidden">
              Eventos con su asistencia total y la fecha de la última actualización
            </caption>
            <thead>
              <tr>
                <th scope="col">Evento</th>
                <th scope="col">Fechas</th>
                <th scope="col">Lugares</th>
                <th scope="col" class="num">
                  Actos realizados
                </th>
                <th scope="col" class="num">
                  Asistencia total
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
