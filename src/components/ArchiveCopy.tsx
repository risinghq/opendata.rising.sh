import { Show } from "solid-js";

export function ArchiveCopy(props: { archive?: string; class?: string }) {
  return (
    <Show when={props.archive}>
      {(archive) => (
        <a href={archive()} class={props.class ? `archive-copy ${props.class}` : "archive-copy"}>
          copia archivada
        </a>
      )}
    </Show>
  );
}
