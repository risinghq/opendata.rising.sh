import { For } from "solid-js";

import { formatChance, formatPercent, formatShortDate } from "../data/format.ts";
import { actDate } from "../data/stats-asistencia.ts";
import type { ForecastSnapshot } from "../forecast/snapshot.ts";

function Chance(props: { value: number }) {
  return (
    <td class="num">
      {formatChance(props.value)}
      <span class="prob-bar" aria-hidden="true">
        <span style={`width: ${Math.min(props.value * 100, 100)}%`} />
      </span>
    </td>
  );
}

export function ForecastTable(props: { snapshot: ForecastSnapshot; teams: Map<string, string> }) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="forecast-table">
        <caption class="visually-hidden">
          Probabilidad de cada equipo de ganar el Clausura y la temporada y de descender
        </caption>
        <thead>
          <tr>
            <th scope="col">Equipo</th>
            <th scope="col" class="num">
              Gana el Clausura
            </th>
            <th scope="col" class="num">
              Campeón de la temporada
            </th>
            <th scope="col" class="num">
              Desciende
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.snapshot.teams}>
            {(row) => (
              <tr>
                <th scope="row">{props.teams.get(row.team)}</th>
                <Chance value={row.clausura} />
                <Chance value={row.season} />
                <Chance value={row.relegation} />
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

export function MatchForecastTable(props: {
  snapshot: ForecastSnapshot;
  teams: Map<string, string>;
}) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="forecast-matches-table">
        <caption class="visually-hidden">
          Probabilidades de local, empate y visita para cada partido por jugar
        </caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col" class="home-team">
              Local
            </th>
            <th scope="col">Visitante</th>
            <th scope="col" class="num">
              Local
            </th>
            <th scope="col" class="num">
              Empate
            </th>
            <th scope="col" class="num">
              Visita
            </th>
            <th scope="col" class="num">
              Goles esperados
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.snapshot.matches}>
            {(m) => (
              <tr>
                <td class="nowrap">{formatShortDate(actDate(m))}</td>
                <td class="home-team">{props.teams.get(m.home)}</td>
                <td>{props.teams.get(m.away)}</td>
                <td class="num">{formatPercent(m.pHome)}</td>
                <td class="num">{formatPercent(m.pDraw)}</td>
                <td class="num">{formatPercent(m.pAway)}</td>
                <td class="num muted">{`${m.xHome.toFixed(2)} – ${m.xAway.toFixed(2)}`}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
