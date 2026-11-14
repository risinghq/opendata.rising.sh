import { Show } from "solid-js";

import { FilmsTable } from "../components/FilmsTable.tsx";
import { GrossChart, grossPoints, GrossTable } from "../components/GrossChart.tsx";
import { McuForecast } from "../components/McuForecast.tsx";
import { latestYear, loadCpi } from "../data/cpi.ts";
import {
  formatDateLima,
  formatDateRange,
  formatMoneyCompact,
  formatStamp,
} from "../data/format.ts";
import { taquillaNotice } from "../data/notice.ts";
import { eventStatus } from "../data/stats.ts";
import { filmYear, keyFigures, releasedFilms } from "../data/stats-taquilla.ts";
import type { TaquillaRecord } from "../data/types.ts";
import type { McuSnapshot } from "../forecast/mcu.ts";
import { SITE_NAME, SITE_URL } from "../site.ts";

export function TaquillaPage(props: {
  event: TaquillaRecord;
  forecast?: McuSnapshot | null;
  earlier?: McuSnapshot[];
}) {
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
        {(snap) => (
          <McuForecast event={event} cpi={cpi} forecast={snap()} earlier={props.earlier ?? []} />
        )}
      </Show>

      <section class="section" aria-labelledby="metodo">
        <h2 id="metodo">Método</h2>
        <p>{event.method}</p>
        <Show when={forecast}>
          {(snap) => (
            <>
              <p>
                El modelo estima el fin de semana de estreno con una regresión de cresta sobre el
                logaritmo de la cifra en dólares de {snap().dollars}. Usa dos datos: si la película
                tiene una anterior en su serie y, de ser así, cuánto fue el estreno de esa anterior,
                medido contra el promedio de las películas que tienen anterior. La recaudación
                mundial es el estreno por la media geométrica de la razón entre recaudación mundial
                y estreno de las películas ya estrenadas. Los intervalos salen de los errores que
                comete cada etapa al dejar fuera una película, y la recaudación mundial se simula
                con los dos errores a la vez, con una semilla fija.
              </p>
              <p>
                Antes de publicar, el modelo se compara en la prueba hacia atrás con la base ingenua
                (el estreno de la película anterior, y ese estreno por la misma razón para la
                recaudación mundial) y con repetir la recaudación mundial de la película anterior.
                Cada cifra se publica con el método de menor error mediano. Las proyecciones de
                terceros se muestran al lado y no entran en el cálculo. Es un ejercicio estadístico,
                no una predicción comercial.
              </p>
            </>
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
          {event.title}. {SITE_NAME}, actualizado el {formatDateLima(event.updated)}. {url}
        </p>
      </section>
    </>
  );
}
