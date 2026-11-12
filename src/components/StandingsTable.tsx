import { For } from "solid-js";

import { formatDecimal, formatNumber } from "../data/format.ts";
import type { Standing } from "../data/stats-temporada.ts";

function Abbr(props: { short: string; full: string }) {
  return <abbr title={props.full}>{props.short}</abbr>;
}

export function StandingsTable(props: {
  caption: string;
  rows: Standing[];
  teams: Map<string, string>;
}) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="standings-table">
        <caption class="visually-hidden">{props.caption}</caption>
        <thead>
          <tr>
            <th scope="col" class="num">
              <Abbr short="N.º" full="Puesto" />
            </th>
            <th scope="col">Equipo</th>
            <th scope="col" class="num">
              <Abbr short="PJ" full="Partidos jugados" />
            </th>
            <th scope="col" class="num">
              <Abbr short="G" full="Ganados" />
            </th>
            <th scope="col" class="num">
              <Abbr short="E" full="Empatados" />
            </th>
            <th scope="col" class="num">
              <Abbr short="P" full="Perdidos" />
            </th>
            <th scope="col" class="num">
              <Abbr short="GF" full="Goles a favor" />
            </th>
            <th scope="col" class="num">
              <Abbr short="GC" full="Goles en contra" />
            </th>
            <th scope="col" class="num">
              <Abbr short="DG" full="Diferencia de goles" />
            </th>
            <th scope="col" class="num">
              <Abbr short="Pts" full="Puntos" />
            </th>
            <th scope="col" class="num">
              <Abbr short="Pts/PJ" full="Puntos por partido" />
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row, index) => (
              <tr>
                <td class="num">{index() + 1}</td>
                <th scope="row">{props.teams.get(row.team)}</th>
                <td class="num">{row.played}</td>
                <td class="num">{row.won}</td>
                <td class="num">{row.drawn}</td>
                <td class="num">{row.lost}</td>
                <td class="num">{row.goalsFor}</td>
                <td class="num">{row.goalsAgainst}</td>
                <td class="num">{formatNumber(row.goalDifference)}</td>
                <td class="num strong">{row.points}</td>
                <td class="num">{formatDecimal(row.pointsPerMatch)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
