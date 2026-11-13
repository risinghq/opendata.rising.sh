import { For } from "solid-js";

import { formatDecimal } from "../data/format.ts";
import type { TeamAverage } from "../data/stats-temporada.ts";

export function TeamStatsTable(props: { rows: TeamAverage[]; teams: Map<string, string> }) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="team-stats-table">
        <caption class="visually-hidden">
          Promedio por partido de cada equipo en los partidos con estadísticas
        </caption>
        <thead>
          <tr>
            <th scope="col">Equipo</th>
            <th scope="col" class="num">
              Partidos
            </th>
            <th scope="col" class="num">
              Posesión (%)
            </th>
            <th scope="col" class="num">
              Tiros al arco a favor
            </th>
            <th scope="col" class="num">
              Tiros al arco en contra
            </th>
            <th scope="col" class="num">
              Ataques peligrosos
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => (
              <tr>
                <th scope="row">{props.teams.get(row.team)}</th>
                <td class="num">{row.matches}</td>
                <td class="num">{formatDecimal(row.possession)}</td>
                <td class="num">{formatDecimal(row.shotsOnTarget)}</td>
                <td class="num">{formatDecimal(row.shotsOnTargetAgainst)}</td>
                <td class="num">{formatDecimal(row.dangerousAttacks)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
