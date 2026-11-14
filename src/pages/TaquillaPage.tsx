import { Show } from "solid-js";

import { Lede, mcuAnswer } from "../components/Answer.tsx";
import { FilmsTable } from "../components/FilmsTable.tsx";
import { GrossChart, grossPoints, GrossTable } from "../components/GrossChart.tsx";
import { McuForecast } from "../components/McuForecast.tsx";
import { latestYear, loadCpi } from "../data/cpi.ts";
import { formatDateLima, formatMoneyCompact } from "../data/format.ts";
import { taquillaNotice } from "../data/notice.ts";
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
  const points = grossPoints(releasedFilms(event), cpi);
  const forecast = props.forecast ?? null;
  const url = `${SITE_URL}/analisis/${event.slug}`;

  return (
    <>
      <Lede event={event} answer={forecast ? mcuAnswer(forecast) : null} />
      <Show when={forecast}>
        {(snap) => (
          <McuForecast event={event} cpi={cpi} forecast={snap()} earlier={props.earlier ?? []} />
        )}
      </Show>

      <section class="section" aria-labelledby="en-el-tiempo">
        <h2 id="en-el-tiempo">Taquilla en el tiempo</h2>
        <p>
          Las {figures.released} películas estrenadas de {figures.total} recaudaron{" "}
          {formatMoneyCompact(figures.worldwide)} en el mundo,{" "}
          {formatMoneyCompact(figures.worldwideReal)} en dólares de {cpi.base}. La mediana por
          película es {formatMoneyCompact(figures.medianWorldwide)} (
          {formatMoneyCompact(figures.medianReal)} en dólares de {cpi.base}).
        </p>
        <GrossChart points={points} dollars={cpi.base} />
        <div class="block">
          <h3>Cifras del gráfico</h3>
          <GrossTable points={points} dollars={cpi.base} />
        </div>
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
            <a class="link-block" href={`/analisis/${event.slug}.json`}>
              Datos en JSON
            </a>
          </li>
          <li>
            <a class="link-block" href={`/analisis/${event.slug}.csv`}>
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
