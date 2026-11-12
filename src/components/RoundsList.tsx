import { For, Show } from "solid-js";

import { formatLocalTime, formatShortDate, formatWeekday } from "../data/format.ts";
import { actDate } from "../data/stats-asistencia.ts";
import type { Match, Stadium } from "../data/types.ts";

function Score(props: { match: Match }) {
  const match = props.match;
  if (match.status === "planned") return <span class="muted">Por jugar</span>;
  return (
    <>
      {match.homeScore} – {match.awayScore}
    </>
  );
}

function winner(match: Match, side: "home" | "away"): boolean {
  if (match.status !== "held") return false;
  return side === "home" ? match.homeScore > match.awayScore : match.awayScore > match.homeScore;
}

export function RoundTable(props: {
  caption: string;
  matches: Match[];
  teams: Map<string, string>;
  stadiums: Map<string, Stadium>;
}) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="matches-table">
        <caption class="visually-hidden">{props.caption}</caption>
        <thead>
          <tr>
            <th scope="col">Inicio (hora de Lima)</th>
            <th scope="col" class="home-team">
              Local
            </th>
            <th scope="col" class="num">
              Resultado
            </th>
            <th scope="col">Visitante</th>
            <th scope="col">Estadio</th>
            <th scope="col">Árbitro</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.matches}>
            {(match) => (
              <tr data-state={match.status}>
                <td>
                  {formatWeekday(actDate(match))} {formatShortDate(actDate(match))}
                  <div class="muted">{formatLocalTime(match.start)}</div>
                </td>
                <td class={winner(match, "home") ? "home-team strong" : "home-team"}>
                  {props.teams.get(match.home)}
                </td>
                <td class="num score">
                  <Score match={match} />
                </td>
                <td class={winner(match, "away") ? "strong" : undefined}>
                  {props.teams.get(match.away)}
                </td>
                <td>
                  {props.stadiums.get(match.stadium)?.name}
                  <div class="muted">{props.stadiums.get(match.stadium)?.city}</div>
                </td>
                <td>
                  <Show when={match.referee} fallback={<span class="muted">Sin designar</span>}>
                    {match.referee}
                  </Show>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
