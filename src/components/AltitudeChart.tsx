import { For } from "solid-js";

import { formatDecimal, formatNumber } from "../data/format.ts";
import { trend, type AltitudePoint } from "../data/stats-temporada.ts";

const WIDTH = 100;
const HEIGHT = 56;
const X_MAX = 3500;
const Y_MAX = 3;
const X_TICKS = [0, 1000, 2000, 3000];
const Y_TICKS = [0, 1, 2, 3];
const RADIUS_MIN = 0.9;
const RADIUS_MAX = 2;

export function AltitudeChart(props: { points: AltitudePoint[] }) {
  const x = (altitude: number) => (altitude / X_MAX) * WIDTH;
  const y = (value: number) => HEIGHT - (value / Y_MAX) * HEIGHT;
  const most = Math.max(...props.points.map((p) => p.matches));
  const radius = (matches: number) =>
    RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * Math.sqrt(matches / most);
  const line = trend(props.points);
  const at = (altitude: number) =>
    line ? line.intercept + (line.slopePerKm / 1000) * altitude : 0;

  return (
    <figure class="chart">
      <figcaption>
        Un punto por estadio: la altitud en el eje horizontal y los puntos que sumó el local por
        partido en el vertical. El tamaño del punto indica cuántos partidos se jugaron allí. La
        línea es el ajuste por mínimos cuadrados, ponderado por partidos. Las cifras están en la{" "}
        <a href="#altitud-tabla">tabla por estadio</a>.
      </figcaption>
      <div class="scatter" aria-hidden="true">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <For each={Y_TICKS}>
            {(tick) => <line class="grid-line" x1="0" x2={WIDTH} y1={y(tick)} y2={y(tick)} />}
          </For>
          <For each={X_TICKS.slice(1)}>
            {(tick) => <line class="grid-line" x1={x(tick)} x2={x(tick)} y1="0" y2={HEIGHT} />}
          </For>
          {line ? (
            <line class="range-line" x1={x(0)} x2={x(X_MAX)} y1={y(at(0))} y2={y(at(X_MAX))} />
          ) : null}
          <For each={props.points}>
            {(p) => (
              <circle
                class="dot"
                cx={x(p.stadium.altitude)}
                cy={y(p.pointsPerMatch)}
                r={radius(p.matches)}
              />
            )}
          </For>
        </svg>
        <For each={Y_TICKS}>
          {(tick) => (
            <span class="tick-y" style={`bottom: ${(tick / Y_MAX) * 100}%`}>
              {tick}
            </span>
          )}
        </For>
        <For each={X_TICKS}>
          {(tick) => (
            <span class="tick-x" style={`left: ${(tick / X_MAX) * 100}%`}>
              {formatNumber(tick)}
            </span>
          )}
        </For>
      </div>
      <div class="legend" aria-hidden="true">
        <span>Estadio, con al menos 5 partidos</span>
        <span class="key-range">
          {line
            ? `Ajuste: ${formatDecimal(line.slopePerKm)} puntos por partido por cada 1000 m`
            : "Sin ajuste"}
        </span>
      </div>
      <p class="axis-note muted">
        Eje horizontal: altitud en metros. Eje vertical: puntos del local por partido.
      </p>
    </figure>
  );
}

export function AltitudeTable(props: { points: AltitudePoint[] }) {
  return (
    <div class="table-scroll" tabindex="0" id="altitud-tabla">
      <table class="altitude-table">
        <caption class="visually-hidden">
          Puntos del local por partido en cada estadio, ordenados por altitud
        </caption>
        <thead>
          <tr>
            <th scope="col">Estadio</th>
            <th scope="col">Ciudad</th>
            <th scope="col" class="num">
              Altitud (m)
            </th>
            <th scope="col" class="num">
              Partidos
            </th>
            <th scope="col" class="num">
              Puntos del local
            </th>
            <th scope="col" class="num">
              Pts por partido
            </th>
            <th scope="col">Fuente de la altitud</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.points}>
            {(p) => (
              <tr>
                <th scope="row">{p.stadium.name}</th>
                <td>{p.stadium.city}</td>
                <td class="num">{formatNumber(p.stadium.altitude)}</td>
                <td class="num">{p.matches}</td>
                <td class="num">{p.homePoints}</td>
                <td class="num strong">{formatDecimal(p.pointsPerMatch)}</td>
                <td>
                  <a class="link-block" href={p.stadium.source.url}>
                    {p.stadium.source.outlet}
                  </a>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
