import { For, Show } from "solid-js";

import { FilmsTable } from "../components/FilmsTable.tsx";
import { GrossChart, grossPoints, GrossTable } from "../components/GrossChart.tsx";
import { latestYear, loadCpi } from "../data/cpi.ts";
import {
  formatDateLima,
  formatDateRange,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatStamp,
} from "../data/format.ts";
import { taquillaNotice } from "../data/notice.ts";
import { eventStatus } from "../data/stats.ts";
import {
  filmYear,
  isReleased,
  keyFigures,
  realAmount,
  releasedFilms,
} from "../data/stats-taquilla.ts";
import type { TaquillaRecord } from "../data/types.ts";
import type { FigureKey, McuSnapshot } from "../forecast/mcu.ts";
import { SITE_URL } from "../site.ts";

const FIGURE_LABEL: Record<FigureKey, string> = {
  opening: "Fin de semana de estreno, EE. UU. y Canadá",
  worldwide: "Recaudación mundial",
};

export function TaquillaPage(props: { event: TaquillaRecord; forecast?: McuSnapshot | null }) {
  const event = props.event;
  const cpi = loadCpi();
  const figures = keyFigures(event, cpi);
  const status = eventStatus(event);
  const points = grossPoints(releasedFilms(event), cpi);
  const forecast = props.forecast ?? null;
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
            <a href="#metodo">Wikipedia en inglés, CC BY-SA 4.0</a>
          </dd>
        </div>
      </dl>

      <section class="section" aria-labelledby="cifras">
        <h2 id="cifras" class="visually-hidden">
          Cifras clave
        </h2>
        <dl class="figures">
          <div>
            <dt>Películas estrenadas</dt>
            <dd class="value">
              {figures.released} de {figures.total}
            </dd>
            <dd class="note">{figures.total - figures.released} por estrenar</dd>
          </div>
          <div>
            <dt>Recaudación mundial</dt>
            <dd class="value">{formatMoneyCompact(figures.worldwide)}</dd>
            <dd class="note">
              {formatMoneyCompact(figures.worldwideReal)} en dólares de {cpi.base}
            </dd>
          </div>
          <div>
            <dt>Mediana mundial</dt>
            <dd class="value">{formatMoneyCompact(figures.medianWorldwide)}</dd>
            <dd class="note">
              {formatMoneyCompact(figures.medianReal)} en dólares de {cpi.base}
            </dd>
          </div>
          <div>
            <dt>Película más taquillera</dt>
            <dd class="value top">{figures.top.title}</dd>
            <dd class="note">{formatMoneyCompact(figures.top.worldwide.amount)} mundial</dd>
          </div>
        </dl>
      </section>

      <section class="section" aria-labelledby="peliculas">
        <h2 id="peliculas">Películas</h2>
        <p>
          Todas las películas en orden de estreno. Cada cifra nominal va seguida de su valor en
          dólares de {cpi.base}, en letra pequeña. El fin de semana de estreno y la recaudación de
          EE. UU. y Canadá son taquilla doméstica; la mundial es la suma de todos los mercados.
        </p>
        <FilmsTable films={event.films} cpi={cpi} />
      </section>

      <section class="section" aria-labelledby="en-el-tiempo">
        <h2 id="en-el-tiempo">Taquilla en el tiempo</h2>
        <p>
          Recaudación mundial de cada estreno en dólares de {cpi.base}, para comparar películas de
          años distintos con el mismo dinero.
        </p>
        <GrossChart points={points} dollars={cpi.base} />
        <div class="block">
          <h3>Cifras del gráfico</h3>
          <GrossTable points={points} dollars={cpi.base} />
        </div>
      </section>

      <Show when={forecast}>
        {(snap) => {
          const bt = snap().backtest;
          const target = event.films.find((f) => f.title === snap().target.title);
          const actual = target && isReleased(target) ? target : null;
          return (
            <section class="section" aria-labelledby="pronostico">
              <h2 id="pronostico">Pronóstico: {snap().target.title}</h2>
              <p>
                Foto calculada el {formatDateLima(`${snap().date}T12:00-05:00`)} con los{" "}
                {snap().filmsUsed.length} estrenos publicados hasta ese día, en dólares de{" "}
                {snap().dollars}. El estreno está previsto para el{" "}
                {formatDateLima(`${snap().target.release}T12:00-05:00`)}.
              </p>
              <div class="table-scroll" tabindex="0">
                <table class="forecast-table">
                  <caption class="visually-hidden">
                    Cifras previstas para {snap().target.title} con su intervalo
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Cifra</th>
                      <th scope="col" class="num">
                        Pronóstico
                      </th>
                      <th scope="col" class="num">
                        Intervalo del {formatPercent(snap().model.interval)}
                      </th>
                      <Show when={actual}>
                        <th scope="col" class="num">
                          Real (dólares de {snap().dollars})
                        </th>
                        <th scope="col">Dentro del intervalo</th>
                      </Show>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={Object.keys(FIGURE_LABEL) as FigureKey[]}>
                      {(key) => {
                        const real = actual
                          ? realAmount(actual[key].amount, actual, cpi, snap().dollars)
                          : undefined;
                        const inside =
                          real !== undefined &&
                          real >= snap().predictions[key].low &&
                          real <= snap().predictions[key].high;
                        return (
                          <tr>
                            <th scope="row">{FIGURE_LABEL[key]}</th>
                            <td class="num strong">{formatMoney(snap().predictions[key].point)}</td>
                            <td class="num">
                              {formatMoney(snap().predictions[key].low)} –{" "}
                              {formatMoney(snap().predictions[key].high)}
                            </td>
                            <Show when={real !== undefined}>
                              <td class="num">{formatMoney(real!)}</td>
                              <td>{inside ? "Sí" : "No"}</td>
                            </Show>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
              <p>
                Para medirlo, el mismo modelo se entrenó hacia atrás con {bt.cases} películas: cada
                película de Avengers y cada uno de los últimos diez estrenos se predijo usando solo
                las películas anteriores. El error mediano del modelo es{" "}
                {formatPercent(bt.byFigure.worldwide.model)} en la recaudación mundial y{" "}
                {formatPercent(bt.byFigure.opening.model)} en el fin de semana de estreno, contra{" "}
                {formatPercent(bt.byFigure.worldwide.naive)} y{" "}
                {formatPercent(bt.byFigure.opening.naive)} de la base ingenua (la cifra de la
                película anterior).
                {bt.byFigure.worldwide.model <= bt.byFigure.worldwide.naive &&
                bt.byFigure.opening.model <= bt.byFigure.opening.naive
                  ? " El modelo supera a la base en las dos cifras."
                  : " El modelo no supera a la base en las dos cifras, así que el pronóstico va con esa advertencia."}
              </p>
            </section>
          );
        }}
      </Show>

      <section class="section" aria-labelledby="metodo">
        <h2 id="metodo">Método</h2>
        <p>{event.method}</p>
        <Show when={forecast}>
          {(snap) => (
            <p>
              El pronóstico ajusta por mínimos cuadrados una recta sobre el logaritmo de cada cifra
              en dólares de {snap().dollars}: cuánto recaudó la película anterior, cuánto recaudó la
              anterior de la misma serie (para Avengers: Doomsday, Avengers: Endgame) y cuántos años
              lleva la saga. El intervalo sale de los errores que comete el modelo al dejar fuera
              cada película. Es un ejercicio estadístico, no una predicción comercial.
            </p>
          )}
        </Show>
        <ul class="notices">
          <li>
            {taquillaNotice(event)}: <a href={event.source.url}>{event.source.outlet}</a>.
          </li>
          <li>
            Ajuste por inflación: promedios anuales del índice de precios al consumidor de Estados
            Unidos (serie CUUR0000SA0),{" "}
            <a href="https://www.bls.gov/cpi/data.htm">U.S. Bureau of Labor Statistics</a>. Valores
            reales en dólares de {cpi.base}.
          </li>
          <Show when={releasedFilms(event).some((f) => filmYear(f) > latestYear(cpi))}>
            <li>
              Las películas estrenadas después del último año con índice disponible usan ese índice,
              el de {latestYear(cpi)}, como aproximación.
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
              Películas en CSV
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
