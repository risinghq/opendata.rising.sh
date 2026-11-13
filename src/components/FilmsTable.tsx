import { For, Show } from "solid-js";

import { claimLabel, formatDate, formatMoney } from "../data/format.ts";
import { MOJO_LABEL } from "../data/notice.ts";
import type { CpiData } from "../data/cpi.ts";
import { isReleased, realAmount } from "../data/stats-taquilla.ts";
import type { BudgetClaim, Claim, Film } from "../data/types.ts";
import { ArchiveCopy } from "./ArchiveCopy.tsx";

function Amount(props: { amount: number; film: Film; cpi: CpiData }) {
  return (
    <>
      {formatMoney(props.amount)}
      <div class="muted">{formatMoney(realAmount(props.amount, props.film, props.cpi))}</div>
    </>
  );
}

function OtherClaims(props: { claims?: Claim[] | BudgetClaim[] }) {
  const others = () => props.claims?.slice(1) ?? [];
  return (
    <Show when={others().length > 0}>
      <div class="muted">
        En disputa:{" "}
        <For each={others()}>
          {(claim, i) => (
            <>
              {i() > 0 && ", "}
              <a href={claim.source.url} class="source">
                {claimLabel(claim)}
              </a>
              <ArchiveCopy archive={claim.source.archive} class="source" />
            </>
          )}
        </For>
      </div>
    </Show>
  );
}

function SourceLink(props: { label: string; url: string; archive?: string }) {
  return (
    <>
      <a href={props.url} class="source">
        {props.label}
      </a>
      <ArchiveCopy archive={props.archive} class="source" />
    </>
  );
}

function FilmRow(props: { film: Film; cpi: CpiData }) {
  const film = props.film;
  return (
    <tr>
      <th scope="row">
        {film.title}
        <Show when={film.title !== film.originalTitle}>
          <div class="muted">{film.originalTitle}</div>
        </Show>
        <Show when={film.note}>
          <div class="muted">{film.note}</div>
        </Show>
      </th>
      <td data-label="Fase" class="num">
        {film.phase}
      </td>
      <td data-label="Estreno">{formatDate(film.release)}</td>
      {(() => {
        if (!isReleased(film)) {
          return (
            <td colspan="4" class="muted" data-label="Recaudación">
              Sin estrenar
            </td>
          );
        }
        return (
          <>
            <td data-label="Fin de semana de estreno" class="num">
              <Amount amount={film.opening.amount} film={film} cpi={props.cpi} />
            </td>
            <td data-label="EE. UU. y Canadá" class="num">
              <Amount amount={film.usCanada.amount} film={film} cpi={props.cpi} />
              <OtherClaims claims={film.usCanada.claims} />
            </td>
            <td data-label="Mundial" class="num">
              <Amount amount={film.worldwide.amount} film={film} cpi={props.cpi} />
              <OtherClaims claims={film.worldwide.claims} />
            </td>
            <td data-label="Presupuesto" class="num">
              <Show when={film.budget}>
                {(budget) => (
                  <>
                    {formatMoney(budget().low)}
                    <Show when={budget().high}>{(high) => ` – ${formatMoney(high())}`}</Show>
                    <OtherClaims claims={budget().claims} />
                  </>
                )}
              </Show>
            </td>
          </>
        );
      })()}
      <td data-label="Fuentes" class="film-sources">
        {(() => {
          if (!isReleased(film)) return null;
          return (
            <>
              <SourceLink
                label="fin de semana"
                url={film.opening.source.url}
                archive={film.opening.source.archive}
              />
              <Show when={film.budget}>
                {(budget) => (
                  <SourceLink
                    label="presupuesto"
                    url={budget().source.url}
                    archive={budget().source.archive}
                  />
                )}
              </Show>
              <Show
                when={film.boxOfficeMojo}
                fallback={
                  <SourceLink
                    label="taquilla"
                    url={film.worldwide.source.url}
                    archive={film.worldwide.source.archive}
                  />
                }
              >
                {(mojo) => (
                  <>
                    <div class="muted">{MOJO_LABEL}</div>
                    <SourceLink label="Box Office Mojo" url={mojo().url} />
                    <ArchiveCopy archive={mojo().archive} class="source" />
                    <SourceLink
                      label="Wikipedia"
                      url={film.worldwide.source.url}
                      archive={film.worldwide.source.archive}
                    />
                  </>
                )}
              </Show>
            </>
          );
        })()}
      </td>
    </tr>
  );
}

export function FilmsTable(props: { films: Film[]; cpi: CpiData }) {
  return (
    <div class="table-scroll" tabindex="0">
      <table class="films-table">
        <caption class="visually-hidden">
          Películas en orden de estreno con su recaudación nominal y real en dólares de{" "}
          {props.cpi.base} y la fuente de cada cifra
        </caption>
        <thead>
          <tr>
            <th scope="col">Película</th>
            <th scope="col" class="num">
              Fase
            </th>
            <th scope="col">Estreno</th>
            <th scope="col" class="num">
              Fin de semana de estreno
            </th>
            <th scope="col" class="num">
              EE. UU. y Canadá
            </th>
            <th scope="col" class="num">
              Mundial
            </th>
            <th scope="col" class="num">
              Presupuesto
            </th>
            <th scope="col">Fuentes</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.films}>{(film) => <FilmRow film={film} cpi={props.cpi} />}</For>
        </tbody>
      </table>
    </div>
  );
}
