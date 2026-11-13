import { For, Show } from "solid-js";

import type { CpiData } from "../data/cpi.ts";
import {
  formatDateLima,
  formatDecimal,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
} from "../data/format.ts";
import { isReleased, realAmount } from "../data/stats-taquilla.ts";
import type { Projection, TaquillaRecord } from "../data/types.ts";
import {
  methodsOf,
  scoresOf,
  type FigureKey,
  type McuSnapshot,
  type Method,
} from "../forecast/mcu.ts";

const FIGURE_LABEL: Record<FigureKey, string> = {
  opening: "Fin de semana de estreno, EE. UU. y Canadá",
  worldwide: "Recaudación mundial",
};

const day = (date: string) => formatDateLima(`${date}T12:00-05:00`);

const THRESHOLD_LABEL = (id: string, usd: number, dollars: number) =>
  id === "endgame-nominal"
    ? `Avengers: Endgame, ${formatMoneyCompact(usd)}`
    : id === "endgame-real"
      ? `Avengers: Endgame en dólares de ${dollars}, ${formatMoneyCompact(usd)}`
      : formatMoneyCompact(usd);

const SCORE_LABEL: Record<FigureKey, Partial<Record<Method, string>>> = {
  opening: { model: "el modelo", naive: "repetir el estreno anterior" },
  worldwide: {
    model: "el modelo",
    naive: "el estreno anterior por la razón",
    previous: "repetir la recaudación mundial anterior",
  },
};

const PUBLISHED_LABEL: Record<FigureKey, Partial<Record<Method, (previous: string) => string>>> = {
  opening: {
    model: () => "sale del modelo estadístico",
    naive: (previous) => `repite el estreno de la película anterior, ${previous}`,
  },
  worldwide: {
    model: () => "sale del modelo estadístico",
    naive: (previous) =>
      `es el estreno de la película anterior, ${previous}, por la razón de la recaudación mundial al estreno`,
    previous: (previous) => `repite la recaudación mundial de la película anterior, ${previous}`,
  },
};

const FIGURE_SUBJECT: Record<FigureKey, string> = {
  opening: "El fin de semana de estreno",
  worldwide: "La recaudación mundial",
};

function Basis(props: { snap: McuSnapshot }) {
  const methods = () => methodsOf(props.snap);
  return (
    <Show when={methods()}>
      {(chosen) => (
        <Show
          when={typeof props.snap.basis === "object"}
          fallback={
            <p>
              El pronóstico sale del modelo estadístico, que superó a la base de la película
              anterior en las dos cifras de la prueba hacia atrás.
            </p>
          }
        >
          <For each={Object.keys(FIGURE_SUBJECT) as FigureKey[]}>
            {(key) => {
              const scores = () =>
                Object.entries(scoresOf(props.snap.backtest, key)) as [Method, number][];
              return (
                <p>
                  {FIGURE_SUBJECT[key]}{" "}
                  {PUBLISHED_LABEL[key][chosen()[key]]!(props.snap.previous ?? "")}. Es el método de
                  menor error mediano en la prueba hacia atrás:{" "}
                  {scores()
                    .toSorted((a, b) => a[1] - b[1])
                    .map(([method, ape]) => `${SCORE_LABEL[key][method]!} ${formatPercent(ape)}`)
                    .join(", ")}
                  .
                </p>
              );
            }}
          </For>
        </Show>
      )}
    </Show>
  );
}

function backtestSentence(snap: McuSnapshot) {
  const bt = snap.backtest;
  const wins = (["opening", "worldwide"] as const).every(
    (key) => bt.byFigure[key].model < bt.byFigure[key].naive,
  );
  const verdict =
    typeof snap.basis === "object"
      ? "En cada cifra se publica el método de menor error mediano."
      : wins
        ? "El modelo supera a la base en las dos cifras."
        : "El modelo no supera a la base en las dos cifras, así que el pronóstico va con esa advertencia.";
  return (
    `Para medirlo, el modelo se entrenó hacia atrás con ${bt.cases} películas: cada película de ` +
    `Avengers y cada uno de los últimos diez estrenos se predijo usando solo las películas ` +
    `anteriores. El error mediano del modelo es ${formatPercent(bt.byFigure.worldwide.model)} en ` +
    `la recaudación mundial y ${formatPercent(bt.byFigure.opening.model)} en el fin de semana de ` +
    `estreno, contra ${formatPercent(bt.byFigure.worldwide.naive)} y ` +
    `${formatPercent(bt.byFigure.opening.naive)} de la base ingenua. ` +
    (bt.previousWorldwide === undefined
      ? `La base repite las cifras de la película anterior. `
      : `La base toma el estreno de la película anterior y, para la recaudación mundial, ese ` +
        `estreno por la misma razón. Repetir sin más la recaudación mundial de la película ` +
        `anterior da un error mediano de ${formatPercent(bt.previousWorldwide)}, ${
          bt.previousWorldwide < bt.byFigure.worldwide.model ? "menor" : "mayor"
        } que el ` +
        `del modelo. `) +
    verdict
  );
}

function ForecastFigures(props: { snap: McuSnapshot; event: TaquillaRecord; cpi: CpiData }) {
  const snap = () => props.snap;
  const target = () => props.event.films.find((f) => f.title === snap().target.title);
  const actual = () => {
    const film = target();
    return film && isReleased(film) ? film : null;
  };
  return (
    <div class="table-scroll" tabindex="0">
      <table class="forecast-table">
        <caption class="visually-hidden">
          Cifras previstas para {snap().target.title} con su intervalo, calculadas el{" "}
          {day(snap().date)}
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
            <Show when={actual()}>
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
              const film = actual();
              const real = film
                ? realAmount(film[key].amount, film, props.cpi, snap().dollars)
                : undefined;
              const range = snap().predictions[key];
              return (
                <tr>
                  <th scope="row">{FIGURE_LABEL[key]}</th>
                  <td class="num strong">{formatMoney(range.point)}</td>
                  <td class="num">
                    {formatMoney(range.low)} – {formatMoney(range.high)}
                  </td>
                  <Show when={real !== undefined}>
                    <td class="num">{formatMoney(real!)}</td>
                    <td>{real! >= range.low && real! <= range.high ? "Sí" : "No"}</td>
                  </Show>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
    </div>
  );
}

function Worldwide(props: { snap: McuSnapshot }) {
  const repeated = () =>
    typeof props.snap.basis === "object" && props.snap.basis.worldwide === "previous";
  const simulations = () =>
    `${formatNumber(props.snap.probabilities!.simulations)} simulaciones con semilla ${props.snap.probabilities!.seed}`;
  return (
    <Show when={props.snap.ratio && props.snap.probabilities}>
      <div class="block">
        <h3>
          {repeated()
            ? "Probabilidades de la recaudación mundial"
            : "Recaudación mundial dada la del estreno"}
        </h3>
        <Show
          when={!repeated()}
          fallback={
            <p>
              Las probabilidades salen de {simulations()}, que parten de la recaudación mundial
              anterior y le aplican al azar uno de los cambios observados entre dos estrenos
              consecutivos.
            </p>
          }
        >
          <p>
            En {props.snap.ratio!.films} películas estrenadas, la recaudación mundial fue una media
            geométrica de {formatDecimal(props.snap.ratio!.point)} veces la del fin de semana de
            estreno, con un intervalo del {formatPercent(props.snap.model.interval)} de{" "}
            {formatDecimal(props.snap.ratio!.low)} a {formatDecimal(props.snap.ratio!.high)} veces.
            Las probabilidades salen de {simulations()}, que combinan el error de las cifras
            previstas con el de esta razón.
          </p>
        </Show>
        <div class="table-scroll" tabindex="0">
          <table class="backtest-table">
            <caption class="visually-hidden">
              Probabilidad de que la recaudación mundial de {props.snap.target.title} supere cada
              cifra
            </caption>
            <thead>
              <tr>
                <th scope="col">La recaudación mundial supera</th>
                <th scope="col" class="num">
                  Probabilidad
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={props.snap.probabilities!.above}>
                {(row) => (
                  <tr>
                    <th scope="row">{THRESHOLD_LABEL(row.id, row.usd, props.snap.dollars)}</th>
                    <td class="num">{formatPercent(row.probability)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </Show>
  );
}

function Candidate(props: { snap: McuSnapshot }) {
  return (
    <Show when={props.snap.candidate}>
      {(candidate) => {
        const methods = () => methodsOf(props.snap)!;
        const range = (key: FigureKey) => {
          const { point, low, high } = candidate().predictions[key];
          return `${formatMoneyCompact(point)} (de ${formatMoneyCompact(low)} a ${formatMoneyCompact(high)})`;
        };
        return (
          <>
            {" "}
            El modelo habría dado{" "}
            {(["opening", "worldwide"] as const)
              .filter((key) => methods()[key] !== "model")
              .map(
                (key) =>
                  `${range(key)} ${key === "opening" ? "en el fin de semana de estreno" : "en la recaudación mundial"}`,
              )
              .join(" y ")}
            .
          </>
        );
      }}
    </Show>
  );
}

function Projections(props: { projections: Projection[]; target: string }) {
  const rows = () =>
    props.projections
      .filter((p) => p.film === props.target)
      .toSorted((a, b) => b.published.localeCompare(a.published));
  return (
    <Show when={rows().length > 0}>
      <div class="block">
        <h3>Proyecciones publicadas</h3>
        <p>
          Estimaciones de terceros para el fin de semana de estreno en EE. UU. y Canadá, en dólares
          nominales. No entran en el modelo ni en el pronóstico. Cada fila enlaza a la nota donde se
          publicó.
        </p>
        <div class="table-scroll" tabindex="0">
          <table class="projections-table">
            <caption class="visually-hidden">
              Proyecciones publicadas del fin de semana de estreno de {props.target}
            </caption>
            <thead>
              <tr>
                <th scope="col">Publicada</th>
                <th scope="col">Quién</th>
                <th scope="col">Medio</th>
                <th scope="col" class="num">
                  Estreno
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={rows()}>
                {(row) => (
                  <tr>
                    <td>{day(row.published)}</td>
                    <td>{row.by}</td>
                    <td>
                      <a href={row.source.url}>{row.source.outlet}</a>
                    </td>
                    <td class="num">
                      {row.low === row.high
                        ? `cerca de ${formatMoneyCompact(row.low)}`
                        : `${formatMoneyCompact(row.low)} a ${formatMoneyCompact(row.high)}`}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </Show>
  );
}

export function McuForecast(props: {
  event: TaquillaRecord;
  cpi: CpiData;
  forecast: McuSnapshot;
  earlier: McuSnapshot[];
}) {
  const snap = () => props.forecast;
  return (
    <section class="section" aria-labelledby="pronostico">
      <h2 id="pronostico">Pronóstico: {snap().target.title}</h2>
      <p>
        Pronóstico calculado el {day(snap().date)} con los {snap().filmsUsed.length} estrenos
        publicados hasta ese día, en dólares de {snap().dollars}. El estreno está previsto para el{" "}
        {day(snap().target.release)}.
      </p>
      <Basis snap={snap()} />
      <ForecastFigures snap={snap()} event={props.event} cpi={props.cpi} />
      <Worldwide snap={snap()} />
      <Projections projections={props.event.projections ?? []} target={snap().target.title} />
      <div class="block">
        <h3>Prueba hacia atrás</h3>
        <p>
          {backtestSentence(snap())}
          <Candidate snap={snap()} />
        </p>
      </div>
      <For each={props.earlier}>
        {(old) => (
          <div class="block">
            <h3>Pronóstico anterior, del {day(old.date)}</h3>
            <p>
              Se conserva sin cambios, con el modelo que se usaba ese día. {backtestSentence(old)}
            </p>
            <ForecastFigures snap={old} event={props.event} cpi={props.cpi} />
          </div>
        )}
      </For>
    </section>
  );
}
