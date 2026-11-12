import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface CpiData {
  series: string;
  base: number;
  source: { outlet: string; url: string };
  values: Record<string, number>;
}

const FILE = join(import.meta.dirname, "..", "..", "data", "cpi", "cuur0000sa0.json");

export function loadCpi(file = FILE): CpiData {
  return JSON.parse(readFileSync(file, "utf8")) as CpiData;
}

export function toReal(amount: number, year: number, cpi: CpiData, baseYear = cpi.base): number {
  const level = cpi.values[String(year)];
  const base = cpi.values[String(baseYear)];
  if (base === undefined) throw new Error(`no CPI value for base year ${baseYear}`);
  if (level === undefined) throw new Error(`no CPI value for year ${year}`);
  return Math.round((amount * base) / level);
}

export function latestYear(cpi: CpiData): number {
  return Math.max(...Object.keys(cpi.values).map(Number));
}
