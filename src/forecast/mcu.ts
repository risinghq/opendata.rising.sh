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

const DAYS = 86_400_000;
const years = (release: string, first: string) =>
  (new Date(release).getTime() - new Date(first).getTime()) / (365.25 * DAYS);

export const COVARIATES = [
  "intercept",
  "log prev release",
  "has line predecessor",
  "log prev same-line",
  "years since first release",
] as const;
export const RIDGE = 1;
export const INTERVAL = 0.8;
const MIN_FIT = 5;

type Row = { x: number[]; y: number };

function row(films: McuFilm[], i: number, key: FigureKey): Row | undefined {
  const film = films[i]!;
  const actual = film[key];
  const prev = films[i - 1]?.[key];
  if (actual === undefined || prev === undefined) return undefined;
  const prevLine = films.slice(0, i).findLast((f) => f.line === film.line && f[key] !== undefined);
  return {
    x: [
      1,
      Math.log(prev),
      prevLine ? 1 : 0,
      prevLine ? Math.log(prevLine[key]!) : 0,
      years(film.release, films[0]!.release),
    ],
    y: Math.log(actual),
  };
}

export function targetVector(films: McuFilm[], target: McuFilm, key: FigureKey): number[] {
  const prev = films.findLast((f) => f[key] !== undefined);
  const prevLine = films.findLast((f) => f.line === target.line && f[key] !== undefined);
  return [
    1,
    Math.log(prev![key]!),
    prevLine ? 1 : 0,
    prevLine ? Math.log(prevLine[key]!) : 0,
    years(target.release, films[0]!.release),
  ];
}

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

export function fit(films: McuFilm[], key: FigureKey, skip = -1): number[] | undefined {
  const rows = films.map((_, i) => (i === skip ? undefined : row(films, i, key)));
  const usable = rows.filter((r): r is Row => r !== undefined);
  if (usable.length < MIN_FIT) return undefined;
  const p = COVARIATES.length;
  const xtx = Array.from({ length: p }, () => Array.from<number>({ length: p }).fill(0));
  const xty = Array.from<number>({ length: p }).fill(0);
  for (const { x, y } of usable) {
    for (let i = 0; i < p; i++) {
      xty[i]! += x[i]! * y;
      for (let j = 0; j < p; j++) xtx[i]![j]! += x[i]! * x[j]!;
    }
  }
  for (let i = 1; i < p; i++) xtx[i]![i]! += RIDGE;
  return solve(xtx, xty);
}

const dot = (b: number[], x: number[]) => b.reduce((s, v, i) => s + v * x[i]!, 0);

export function predict(beta: number[], x: number[]): number {
  return Math.exp(dot(beta, x));
}

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!;

export function interval(films: McuFilm[], key: FigureKey, point: number) {
  const errors = films
    .map((film, i) => {
      const b = fit(films, key, i);
      const r = row(films, i, key);
      return b && r ? r.y - dot(b, r.x) : undefined;
    })
    .filter((e): e is number => e !== undefined)
    .sort((a, b) => a - b);
  const tail = (1 - INTERVAL) / 2;
  return {
    low: Math.round(point * Math.exp(quantile(errors, tail))),
    high: Math.round(point * Math.exp(quantile(errors, 1 - tail))),
  };
}

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
  rows: BacktestRow[];
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
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
  for (const i of [...targets].sort((a, b) => a - b)) {
    const film = films[i]!;
    for (const key of FIGURE_KEYS) {
      const before = films.slice(0, i);
      const beta = fit(before, key);
      const actual = film[key];
      const naive = films[i - 1]?.[key];
      if (!beta || actual === undefined || naive === undefined) continue;
      rows.push({
        film: film.title,
        figure: key,
        actual,
        predicted: Math.round(predict(beta, targetVector(before, film, key))),
        naive,
      });
    }
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
    rows,
  };
}

export function snapshotForm() {
  return {
    form: "log(figure) ~ log(prev release) + prev same-line + years since first release, in real dollars",
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
    coefficients: Record<FigureKey, number[]>;
  };
  predictions: Record<FigureKey, { point: number; low: number; high: number }>;
  backtest: BacktestResult;
}
