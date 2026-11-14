import { rawFetch } from "./raw.ts";

const USER_AGENT = "data-rising-sh-importer/1.0 (public event figures; https://data.rising.sh)";

export interface PageRevision {
  title: string;
  revid: number;
  timestamp: string;
  wikitext: string;
}

async function call(host: string, params: Record<string, string>): Promise<any> {
  const api = `https://${host}/w/api.php`;
  const url = `${api}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const response = await rawFetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const body = await response.json();
  if (body.error) throw new Error(`${body.error.code}: ${body.error.info}`);
  return body;
}

export async function fetchPage(title: string, host: string): Promise<PageRevision> {
  const parsed = (await call(host, { action: "parse", page: title, prop: "wikitext|revid" })).parse;
  const info = await call(host, {
    action: "query",
    prop: "revisions",
    revids: String(parsed.revid),
    rvprop: "timestamp",
  });
  const timestamp = info.query.pages[0].revisions[0].timestamp as string;
  return { title: parsed.title, revid: parsed.revid, timestamp, wikitext: parsed.wikitext };
}

export async function canonicalTitles(
  titles: string[],
  host: string,
): Promise<(title: string) => string> {
  const map = new Map<string, string>();
  const distinct = [...new Set(titles)];
  for (let i = 0; i < distinct.length; i += 50) {
    const body = await call(host, {
      action: "query",
      titles: distinct.slice(i, i + 50).join("|"),
      redirects: "1",
    });
    const hops = new Map<string, string>(
      [...(body.query.normalized ?? []), ...(body.query.redirects ?? [])].map(
        (hop: { from: string; to: string }) => [hop.from, hop.to],
      ),
    );
    for (const title of distinct.slice(i, i + 50)) {
      let at = title;
      for (let guard = 0; hops.has(at) && guard < 5; guard++) at = hops.get(at)!;
      map.set(title, at);
    }
  }
  return (title) => map.get(title) ?? title;
}

export function permalink(title: string, revid: number, host: string): string {
  return `https://${host}/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}?oldid=${revid}`;
}

export async function spanishTitles(
  titles: string[],
  enHost: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const body = await call(enHost, {
      action: "query",
      prop: "langlinks",
      lllang: "es",
      titles: titles.slice(i, i + 50).join("|"),
      redirects: "1",
    });
    const hops = new Map<string, string>(
      [...(body.query.normalized ?? []), ...(body.query.redirects ?? [])].map(
        (hop: { from: string; to: string }) => [hop.from, hop.to],
      ),
    );
    for (const page of body.query.pages) {
      const es = page.langlinks?.[0]?.title;
      if (!es) continue;
      let from = page.title as string;
      for (const [a, b] of hops) if (b === from) from = a;
      for (const t of titles.slice(i, i + 50)) {
        let at = t;
        for (let guard = 0; hops.has(at) && guard < 5; guard++) at = hops.get(at)!;
        if (at === from) out.set(t, es);
      }
    }
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function limaParts(timestamp: string) {
  const moment = new Date(new Date(timestamp).getTime() - 5 * 3_600_000);
  const date = `${moment.getUTCFullYear()}-${pad(moment.getUTCMonth() + 1)}-${pad(moment.getUTCDate())}`;
  return { date, time: `${pad(moment.getUTCHours())}:${pad(moment.getUTCMinutes())}` };
}
