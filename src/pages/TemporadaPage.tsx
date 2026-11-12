import { For, Show } from "solid-js";

import { AltitudeChart, AltitudeTable } from "../components/AltitudeChart.tsx";
import { RoundTable } from "../components/RoundsList.tsx";
import { StandingsTable } from "../components/StandingsTable.tsx";
import {
  formatDateLima,
  formatDateRange,
  formatDecimal,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatStamp,
} from "../data/format.ts";
import { tournamentNotice } from "../data/notice.ts";
import { actDate } from "../data/stats-asistencia.ts";
import {
  altitudePoints,
  currentRounds,
  keyFigures,
  MIN_MATCHES_PER_STADIUM,
  rounds,
  standings,
} from "../data/stats-temporada.ts";
import { eventStatus } from "../data/stats.ts";
import type { TemporadaRecord } from "../data/types.ts";
import { SITE_URL } from "../site.ts";

export function TemporadaPage(props: { event: TemporadaRecord }) {
  const event = props.event;
  const figures = keyFigures(event);
  const status = eventStatus(event);
  const teams = new Map(event.teams.map((team) => [team.id, team.name]));
  const stadiums = new Map(event.stadiums.map((stadium) => [stadium.id, stadium]));
  const points = altitudePoints(event);
  const share = (count: number) =>
    figures.held === 0 ? "0 %" : formatPercent(count / figures.held);
  const url = `${SITE_URL}/eventos/${event.slug}`;

  return (
    <>
      <h1>{event.title}</h1>
      <p class="lead">{event.summary}</p>
      <dl class="facts">
        <div>
          <dt>Fechas</dt>
          <dd>{formatDateRange(event.start, event.end)}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd class="status" data-state={status}>
            {status}
          </dd>
        </div>
        <div>
          <dt>Actualizado</dt>
          <dd>{formatStamp(event.updated)}</dd>
        </div>
        <div>
          <dt>Fuente</dt>
          <dd>
            <a href="#metodo">Wikipedia en español, CC BY-SA 4.0</a>
          </dd>
        </div>
      </dl>

      <section class="section" aria-labelledby="cifras">
        <h2 id="cifras" class="visually-hidden">
          Cifras clave
        </h2>
        <dl class="figures">
          <div>
            <dt>Partidos jugados</dt>
            <dd class="value">
              {figures.held} de {figures.total}
            </dd>
            <dd class="note">
              {figures.total - figures.held === 0
                ? "Todos jugados"
                : `${figures.total - figures.held} por jugar`}
            </dd>
          </div>
          <div>
            <dt>Goles por partido</dt>
            <dd class="value">{formatDecimal(figures.goalsPerMatch)}</dd>
            <dd class="note">{formatNumber(figures.goals)} goles en total</dd>
          </div>
          <div>
            <dt>Gana el local</dt>
            <dd class="value">{share(figures.homeWins)}</dd>
            <dd class="note">
              Empatan {share(figures.draws)}. Gana la visita {share(figures.awayWins)}.
            </dd>
          </div>
        </dl>
      </section>

      <section class="section" aria-labelledby="posiciones">
        <h2 id="posiciones">Tabla de posiciones</h2>
        <p>
          La tabla sale de los resultados de este archivo: 3 puntos por victoria, 1 por empate.
          Ordena por puntos, diferencia de goles y goles a favor. La tabla oficial puede diferir por
          sanciones administrativas, como puntos descontados o partidos dados por ganados en un
          fallo, que los marcadores no reflejan.
        </p>
        <For each={event.tournaments}>
          {(tournament) => (
            <div class="block">
              <h3>{tournament.name}</h3>
              <StandingsTable
                caption={`Posiciones del ${tournament.name}`}
                rows={standings(event, tournament.id)}
                teams={teams}
              />
            </div>
          )}
        </For>
        <div class="block">
          <h3>Acumulada de los dos torneos</h3>
          <StandingsTable
            caption="Posiciones acumuladas de los dos torneos"
            rows={standings(event)}
            teams={teams}
          />
        </div>
      </section>

      <Show when={points.length > 1}>
        <section class="section" aria-labelledby="altitud">
          <h2 id="altitud">Ventaja de local por altitud</h2>
          <p>
            Puntos que sumó el local por partido en cada estadio, frente a la altitud del estadio.
            Solo entran los estadios con al menos {MIN_MATCHES_PER_STADIUM} partidos jugados.
            Algunos estadios los usan varios equipos, así que un punto mezcla la fuerza de esos
            equipos con la altitud.
          </p>
          <AltitudeChart points={points} />
          <AltitudeTable points={points} />
        </section>
      </Show>

      <section class="section" aria-labelledby="resultados">
        <h2 id="resultados">Resultados por fecha</h2>
        <p>
          Cada fecha lista todos sus partidos. Los partidos por jugar no tienen resultado y no
          entran en ninguna cifra. Se abren la última fecha con partidos jugados y la siguiente.
        </p>
        <For each={event.tournaments}>
          {(tournament) => {
            const open = currentRounds(event, tournament.id);
            return (
              <div class="block">
                <h3>{tournament.name}</h3>
                <For each={[...rounds(event, tournament.id)]}>
                  {([round, matches]) => {
                    const held = matches.filter((m) => m.status === "held").length;
                    return (
                      <details class="round" open={open.has(round)}>
                        <summary>
                          <span class="round-name">Fecha {round}</span>
                          <span class="muted">
                            {formatShortDate(actDate(matches[0]!))}
                            {" a "}
                            {formatShortDate(actDate(matches.at(-1)!))}
                            {held === matches.length ? "" : `, ${matches.length - held} por jugar`}
                          </span>
                        </summary>
                        <RoundTable
                          caption={`${tournament.name}, fecha ${round}`}
                          matches={matches}
                          teams={teams}
                          stadiums={stadiums}
                        />
                      </details>
                    );
                  }}
                </For>
              </div>
            );
          }}
        </For>
      </section>

      <section class="section" aria-labelledby="metodo">
        <h2 id="metodo">Método</h2>
        <p>{event.method}</p>
        <ul class="notices">
          <For each={event.tournaments}>
            {(tournament) => (
              <li>
                {tournamentNotice(tournament)}:{" "}
                <a href={tournament.source.url}>{tournament.name}</a>.
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="section" aria-labelledby="descargas">
        <h2 id="descargas">Descargas</h2>
        <ul class="downloads">
          <li>
            <a class="link-block" href={`/eventos/${event.slug}.json`}>
              Datos en JSON
            </a>
          </li>
          <li>
            <a class="link-block" href={`/eventos/${event.slug}.csv`}>
              Partidos en CSV
            </a>
          </li>
        </ul>
        <p class="muted">Los dos archivos llevan el aviso de la fuente y la licencia.</p>
      </section>

      <section class="section" aria-labelledby="citar">
        <h2 id="citar">Cómo citar</h2>
        <p class="cite">
          {event.title}. Datos abiertos, actualizado el {formatDateLima(event.updated)}. {url}
        </p>
      </section>
    </>
  );
}
