import { mulberry32 } from "./poisson.ts";

export interface McuFilm {
  title: string;
  release: string;
  line: string;
  opening?: number;
  worldwide?: number;
}

export type FigureKey = "opening" | "worldwide";
export const FIGURE_KEYS: FigureKey[] = ["opening", "worldwide"];

const LINES: [RegExp, string][] = [
  [/^(The )?Avengers/i, "avengers"],
  [/^Iron Man/i, "iron-man"],
  [/^Thor/i, "thor"],
  [/^Captain America/i, "captain-america"],
  [/^Guardians of the Galaxy/i, "guardians"],
  [/^Ant-Man/i, "ant-man"],
  [/^Doctor Strange/i, "doctor-strange"],
  [/^Spider-Man/i, "spider-man"],
  [/^Black Panther/i, "black-panther"],
  [/^(Captain Marvel|The Marvels)/i, "captain-marvel"],
  [/^Deadpool/i, "deadpool"],
  [/^(The )?Fantastic Four/i, "fantastic-four"],
];

export const lineOf = (originalTitle: string) =>
  LINES.find(([re]) => re.test(originalTitle))?.[1] ?? originalTitle;

export const COVARIATES = [
  "intercept",
  "has line predecessor",
  "log opening of the line predecessor, centred",
] as const;
export const RIDGE = 1;
export const INTERVAL = 0.8;
export const SIMULATIONS = 20_000;
export const SEED = 20_261_113;
const MIN_FIT = 5;

export const predict = (beta: number[], x: number[]) => beta.reduce((s, v, i) => s + v * x[i]!, 0);
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
const sortedCopy = (values: number[]) => [...values].sort((a, b) => a - b);

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!;

const tail = (1 - INTERVAL) / 2;

function solve(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((r, i) => [...r, rhs[i]!]);
  for (let col = 0; col < n; col++) {
    let best = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(a[r]![col]!) > Math.abs(a[best]![col]!)) best = r;
    [a[col], a[best]] = [a[best]!, a[col]!];
    for (let r = col + 1; r < n; r++) {
      const f = a[r]![col]! / a[col]![col]!;
      for (let c = col; c <= n; c++) a[r]![c]! -= f * a[col]![c]!;
    }
  }
  const x = Array.from<number>({ length: n });
  for (let r = n - 1; r >= 0; r--) {
    x[r] =
      (a[r]![n]! - a[r]!.slice(r + 1, n).reduce((s, v, c) => s + v * x[r + 1 + c]!, 0)) / a[r]![r]!;
  }
  return x;
}

function ridge(rows: { x: number[]; y: number }[]): number[] {
  const p = COVARIATES.length;
  const xtx = Array.from({ length: p }, () => Array.from<number>({ length: p }).fill(0));
  const xty = Array.from<number>({ length: p }).fill(0);
  for (const { x, y } of rows) {
    for (let i = 0; i < p; i++) {
      xty[i]! += x[i]! * y;
      for (let j = 0; j < p; j++) xtx[i]![j]! += x[i]! * x[j]!;
    }
  }
  for (let i = 1; i < p; i++) xtx[i]![i]! += RIDGE;
  return solve(xtx, xty);
}

export interface OpeningFit {
  coefficients: number[];
  center: number;
}

const predecessorIndex = (films: McuFilm[], i: number) =>
  films.slice(0, i).findLastIndex((f) => f.line === films[i]!.line && f.opening !== undefined);

export function fitOpening(films: McuFilm[], skip = -1): OpeningFit | undefined {
  const rows = films.flatMap((film, i) => {
    const via = predecessorIndex(films, i);
    if (film.opening === undefined || i === skip || (via >= 0 && via === skip)) return [];
    return [
      { y: Math.log(film.opening), level: via >= 0 ? Math.log(films[via]!.opening!) : undefined },
    ];
  });
  const levels = rows.flatMap((r) => (r.level === undefined ? [] : [r.level]));
  if (rows.length < MIN_FIT || levels.length === 0) return undefined;
  const center = mean(levels);
  const coefficients = ridge(
    rows.map((r) => ({
      x: r.level === undefined ? [1, 0, 0] : [1, 1, r.level - center],
      y: r.y,
    })),
  );
  return { coefficients, center };
}

export function predictOpening(fit: OpeningFit, before: McuFilm[], target: McuFilm): number {
  const predecessor = before.findLast((f) => f.line === target.line && f.opening !== undefined);
  const x = predecessor ? [1, 1, Math.log(predecessor.opening!) - fit.center] : [1, 0, 0];
  return Math.exp(predict(fit.coefficients, x));
}

export function fitRatio(films: McuFilm[], skip = -1): number | undefined {
  const logs = films.flatMap((f, i) =>
    i === skip || f.opening === undefined || f.worldwide === undefined
      ? []
      : [Math.log(f.worldwide / f.opening)],
  );
  return logs.length < MIN_FIT ? undefined : Math.exp(mean(logs));
}

export function openingErrors(films: McuFilm[]): number[] {
  return films.flatMap((film, i) => {
    const fit = fitOpening(films, i);
    return fit && film.opening !== undefined
      ? [Math.log(film.opening / predictOpening(fit, films.slice(0, i), film))]
      : [];
  });
}

export function ratioErrors(films: McuFilm[]): number[] {
  return films.flatMap((film, i) => {
    const ratio = fitRatio(films, i);
    return ratio !== undefined && film.opening !== undefined && film.worldwide !== undefined
      ? [Math.log(film.worldwide / film.opening / ratio)]
      : [];
  });
}

export function naiveErrors(films: McuFilm[], key: FigureKey): number[] {
  return films.flatMap((film, i) => {
    const previous = films[i - 1];
    return film[key] !== undefined && previous?.[key] !== undefined
      ? [Math.log(film[key] / previous[key])]
      : [];
  });
}

export function intervalOf(point: number, errors: number[]) {
  const sorted = sortedCopy(errors);
  return {
    low: point * Math.exp(quantile(sorted, tail)),
    high: point * Math.exp(quantile(sorted, 1 - tail)),
  };
}

const roundedInterval = (point: number, errors: number[]) => {
  const { low, high } = intervalOf(point, errors);
  return { point: Math.round(point), low: Math.round(low), high: Math.round(high) };
};

export function simulateWorldwide(
  opening: number,
  ratio: number,
  errors: { opening: number[]; ratio: number[] },
  seed = SEED,
  draws = SIMULATIONS,
): number[] {
  const rng = mulberry32(seed);
  const pick = (values: number[]) => values[Math.floor(rng() * values.length)]!;
  return sortedCopy(
    Array.from(
      { length: draws },
      () => opening * Math.exp(pick(errors.opening)) * ratio * Math.exp(pick(errors.ratio)),
    ),
  );
}

export const probabilityAbove = (sorted: number[], threshold: number) =>
  sorted.filter((v) => v > threshold).length / sorted.length;

export const rangeOf = (sorted: number[]) => ({
  low: Math.round(quantile(sorted, tail)),
  high: Math.round(quantile(sorted, 1 - tail)),
});

export interface BacktestRow {
  film: string;
  figure: FigureKey;
  actual: number;
  predicted: number;
  naive: number;
}

export interface BacktestResult {
  cases: number;
  byFigure: Record<FigureKey, { model: number; naive: number }>;
  previousWorldwide?: number;
  rows: BacktestRow[];
}

const median = (values: number[]) => {
  const sorted = sortedCopy(values);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export function backtest(films: McuFilm[]): BacktestResult {
  const targets = new Set<number>();
  films.forEach((film, i) => {
    if (film.line === "avengers") targets.add(i);
  });
  films.slice(-10).forEach((film) => targets.add(films.indexOf(film)));
  const rows: BacktestRow[] = [];
  const previousErrors: number[] = [];
  for (const i of [...targets].sort((a, b) => a - b)) {
    const film = films[i]!;
    const before = films.slice(0, i);
    const fit = fitOpening(before);
    const ratio = fitRatio(before);
    const previous = films[i - 1];
    if (!fit || ratio === undefined || !previous) continue;
    if (film.opening === undefined || film.worldwide === undefined) continue;
    const opening = predictOpening(fit, before, film);
    if (previous.worldwide !== undefined)
      previousErrors.push(Math.abs(previous.worldwide - film.worldwide) / film.worldwide);
    rows.push(
      {
        film: film.title,
        figure: "opening",
        actual: film.opening,
        predicted: Math.round(opening),
        naive: previous.opening!,
      },
      {
        film: film.title,
        figure: "worldwide",
        actual: film.worldwide,
        predicted: Math.round(opening * ratio),
        naive: previous.opening! * ratio,
      },
    );
  }
  const ape = (get: (r: BacktestRow) => number, key: FigureKey) =>
    median(rows.filter((r) => r.figure === key).map((r) => Math.abs(get(r) - r.actual) / r.actual));
  return {
    cases: new Set(rows.map((r) => r.film)).size,
    byFigure: {
      opening: { model: ape((r) => r.predicted, "opening"), naive: ape((r) => r.naive, "opening") },
      worldwide: {
        model: ape((r) => r.predicted, "worldwide"),
        naive: ape((r) => r.naive, "worldwide"),
      },
    },
    previousWorldwide: median(previousErrors),
    rows,
  };
}

export interface Threshold {
  id: string;
  usd: number;
}

export type Basis = "model" | "naive";

export const chooseBasis = (result: BacktestResult): Basis =>
  FIGURE_KEYS.every((key) => result.byFigure[key].model < result.byFigure[key].naive)
    ? "model"
    : "naive";

export interface Forecast {
  predictions: Record<FigureKey, { point: number; low: number; high: number }>;
  probabilities: {
    seed: number;
    simulations: number;
    above: { id: string; usd: number; probability: number }[];
  };
}

const probabilitiesOf = (draws: number[], thresholds: Threshold[]) => ({
  seed: SEED,
  simulations: draws.length,
  above: thresholds.map(({ id, usd }) => ({
    id,
    usd,
    probability: probabilityAbove(draws, usd),
  })),
});

export function forecastTarget(released: McuFilm[], target: McuFilm, thresholds: Threshold[]) {
  const fit = fitOpening(released);
  const ratio = fitRatio(released);
  const previous = released.findLast((f) => f.release < target.release);
  if (!fit || ratio === undefined || !previous?.opening)
    throw new Error("not enough released films to fit the model");
  const openingPoint = predictOpening(fit, released, target);
  const errors = { opening: openingErrors(released), ratio: ratioErrors(released) };
  const modelDraws = simulateWorldwide(openingPoint, ratio, errors);
  const model: Forecast = {
    predictions: {
      opening: roundedInterval(openingPoint, errors.opening),
      worldwide: { point: Math.round(openingPoint * ratio), ...rangeOf(modelDraws) },
    },
    probabilities: probabilitiesOf(modelDraws, thresholds),
  };
  const naiveOpening = naiveErrors(released, "opening");
  const naiveDraws = simulateWorldwide(previous.opening, ratio, {
    opening: naiveOpening,
    ratio: errors.ratio,
  });
  const baseline: Forecast = {
    predictions: {
      opening: roundedInterval(previous.opening, naiveOpening),
      worldwide: { point: Math.round(previous.opening * ratio), ...rangeOf(naiveDraws) },
    },
    probabilities: probabilitiesOf(naiveDraws, thresholds),
  };
  const { low, high } = intervalOf(ratio, errors.ratio);
  return {
    fit,
    model,
    naive: baseline,
    previous: previous.title,
    ratio: { point: ratio, low, high, films: errors.ratio.length },
  };
}

export function snapshotForm() {
  return {
    form: "log(opening) ~ has line predecessor + log(opening of the line predecessor) centred on its mean, in real dollars; worldwide = opening x the geometric mean of worldwide / opening",
    covariates: COVARIATES,
    ridge: RIDGE,
    interval: INTERVAL,
  };
}

export interface McuSnapshot {
  series: "mcu";
  event: string;
  date: string;
  dollars: number;
  target: { title: string; release: string };
  filmsUsed: { title: string; release: string; opening: number; worldwide: number }[];
  model: {
    form: string;
    covariates: readonly string[];
    ridge: number;
    interval: number;
    coefficients: Partial<Record<FigureKey, number[]>>;
    center?: number;
  };
  basis?: Basis;
  previous?: string;
  predictions: Record<FigureKey, { point: number; low: number; high: number }>;
  ratio?: { point: number; low: number; high: number; films: number };
  probabilities?: Forecast["probabilities"];
  candidate?: Forecast;
  backtest: BacktestResult;
}
