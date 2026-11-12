import { For, Show } from "solid-js";

import { AltitudeChart, AltitudeTable } from "../components/AltitudeChart.tsx";
import { ForecastTable, MatchForecastTable } from "../components/ForecastTable.tsx";
import { GoalTimingChart, GoalTimingTable } from "../components/GoalTimingChart.tsx";
import { RoundTable } from "../components/RoundsList.tsx";
import { StandingsTable } from "../components/StandingsTable.tsx";
import {
  formatDate,
  formatDateLima,
  formatDateRange,
  formatDecimal,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatStamp,
} from "../data/format.ts";
import {
  MATCH_DATA_NOTICE,
  MATCH_DATA_URL,
  hasMatchEvents,
  tournamentNotice,
} from "../data/notice.ts";
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
import { goalTiming } from "../forecast/events.ts";
import type { PublishedScore } from "../forecast/scoring.ts";
import type { ForecastSnapshot } from "../forecast/snapshot.ts";
import { SITE_URL } from "../site.ts";

export function TemporadaPage(props: {
  event: TemporadaRecord;
  forecast?: ForecastSnapshot | null;
  scores?: PublishedScore[];
}) {
  const event = props.event;
  const figures = keyFigures(event);
  const status = eventStatus(event);
  const teams = new Map(event.teams.map((team) => [team.id, team.name]));
  const stadiums = new Map(event.stadiums.map((stadium) => [stadium.id, stadium]));
  const points = altitudePoints(event);
  const forecast = props.forecast ?? null;
  const timing = hasMatchEvents(event) ? goalTiming(event) : null;
  const backtest = forecast?.backtest;
  const scores = props.scores ?? [];
  const scored = scores.filter((s) => s.model !== null);
  const pending = scores.filter((s) => s.model === null);
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

      <Show when={forecast}>
        {(snap) => (
          <section class="section" aria-labelledby="pronostico">
            <h2 id="pronostico">Pronóstico</h2>
            <p>
              Probabilidades calculadas el {formatDateLima(`${snap().date}T12:00-05:00`)} con{" "}
              {formatNumber(snap().simulations)} simulaciones de los partidos que faltan. El modelo
              usa los {snap().matchesUsed.length} partidos jugados.
            </p>
            <ForecastTable snapshot={snap()} teams={teams} />
            <Show when={snap().matches.length > 0}>
              <div class="block">
                <h3>Partidos por jugar</h3>
                <MatchForecastTable snapshot={snap()} teams={teams} />
              </div>
            </Show>
          </section>
        )}
      </Show>

      <Show when={backtest}>
        {(bt) => (
          <section class="section" aria-labelledby="acierto">
            <h2 id="acierto">Qué tan bien acierta</h2>
            <p>
              Para medir el modelo se repitió el pronóstico hacia atrás: antes de cada fecha del
              Clausura se ajustó solo con los partidos anteriores y se predijo esa fecha. Se compara
              con dos bases: las frecuencias de local, empate y visita de los mismos partidos, y las
              cuotas de cierre de Bet365 convertidas a probabilidades.
            </p>
            <div class="table-scroll" tabindex="0">
              <table class="backtest-table">
                <caption class="visually-hidden">
                  Error del modelo y de las dos bases en las fechas pasadas del Clausura
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Pronóstico</th>
                    <th scope="col" class="num">
                      Error logarítmico
                    </th>
                    <th scope="col" class="num">
                      Error de Brier
                    </th>
                    <th scope="col" class="num">
                      Partidos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">El modelo</th>
                    <td class="num strong">{formatDecimal(bt().model.logLoss)}</td>
                    <td class="num strong">{formatDecimal(bt().model.brier)}</td>
                    <td class="num">{bt().model.matches}</td>
                  </tr>
                  <tr>
                    <th scope="row">Frecuencias base</th>
                    <td class="num">{formatDecimal(bt().baseRates.logLoss)}</td>
                    <td class="num">{formatDecimal(bt().baseRates.brier)}</td>
                    <td class="num">{bt().baseRates.matches}</td>
                  </tr>
                  <Show when={bt().odds}>
                    {(odds) => (
                      <tr>
                        <th scope="row">Cuotas de Bet365</th>
                        <td class="num">{formatDecimal(odds().logLoss)}</td>
                        <td class="num">{formatDecimal(odds().brier)}</td>
                        <td class="num">{odds().matches}</td>
                      </tr>
                    )}
                  </Show>
                </tbody>
              </table>
            </div>
            <p>
              Menos error es mejor.
              {bt().odds && bt().model.logLoss <= bt().odds!.logLoss
                ? " El modelo acierta mejor que las cuotas en este tramo."
                : bt().odds
                  ? " El modelo no supera a las cuotas en este tramo."
                  : " No hubo cuotas suficientes para comparar."}
            </p>
          </section>
        )}
      </Show>

      <Show when={scores.length > 0}>
        <section class="section" aria-labelledby="publicados">
          <h2 id="publicados">Pronósticos publicados</h2>
          <p>
            Cada pronóstico publicado se guarda con su fecha y no se vuelve a tocar. Aquí se anota
            con los partidos que se jugaron después de esa fecha: sus probabilidades y las
            frecuencias base que llevaba. Menos error es mejor.
          </p>
          <Show when={scored.length > 0}>
            <div class="table-scroll" tabindex="0">
              <table class="backtest-table">
                <caption class="visually-hidden">
                  Puntaje de cada pronóstico publicado en los partidos jugados después de su fecha
                </caption>
                <thead>
                  <tr>
                    <th scope="col" rowspan="2">
                      Pronóstico
                    </th>
                    <th scope="col" rowspan="2" class="num">
                      Partidos
                    </th>
                    <th scope="colgroup" colspan="2">
                      El modelo
                    </th>
                    <th scope="colgroup" colspan="2">
                      Frecuencias base
                    </th>
                  </tr>
                  <tr>
                    <th scope="col" class="num">
                      Error logarítmico
                    </th>
                    <th scope="col" class="num">
                      Error de Brier
                    </th>
                    <th scope="col" class="num">
                      Error logarítmico
                    </th>
                    <th scope="col" class="num">
                      Error de Brier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={scored}>
                    {(row) => (
                      <tr>
                        <th scope="row" class="nowrap">
                          {formatDate(row.date)}
                        </th>
                        <td class="num">{row.matches}</td>
                        <td class="num strong">{formatDecimal(row.model!.logLoss)}</td>
                        <td class="num strong">{formatDecimal(row.model!.brier)}</td>
                        <td class="num">
                          {row.baseRates ? formatDecimal(row.baseRates.logLoss) : ""}
                        </td>
                        <td class="num">
                          {row.baseRates ? formatDecimal(row.baseRates.brier) : ""}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
          <For each={pending}>
            {(row) => (
              <p>{formatDate(row.date)}: Todavía no se jugó ningún partido de este pronóstico.</p>
            )}
          </For>
        </section>
      </Show>

      <Show when={timing}>
        {(periods) => (
          <section class="section" aria-labelledby="goles">
            <h2 id="goles">Cuándo caen los goles</h2>
            <p>
              Goles por tramo de 15 minutos en los partidos con datos de eventos. Los minutos de
              descuento entran en el último tramo de su tiempo.
            </p>
            <GoalTimingChart periods={periods()} />
            <GoalTimingTable periods={periods()} />
          </section>
        )}
      </Show>

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
        <Show when={forecast}>
          {(snap) => (
            <p>
              El pronóstico ajusta un modelo de goles de Poisson: cada equipo tiene una fuerza de
              ataque y una de defensa, jugar de local suma una ventaja que crece con la diferencia
              de altitud entre el estadio del partido y el del visitante, y los partidos antiguos
              pesan menos que los recientes. Con esas fuerzas se simularon los partidos que faltan{" "}
              {formatNumber(snap().simulations)} veces, aplicando las reglas de la liga: puntos,
              desempates, el playoff por el título y el descenso de los dos últimos de la tabla
              acumulada. El modelo no ve lesiones, fichajes ni motivación; trata a todos los equipos
              como si llegaran igual a cada partido.
            </p>
          )}
        </Show>
        <ul class="notices">
          <For each={event.tournaments}>
            {(tournament) => (
              <li>
                {tournamentNotice(tournament)}:{" "}
                <a href={tournament.source.url}>{tournament.name}</a>.
              </li>
            )}
          </For>
          <Show when={hasMatchEvents(event)}>
            <li>
              Datos de partidos: <a href={MATCH_DATA_URL}>Football data by 5DollarFootballAPI</a>.
            </li>
          </Show>
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
