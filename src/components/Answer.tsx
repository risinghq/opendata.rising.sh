import { Show } from "solid-js";

import {
  formatCompactDateLima,
  formatCompactRange,
  formatDate,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
} from "../data/format.ts";
import { eventStatus } from "../data/stats.ts";
import { expectedDifference, heldActs, sumRange } from "../data/stats-asistencia.ts";
import type { AsistenciaRecord, EventRecord, HeldAct, TemporadaRecord } from "../data/types.ts";
import type { McuSnapshot } from "../forecast/mcu.ts";
import type { ForecastSnapshot } from "../forecast/snapshot.ts";

/** The question an analysis asks and its current answer. */
export interface Answer {
  question: string;
  figure: string;
  text: string;
}

export function ligaAnswer(event: TemporadaRecord, snapshot: ForecastSnapshot): Answer {
  const leader = [...snapshot.teams].sort((a, b) => b.season - a.season)[0]!;
  const name = event.teams.find((team) => team.id === leader.team)?.name ?? leader.team;
  return {
    question: "¿Quién gana la Liga 1 2026?",
    figure: formatPercent(leader.season),
    text: `Probabilidad de que ${name} gane la temporada, la más alta de la liga.`,
  };
}

export function mcuAnswer(snapshot: McuSnapshot): Answer {
  return {
    question: `¿Cuánto recaudará ${snapshot.target.title} en su estreno?`,
    figure: formatMoneyCompact(snapshot.predictions.opening.point),
    text:
      `Pronóstico de su primer fin de semana en EE. UU. y Canadá, en dólares de ` +
      `${snapshot.dollars}. Se estrena el ${formatDate(snapshot.target.release)}.`,
  };
}

/** Held acts that have a published expected figure, with the difference from it. */
export function comparedActs(event: AsistenciaRecord): { act: HeldAct; difference: number }[] {
  return heldActs(event).flatMap((act) => {
    const difference = expectedDifference(act);
    return difference === undefined ? [] : [{ act, difference }];
  });
}

export function papalAnswer(event: AsistenciaRecord): Answer {
  const held = heldActs(event);
  return {
    question: "¿Cuánta gente fue a ver a León XIV?",
    figure: formatNumber(sumRange(held).central),
    text: `Personas en los ${held.length} actos realizados de ${event.acts.length}, según la cifra central de cada acto.`,
  };
}

export function AnswerText(props: { answer: Answer }) {
  return (
    <div class="answer">
      <p class="answer-figure">{props.answer.figure}</p>
      <p>{props.answer.text}</p>
    </div>
  );
}

/** The event's title, dates, status and last update as one mono line. */
function Meta(props: { event: EventRecord; title: boolean }) {
  const status = eventStatus(props.event);
  return (
    <p class="label meta">
      <Show when={props.title}>
        <span>{props.event.title}</span>
      </Show>
      <span>{formatCompactRange(props.event.start, props.event.end)}</span>
      <span class="status" data-state={status}>
        {status}
      </span>
      <span>Actualizado {formatCompactDateLima(props.event.updated)}</span>
    </p>
  );
}

/**
 * The opening of an analysis page: the question as its heading and the answer.
 * Without a current answer the title is the heading, followed by the summary.
 */
export function Lede(props: { event: EventRecord; answer: Answer | null }) {
  return (
    <Show
      when={props.answer}
      fallback={
        <>
          <Meta event={props.event} title={false} />
          <h1 class="question">{props.event.title}</h1>
          <p class="lead">{props.event.summary}</p>
        </>
      }
    >
      {(answer) => (
        <>
          <Meta event={props.event} title={true} />
          <h1 class="question">{answer().question}</h1>
          <AnswerText answer={answer()} />
        </>
      )}
    </Show>
  );
}
