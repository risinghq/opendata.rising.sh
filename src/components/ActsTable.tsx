import { For, Show } from "solid-js";

import {
  formatLocalTime,
  formatNumber,
  formatShortDate,
  formatTimeLima,
  formatWeekday,
  isLimaOffset,
} from "../data/format.ts";
import { actDate } from "../data/stats.ts";
import type { Act, Source } from "../data/types.ts";

function Sources(props: { sources: Source[] }) {
  return (
    <ul class="sources">
      <For each={props.sources}>
        {(source) => (
          <li>
            <a href={source.url}>{source.outlet}</a>
          </li>
        )}
      </For>
    </ul>
  );
}

function Figure(props: { value?: number }) {
  return <td class="num">{props.value === undefined ? "" : formatNumber(props.value)}</td>;
}

function ActSources(props: { act: Act }) {
  const act = props.act;
  if (act.status === "held") {
    return (
      <>
        <p>{act.attribution}</p>
        <Sources sources={act.sources} />
      </>
    );
  }
  if (act.expected) {
    return (
      <>
        <p>{act.expected.attribution}</p>
        <Sources sources={[act.expected.source]} />
      </>
    );
  }
  return <p class="muted">Sin cifra esperada.</p>;
}

function ActRow(props: { act: Act }) {
  const act = props.act;
  const held = act.status === "held" ? act : undefined;
  const planned = act.status === "planned" ? act : undefined;
  return (
    <tr>
      <td class="col-when">
        <div>
          {formatWeekday(actDate(act))} {formatShortDate(actDate(act))}
        </div>
        <div class="muted">{formatLocalTime(act.start)}</div>
        <Show when={!isLimaOffset(act.start)}>
          <div class="muted">{formatTimeLima(act.start)} en Lima</div>
        </Show>
      </td>
      <th scope="row" class="col-act">
        <div>{act.name}</div>
        <div class="muted">{act.venue}</div>
      </th>
      <td class="col-place">
        <div>{act.city}</div>
        <div class="muted">{act.country}</div>
      </td>
      <td>{held ? "Realizado" : "Previsto"}</td>
      <Figure value={held?.low} />
      <Figure value={held?.central} />
      <Figure value={held?.high} />
      <Figure value={planned?.expected?.figure} />
      <td class="col-sources">
        <ActSources act={act} />
      </td>
    </tr>
  );
}

export function ActsTable(props: { acts: Act[] }) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="acts-table">
        <caption class="visually-hidden">
          Actos de la gira, con la asistencia estimada y sus fuentes
        </caption>
        <thead>
          <tr>
            <th scope="col">Inicio (hora local)</th>
            <th scope="col">Acto</th>
            <th scope="col">Lugar</th>
            <th scope="col">Estado</th>
            <th scope="col" class="num">
              Baja
            </th>
            <th scope="col" class="num">
              Central
            </th>
            <th scope="col" class="num">
              Alta
            </th>
            <th scope="col" class="num">
              Esperada
            </th>
            <th scope="col">Quién la informa y fuentes</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.acts}>{(act) => <ActRow act={act} />}</For>
        </tbody>
      </table>
    </div>
  );
}
