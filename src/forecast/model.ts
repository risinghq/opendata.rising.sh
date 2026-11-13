export interface MatchInput {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  altDiff: number;
  daysAgo: number;
}

export interface FitOptions {
  decay: number;
  ridge: number;
  dixonColes: boolean;
}

export interface ModelParams {
  intercept: number;
  attack: Record<string, number>;
  defence: Record<string, number>;
  home: number;
  altitude: number;
  rho: number;
  decay: number;
}

function tau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

export function expected(params: ModelParams, home: string, away: string, altDiff: number) {
  const homeEdge = params.home + params.altitude * altDiff;
  return {
    home: Math.exp(params.intercept + params.attack[home]! - params.defence[away]! + homeEdge),
    away: Math.exp(params.intercept + params.attack[away]! - params.defence[home]!),
  };
}

const MAX_GOALS = 10;

export function probabilities(
  params: ModelParams,
  home: string,
  away: string,
  altDiff: number,
): { home: number; draw: number; away: number; xHome: number; xAway: number } {
  const { home: lh, away: la } = expected(params, home, away, altDiff);
  let ph = 0;
  let pd = 0;
  let pa = 0;
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    const hp = (Math.exp(-lh) * Math.pow(lh, h)) / factorial(h);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p =
        hp * ((Math.exp(-la) * Math.pow(la, a)) / factorial(a)) * tau(h, a, lh, la, params.rho);
      total += p;
      if (h > a) ph += p;
      else if (h === a) pd += p;
      else pa += p;
    }
  }
  return { home: ph / total, draw: pd / total, away: pa / total, xHome: lh, xAway: la };
}

const FACT = [1];
function factorial(k: number): number {
  for (let i = FACT.length; i <= k; i++) FACT[i] = FACT[i - 1]! * i;
  return FACT[k]!;
}

export function fit(matches: MatchInput[], teams: string[], options: FitOptions): ModelParams {
  const idx = new Map(teams.map((t, i) => [t, i]));
  const n = teams.length;
  const params = new Float64Array(1 + 2 * n + 3);
  const pHome = 1 + 2 * n;
  const pAlt = pHome + 1;
  const pRho = pHome + 2;
  params[pHome] = 0.25;
  params[0] = 0.2;

  const weights = matches.map((m) => Math.exp(-options.decay * m.daysAgo));

  const value = (p: Float64Array): number => {
    let ll = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const hi = idx.get(m.home)!;
      const ai = idx.get(m.away)!;
      const edge = p[pHome] + p[pAlt] * m.altDiff;
      const lh = Math.exp(p[0]! + p[1 + hi]! - p[1 + n + ai]! + edge);
      const la = Math.exp(p[0]! + p[1 + ai]! - p[1 + n + hi]!);
      const t = options.dixonColes ? tau(m.homeGoals, m.awayGoals, lh, la, p[pRho]!) : 1;
      ll +=
        weights[i]! *
        (Math.log(Math.max(t, 1e-9)) +
          m.homeGoals * Math.log(lh) -
          lh +
          m.awayGoals * Math.log(la) -
          la);
    }
    for (let i = 0; i < 2 * n; i++) ll -= options.ridge * p[1 + i]! * p[1 + i]!;
    return ll;
  };

  const gradient = (p: Float64Array, g: Float64Array) => {
    g.fill(0);
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const hi = idx.get(m.home)!;
      const ai = idx.get(m.away)!;
      const edge = p[pHome] + p[pAlt] * m.altDiff;
      const lh = Math.exp(p[0]! + p[1 + hi]! - p[1 + n + ai]! + edge);
      const la = Math.exp(p[0]! + p[1 + ai]! - p[1 + n + hi]!);
      const w = weights[i]!;
      const rh = m.homeGoals - lh;
      const ra = m.awayGoals - la;
      g[0]! += w * (rh + ra);
      g[1 + hi]! += w * rh;
      g[1 + ai]! += w * ra;
      g[1 + n + ai]! -= w * rh;
      g[1 + n + hi]! -= w * ra;
      g[pHome]! += w * rh;
      g[pAlt]! += w * rh * m.altDiff;
      if (options.dixonColes && m.homeGoals <= 1 && m.awayGoals <= 1) {
        const t = tau(m.homeGoals, m.awayGoals, lh, la, p[pRho]!);
        const dt =
          m.homeGoals === 0 && m.awayGoals === 0
            ? -lh * la
            : m.homeGoals === 0 && m.awayGoals === 1
              ? lh
              : m.homeGoals === 1 && m.awayGoals === 0
                ? la
                : -1;
        g[pRho]! += w * (dt / Math.max(t, 1e-9));
      }
    }
    for (let i = 0; i < 2 * n; i++) g[1 + i]! -= 2 * options.ridge * p[1 + i]!;
  };

  const g = new Float64Array(params.length);
  const candidate = new Float64Array(params.length);
  let step = 0.02;
  let current = value(params);
  for (let iter = 0; iter < 2000; iter++) {
    gradient(params, g);
    let improved = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      candidate.set(params);
      for (let i = 0; i < candidate.length; i++) candidate[i]! += step * g[i]!;
      candidate[pRho] = Math.max(-0.4, Math.min(0.4, candidate[pRho]!));
      centre(candidate, 1, n);
      centre(candidate, 1 + n, n);
      const next = value(candidate);
      if (next > current) {
        params.set(candidate);
        current = next;
        step *= 1.15;
        improved = true;
        break;
      }
      step *= 0.5;
    }
    if (!improved) break;
  }

  const attack: Record<string, number> = {};
  const defence: Record<string, number> = {};
  for (const team of teams) {
    const i = idx.get(team)!;
    attack[team] = params[1 + i]!;
    defence[team] = params[1 + n + i]!;
  }
  return {
    intercept: params[0]!,
    attack,
    defence,
    home: params[pHome]!,
    altitude: params[pAlt]!,
    rho: options.dixonColes ? params[pRho]! : 0,
    decay: options.decay,
  };
}

function centre(p: Float64Array, offset: number, n: number) {
  let mean = 0;
  for (let i = 0; i < n; i++) mean += p[offset + i]!;
  mean /= n;
  for (let i = 0; i < n; i++) p[offset + i]! -= mean;
}
