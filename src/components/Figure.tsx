import { Show } from "solid-js";
import type { JSX } from "@solidjs/web";

/**
 * A numbered figure. The number comes from a CSS counter on `main`, so each
 * page counts its own figures and a chart left out of a page leaves no gap.
 */
export function Figure(props: {
  title: string;
  finding?: JSX.Element;
  note?: JSX.Element;
  source?: JSX.Element;
  legend?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <figure class="figure">
      <p class="fig-label">{props.title}</p>
      <div class="fig-panel">
        {props.children}
        <Show when={props.legend}>
          <div class="legend" aria-hidden="true">
            {props.legend}
          </div>
        </Show>
      </div>
      <Show when={props.finding || props.note || props.source}>
        <figcaption>
          <Show when={props.finding}>
            <p class="fig-finding">{props.finding}</p>
          </Show>
          <Show when={props.note}>
            <p class="fig-note">{props.note}</p>
          </Show>
          <Show when={props.source}>
            <p class="fig-source">Fuente: {props.source}</p>
          </Show>
        </figcaption>
      </Show>
    </figure>
  );
}
