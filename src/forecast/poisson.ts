export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poissonPmf(k: number, lambda: number): number {
  return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
}

const LOG_FACT = [0];
function logFactorial(k: number): number {
  for (let i = LOG_FACT.length; i <= k; i++) LOG_FACT[i] = LOG_FACT[i - 1]! + Math.log(i);
  return LOG_FACT[k]!;
}

export function samplePoisson(lambda: number, rng: () => number): number {
  if (lambda <= 0) return 0;
  if (lambda > 20) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rng)));
  const cutoff = Math.exp(-lambda);
  let k = 0;
  let p = rng();
  while (p > cutoff) {
    k++;
    p *= rng();
  }
  return k;
}

function normal(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
