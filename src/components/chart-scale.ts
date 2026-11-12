const STEPS = [1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7];

export interface Scale {
  max: number;
  ticks: number[];
}

export function niceScale(value: number): Scale {
  const step = STEPS.find((s) => value / s <= 4) ?? STEPS[STEPS.length - 1]!;
  const count = Math.max(1, Math.ceil(value / step));
  return { max: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}
