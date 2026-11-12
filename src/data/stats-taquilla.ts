import { latestYear, toReal, type CpiData } from "./cpi.ts";
import type { Film, ReleasedFilm, TaquillaData } from "./types.ts";

export const isReleased = (film: Film): film is ReleasedFilm => film.status === "released";

export function releasedFilms(event: TaquillaData): ReleasedFilm[] {
  return event.films.filter(isReleased);
}

export const filmYear = (film: Film) => Number(film.release.slice(0, 4));

export const realAmount = (amount: number, film: Film, cpi: CpiData, baseYear?: number) =>
  toReal(amount, Math.min(filmYear(film), latestYear(cpi)), cpi, baseYear);

export const realWorldwide = (film: ReleasedFilm, cpi: CpiData) =>
  realAmount(film.worldwide.amount, film, cpi);

export interface TaquillaFigures {
  released: number;
  total: number;
  worldwide: number;
  worldwideReal: number;
  medianWorldwide: number;
  medianReal: number;
  top: ReleasedFilm;
}

export function keyFigures(event: TaquillaData, cpi: CpiData): TaquillaFigures {
  const released = releasedFilms(event);
  const sorted = [...released].sort((a, b) => a.worldwide.amount - b.worldwide.amount);
  const mid = Math.floor((sorted.length - 1) / 2);
  const medianFilm = sorted[mid]!;
  return {
    released: released.length,
    total: event.films.length,
    worldwide: released.reduce((sum, f) => sum + f.worldwide.amount, 0),
    worldwideReal: released.reduce((sum, f) => sum + realWorldwide(f, cpi), 0),
    medianWorldwide: medianFilm.worldwide.amount,
    medianReal: realWorldwide(medianFilm, cpi),
    top: sorted.at(-1)!,
  };
}
