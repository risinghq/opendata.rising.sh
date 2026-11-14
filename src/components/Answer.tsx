import { Show } from "solid-js";

import { formatMoneyCompact, formatNumber, formatPercent } from "../data/format.ts";
import { expectedDifference, heldActs, sumRange } from "../data/stats-asistencia.ts";
import type { AsistenciaRecord, EventRecord, HeldAct, TemporadaRecord } from "../data/types.ts";
import { scoresOf, type FigureKey, type McuSnapshot } from "../forecast/mcu.ts";
import type { ForecastSnapshot } from "../forecast/snapshot.ts";

/** The question an analysis asks, its current answer, and how the model fares. */
export interface Answer {
  question: string;
  figure: string;
  text: string;
  score: string;
}

export function ligaAnswer(event: TemporadaRecord, snapshot: ForecastSnapshot): Answer {
  const leader = [...snapshot.teams].sort((a, b) => b.season - a.season)[0]!;
  const name = event.teams.find((team) => team.id === leader.team)?.name ?? leader.team;
  const bt = snapshot.backtest;
  const beatsBase = bt.model.logLoss < bt.baseRates.logLoss;
  const beatsOdds = bt.odds ? bt.model.logLoss < bt.odds.logLoss : undefined;
  return {
    question: "¿Quién gana la Liga 1 2026?",
    figure: formatPercent(leader.season),
    text: `${name} es la favorita para ganar la temporada.`,
    score:
      (beatsBase ? "Supera a las frecuencias base" : "No supera a las frecuencias base") +
      (beatsOdds === undefined
        ? "."
        : beatsOdds
          ? " y a las cuotas de Bet365."
          : beatsBase
            ? ", pero no a las cuotas de Bet365."
            : " ni a las cuotas de Bet365."),
  };
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

export function mcuAnswer(snapshot: McuSnapshot): Answer {
  return {
    question: `¿Cuánto recaudará ${snapshot.target.title} en su estreno?`,
    figure: formatMoneyCompact(snapshot.predictions.opening.point),
    text: `Primer fin de semana en EE. UU. y Canadá, en dólares de ${snapshot.dollars}.`,
    score: mcuScore(snapshot),
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
  const compared = comparedActs(event);
  const above = compared.filter((c) => c.difference > 0).length;
  return {
    question: "¿Cuánta gente fue a ver a León XIV?",
    figure: formatNumber(sumRange(held).central),
    text: `Personas en ${held.length} de ${event.acts.length} actos.`,
    score:
      compared.length === 0
        ? "Todavía no hay actos con una cifra esperada publicada."
        : `${above} de ${compared.length} actos ${above === 1 ? "superó" : "superaron"} la cifra esperada.`,
  };
}

export function AnswerText(props: { answer: Answer }) {
  return (
    <>
      <div class="answer">
        <p class="answer-figure">{props.answer.figure}</p>
        <p>{props.answer.text}</p>
      </div>
      <p class="score">{props.answer.score}</p>
    </>
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
          <h1>{props.event.title}</h1>
          <p class="lead">{props.event.summary}</p>
        </>
      }
    >
      {(answer) => (
        <>
          <p class="label">{props.event.title}</p>
          <h1 class="question">{answer().question}</h1>
          <AnswerText answer={answer()} />
        </>
      )}
    </Show>
  );
}
