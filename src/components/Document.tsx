import type { JSX } from "@solidjs/web";

import { SITE_NAME, SITE_URL } from "../site.ts";

export interface Meta {
  path: string;
  title: string;
  description: string;
  kind: "website" | "article";
  index: boolean;
}

export function Document(props: { meta: Meta; stylesheet: string; children: JSX.Element }) {
  const url = `${SITE_URL}${props.meta.path}`;
  return (
    <html lang="es-PE">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.meta.title}</title>
        <meta name="description" content={props.meta.description} />
        {props.meta.index ? (
          <link rel="canonical" href={url} />
        ) : (
          <meta name="robots" content="noindex" />
        )}
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:locale" content="es_PE" />
        <meta property="og:type" content={props.meta.kind} />
        <meta property="og:title" content={props.meta.title} />
        <meta property="og:description" content={props.meta.description} />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary" />
        <link rel="icon" href="data:," />
        <link rel="stylesheet" href={props.stylesheet} />
      </head>
      <body>
        <header class="site-header">
          <div class="page">
            <a class="brand" href="/" aria-label={SITE_NAME}>
              <span>data</span>
              <span class="accent">science</span>
            </a>
          </div>
        </header>
        <main class="page">{props.children}</main>
        <footer class="site-footer">
          <div class="page">Cada análisis ofrece sus datos en JSON y CSV.</div>
        </footer>
      </body>
    </html>
  );
}
