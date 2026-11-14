import { For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";

import { Figure } from "../components/Figure.tsx";
import {
  formatDateLima,
  formatDifference,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
} from "../data/format.ts";
import { expectedDifference, heldActs, sumRange } from "../data/stats-asistencia.ts";
import type {
  AsistenciaRecord,
  EventRecord,
  TaquillaRecord,
  TemporadaRecord,
} from "../data/types.ts";
import { lineOf, scoresOf, type FigureKey, type McuSnapshot } from "../forecast/mcu.ts";
import type { ForecastSnapshot } from "../forecast/snapshot.ts";

const KIND_ORDER = { temporada: 0, taquilla: 1, asistencia: 2 } as const;

/** One row of a small figure. `from` and `to` are fractions of the plot width. */
interface Row {
  label: string;
  value: string;
  from: number;
  to: number;
  key?: boolean;
  range?: [number, number];
}

function MiniBars(props: { rows: Row[]; axis?: number }) {
  return (
    <ol class="mini-bars">
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
          </li>
        )}
      </For>
    </ol>
  );
}

function Entry(props: {
  event: EventRecord;
  question: string;
  answer: JSX.Element;
  figure: JSX.Element;
  score: JSX.Element;
}) {
  return (
    <article class="analysis">
      <div class="analysis-text">
        <h2>
          <a href={`/analisis/${props.event.slug}`}>{props.question}</a>
        </h2>
        <div class="answer">{props.answer}</div>
        <p class="score">{props.score}</p>
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
  const leader = top[0]!;
  const bt = props.snapshot.backtest;
  const beatsBase = bt.model.logLoss < bt.baseRates.logLoss;
  const beatsOdds = bt.odds ? bt.model.logLoss < bt.odds.logLoss : undefined;
  return (
    <Entry
      event={props.event}
      question="¿Quién gana la Liga 1 2026?"
      answer={
        <>
          <p class="answer-figure">{formatPercent(leader.season)}</p>
          <p>{name(leader.team)} es la favorita para ganar la temporada.</p>
        </>
      }
      figure={
        <Figure title="Probabilidad de ganar la temporada">
          <MiniBars
            rows={top.map((team, i) => ({
              label: name(team.team),
              value: formatPercent(team.season),
              from: 0,
              to: team.season,
              key: i === 0,
            }))}
          />
        </Figure>
      }
      score={
        (beatsBase ? "Supera a las frecuencias base" : "No supera a las frecuencias base") +
        (beatsOdds === undefined
          ? "."
          : beatsOdds
            ? " y a las cuotas de Bet365."
            : beatsBase
              ? ", pero no a las cuotas de Bet365."
              : " ni a las cuotas de Bet365.")
      }
    />
  );
}

/** Whether the model's backtest error is at most that of its best baseline. */
function modelWins(snapshot: McuSnapshot, key: FigureKey): boolean {
  const { model, ...baselines } = scoresOf(snapshot.backtest, key);
  return model! <= Math.min(...Object.values(baselines));
}

function mcuScore(snapshot: McuSnapshot): string {
  const opening = modelWins(snapshot, "opening");
  const worldwide = modelWins(snapshot, "worldwide");
  if (opening && worldwide)
    return "Supera a su mejor base en el estreno y en la recaudación mundial.";
  if (opening) return "Supera a su mejor base en el estreno, pero no en la recaudación mundial.";
  if (worldwide) return "No supera a su mejor base en el estreno, sí en la recaudación mundial.";
  return "No supera a su mejor base ni en el estreno ni en la recaudación mundial.";
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
      question={`¿Cuánto recaudará ${snap.target.title} en su estreno?`}
      answer={
        <>
          <p class="answer-figure">{formatMoneyCompact(opening.point)}</p>
          <p>Primer fin de semana en EE. UU. y Canadá, en dólares de {snap.dollars}.</p>
        </>
      }
      figure={
        <Figure
          title="Estreno de las películas de Avengers"
          legend={
            <>
              <span class="key-ink">Estreno real</span>
              <span>Pronóstico</span>
              <span class="key-range">Intervalo</span>
            </>
          }
        >
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
              },
            ]}
          />
        </Figure>
      }
      score={mcuScore(snap)}
    />
  );
}

function PapalEntry(props: { event: AsistenciaRecord }) {
  const held = heldActs(props.event);
  const total = sumRange(held).central;
  const compared = held.flatMap((act) => {
    const difference = expectedDifference(act);
    return difference === undefined ? [] : [{ act, difference }];
  });
  const above = compared.filter((c) => c.difference > 0).length;
  const reach = Math.max(0.1, ...compared.map((c) => Math.abs(c.difference)));
  const at = (difference: number) => 0.5 + difference / reach / 2;
  return (
    <Entry
      event={props.event}
      question="¿Cuánta gente fue a ver a León XIV?"
      answer={
        <>
          <p class="answer-figure">{formatNumber(total)}</p>
          <p>
            Personas en {held.length} de {props.event.acts.length} actos.
          </p>
        </>
      }
      figure={
        <Show when={compared.length > 0}>
          <Figure title="Asistencia frente a lo esperado">
            <MiniBars
              axis={0.5}
              rows={compared.map((c) => ({
                label: c.act.city,
                value: formatDifference(c.difference),
                from: Math.min(0.5, at(c.difference)),
                to: Math.max(0.5, at(c.difference)),
                key: c.difference < 0,
              }))}
            />
          </Figure>
        </Show>
      }
      score={
        compared.length === 0
          ? "Todavía no hay actos con una cifra esperada publicada."
          : `${above} de ${compared.length} actos ${above === 1 ? "superó" : "superaron"} la cifra esperada.`
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
