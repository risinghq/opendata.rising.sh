import { For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";

import {
  AnswerText,
  comparedActs,
  ligaAnswer,
  mcuAnswer,
  papalAnswer,
  type Answer,
} from "../components/Answer.tsx";
import { Figure } from "../components/Figure.tsx";
import {
  formatDateLima,
  formatDifference,
  formatMoneyCompact,
  formatPercent,
} from "../data/format.ts";
import type {
  AsistenciaRecord,
  EventRecord,
  TaquillaRecord,
  TemporadaRecord,
} from "../data/types.ts";
import { lineOf, type McuSnapshot } from "../forecast/mcu.ts";
import type { ForecastSnapshot } from "../forecast/snapshot.ts";

const KIND_ORDER = { temporada: 0, taquilla: 1, asistencia: 2 } as const;

/**
 * One row of a small figure. `from` and `to` are fractions of the plot width.
 * `note` sits under the plot, beside the mark it explains.
 */
interface Row {
  label: string;
  value: string;
  from: number;
  to: number;
  key?: boolean;
  range?: [number, number];
  note?: string;
}

/** `directions` labels the two sides of the axis, above the rows. */
function MiniBars(props: { rows: Row[]; axis?: number; directions?: [string, string] }) {
  return (
    <ol class="mini-bars">
      <Show when={props.directions}>
        {(directions) => (
          <li class="mini-directions" aria-hidden="true">
            <span class="mini-plot">
              <span>{directions()[0]}</span>
              <span>{directions()[1]}</span>
            </span>
          </li>
        )}
      </Show>
      <For each={props.rows}>
        {(row) => (
          <li class={row.key ? "key" : undefined}>
            <span class="mini-label">{row.label}</span>
            <span class="mini-plot" aria-hidden="true">
              <Show when={props.axis !== undefined}>
                <span class="mini-axis" style={`left: ${props.axis! * 100}%`} />
              </Show>
              <span
                class="mini-bar"
                style={`left: ${row.from * 100}%; width: ${(row.to - row.from) * 100}%`}
              />
              <Show when={row.range}>
                {(range) => (
                  <span
                    class="mini-range"
                    style={`left: ${range()[0] * 100}%; width: ${(range()[1] - range()[0]) * 100}%`}
                  />
                )}
              </Show>
            </span>
            <span class="mini-value">{row.value}</span>
            <Show when={row.note}>
              <span class="mini-note">{row.note}</span>
            </Show>
          </li>
        )}
      </For>
    </ol>
  );
}

function Entry(props: { event: EventRecord; answer: Answer; figure: JSX.Element }) {
  return (
    <article class="analysis">
      <div class="analysis-text">
        <h2>
          <a href={`/analisis/${props.event.slug}`}>{props.answer.question}</a>
        </h2>
        <AnswerText answer={props.answer} />
      </div>
      {props.figure}
    </article>
  );
}

function PlainEntry(props: { event: EventRecord }) {
  return (
    <article class="analysis">
      <div class="analysis-text">
        <p class="label">{formatDateLima(props.event.updated)}</p>
        <h2>
          <a href={`/analisis/${props.event.slug}`}>{props.event.title}</a>
        </h2>
        <p>{props.event.summary}</p>
      </div>
    </article>
  );
}

function LigaEntry(props: { event: TemporadaRecord; snapshot: ForecastSnapshot }) {
  const names = new Map(props.event.teams.map((team) => [team.id, team.name]));
  const name = (id: string) => names.get(id) ?? id;
  const top = [...props.snapshot.teams].sort((a, b) => b.season - a.season).slice(0, 4);
  const second = top[1];
  return (
    <Entry
      event={props.event}
      answer={ligaAnswer(props.event, props.snapshot)}
      figure={
        <Figure title="Probabilidad de ganar la temporada">
          <MiniBars
            rows={top.map((team, i) => ({
              label: name(team.team),
              value: formatPercent(team.season),
              from: 0,
              to: team.season,
              key: i === 0,
              // Percentage points: plain "puntos" would read as league points.
              note:
                i === 0 && second
                  ? `${Math.round((team.season - second.season) * 100)} puntos porcentuales más que ${name(second.team)}.`
                  : undefined,
            }))}
          />
        </Figure>
      }
    />
  );
}

function McuEntry(props: { event: TaquillaRecord; snapshot: McuSnapshot }) {
  const snap = props.snapshot;
  const opening = snap.predictions.opening;
  const avengers = snap.filmsUsed.filter((film) => lineOf(film.title) === "avengers");
  const max = Math.max(opening.high, ...avengers.map((film) => film.opening));
  const year = (date: string) => date.slice(0, 4);
  return (
    <Entry
      event={props.event}
      answer={mcuAnswer(snap)}
      figure={
        <Figure title="Estreno de las películas de Avengers">
          <MiniBars
            rows={[
              ...avengers.map((film) => ({
                label: `${film.title.replace(/^(The )?Avengers: /, "")} (${year(film.release)})`,
                value: formatMoneyCompact(film.opening),
                from: 0,
                to: film.opening / max,
              })),
              {
                label: `${snap.target.title.replace(/^Avengers: /, "")} (${year(snap.target.release)})`,
                value: formatMoneyCompact(opening.point),
                from: 0,
                to: opening.point / max,
                key: true,
                range: [opening.low / max, opening.high / max] as [number, number],
                note: `Pronóstico. Intervalo del ${formatPercent(snap.model.interval)}: de ${formatMoneyCompact(opening.low)} a ${formatMoneyCompact(opening.high)}.`,
              },
            ]}
          />
        </Figure>
      }
    />
  );
}

function PapalEntry(props: { event: AsistenciaRecord }) {
  const compared = comparedActs(props.event);
  const reach = Math.max(0.1, ...compared.map((c) => Math.abs(c.difference)));
  const at = (difference: number) => 0.5 + difference / reach / 2;
  const widest = compared.reduce<(typeof compared)[number] | undefined>(
    (best, c) => (best && Math.abs(best.difference) >= Math.abs(c.difference) ? best : c),
    undefined,
  );
  return (
    <Entry
      event={props.event}
      answer={papalAnswer(props.event)}
      figure={
        <Show when={compared.length > 0}>
          <Figure title="Asistencia frente a lo esperado">
            <MiniBars
              axis={0.5}
              directions={["← Por debajo", "Por encima →"]}
              rows={compared.map((c) => ({
                label: c.act.city,
                value: formatDifference(c.difference),
                from: Math.min(0.5, at(c.difference)),
                to: Math.max(0.5, at(c.difference)),
                key: c.difference < 0,
                note: c === widest ? "La mayor diferencia." : undefined,
              }))}
            />
          </Figure>
        </Show>
      }
    />
  );
}

export function Home(props: {
  events: EventRecord[];
  forecasts: Record<string, ForecastSnapshot | null>;
  mcu: McuSnapshot | null;
}) {
  const events = [...props.events].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return (
    <>
      <h1 class="visually-hidden">Análisis y pronósticos</h1>
      <For each={events}>
        {(event) => {
          if (event.kind === "temporada") {
            const snapshot = props.forecasts[event.slug];
            return snapshot ? (
              <LigaEntry event={event} snapshot={snapshot} />
            ) : (
              <PlainEntry event={event} />
            );
          }
          if (event.kind === "taquilla")
            return props.mcu ? (
              <McuEntry event={event} snapshot={props.mcu} />
            ) : (
              <PlainEntry event={event} />
            );
          return <PapalEntry event={event} />;
        }}
      </For>
    </>
  );
}
