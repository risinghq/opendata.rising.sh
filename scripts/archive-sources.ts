import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { EVENTS_DIR } from "../src/data/load.ts";
import { archiveCopyUrl } from "../src/data/wayback.ts";
import { rawFetch, replaying, type RawInit } from "./raw.ts";

type SourceNode = Record<string, unknown> & { url: string };

export interface SourceRef {
  path: string;
  source: SourceNode;
}

export function collectSources(value: unknown, path = ""): SourceRef[] {
  const out: SourceRef[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => out.push(...collectSources(item, `${path}[${i}]`)));
  } else if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.outlet === "string" && typeof obj.url === "string") {
      out.push({ path: path || "<root>", source: obj as SourceNode });
    }
    for (const [key, item] of Object.entries(obj)) {
      out.push(...collectSources(item, path ? `${path}.${key}` : key));
    }
  }
  return out;
}

export function skipReason(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "not a URL";
  }
  const host = parsed.hostname;
  if (host === "web.archive.org" || host.endsWith(".web.archive.org"))
    return "already an archived copy";
  if (parsed.searchParams.has("oldid")) return "pinned to a revision";
  if (host.startsWith("api.")) return "an API endpoint";
  return undefined;
}

const AVAILABILITY = "https://archive.org/wayback/available?url=";
const SAVE = "https://web.archive.org/save/";
const USER_AGENT = "data.rising.sh (archive:sources)";
const GAP_MS = 1500;
const SAVE_GAP_MS = 21_000;
const RETRY_GAP_MS = 12_000;

export interface Deps {
  fetch: (url: string, init?: RawInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const realDeps: Deps = {
  fetch: rawFetch,
  sleep: (ms) => (replaying() ? Promise.resolve() : pause(ms)),
};

let lastCall = 0;

async function pacedFetch(url: string, gap: number, deps: Deps, init?: RawInit) {
  const wait = lastCall + gap - Date.now();
  if (wait > 0) await deps.sleep(wait);
  lastCall = Date.now();
  return deps.fetch(url, init);
}

interface AvailabilityBody {
  archived_snapshots?: {
    closest?: { available?: boolean; timestamp?: string };
  };
}

async function newestCopy(url: string, deps: Deps): Promise<string | null> {
  const api = `${AVAILABILITY}${encodeURIComponent(url)}`;
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await deps.sleep(RETRY_GAP_MS);
    const response = await pacedFetch(api, GAP_MS, deps, {
      signal: AbortSignal.timeout(30_000),
    });
    status = response.status;
    if (!response.ok) continue;
    const body = (await response.json()) as AvailabilityBody;
    const closest = body.archived_snapshots?.closest;
    if (
      closest?.available &&
      typeof closest.timestamp === "string" &&
      /^\d{14}$/.test(closest.timestamp)
    ) {
      return archiveCopyUrl(closest.timestamp, url);
    }
    return null;
  }
  throw new Error(`availability check failed for ${url} (HTTP ${status})`);
}

export interface Copy {
  archive: string;
  how: "kept" | "found" | "saved";
}

const CONFIRM_TRIES = 6;
const CONFIRM_GAP_MS = 15_000;

async function confirm(url: string, deps: Deps): Promise<Copy | null> {
  for (let i = 0; i < CONFIRM_TRIES; i++) {
    if (i > 0) await deps.sleep(CONFIRM_GAP_MS);
    try {
      const copy = await newestCopy(url, deps);
      if (copy) return { archive: copy, how: "saved" };
    } catch {
      // the availability check can time out while the capture finishes
    }
  }
  return null;
}

export async function archiveUrl(url: string, deps: Deps = realDeps): Promise<Copy | null> {
  const found = await newestCopy(url, deps);
  if (found) return { archive: found, how: "found" };
  try {
    await pacedFetch(SAVE + url, SAVE_GAP_MS, deps, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    // a failed or timed-out request can still leave the capture running
  }
  return confirm(url, deps);
}

/** The copies the sources already carry, so a URL cited twice is looked up once. */
export function knownCopies(refs: SourceRef[]): Map<string, Copy | null> {
  const copies = new Map<string, Copy | null>();
  for (const { source } of refs) {
    if (typeof source.archive === "string") {
      copies.set(source.url, { archive: source.archive, how: "kept" });
    }
  }
  return copies;
}

/** Sets `archive` on every source that lacks one, asking `lookup` once per URL. */
export async function fillArchives(
  refs: SourceRef[],
  copies: Map<string, Copy | null>,
  lookup: (url: string) => Promise<Copy | null>,
): Promise<number> {
  let added = 0;
  for (const { source } of refs) {
    if (source.archive !== undefined || skipReason(source.url)) continue;
    if (!copies.has(source.url)) copies.set(source.url, await lookup(source.url));
    const copy = copies.get(source.url);
    if (copy) {
      source.archive = copy.archive;
      added++;
    }
  }
  return added;
}

async function reportedLookup(url: string): Promise<Copy | null> {
  try {
    const copy = await archiveUrl(url);
    console.log(copy ? `${copy.how} ${url} -> ${copy.archive}` : `no copy ${url}`);
    return copy;
  } catch (error) {
    console.log(`no copy ${url} (${(error as Error).message})`);
    return null;
  }
}

if (import.meta.main) {
  const events = readdirSync(EVENTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const data: unknown = JSON.parse(readFileSync(join(EVENTS_DIR, file), "utf8"));
      return { file, data, refs: collectSources(data) };
    });
  const copies = knownCopies(events.flatMap((event) => event.refs));
  const before = copies.size;
  let written = 0;
  for (const { file, data, refs } of events) {
    if ((await fillArchives(refs, copies, reportedLookup)) === 0) continue;
    writeFileSync(join(EVENTS_DIR, file), `${JSON.stringify(data, null, 2)}\n`);
    written++;
    console.log(`wrote ${file}`);
  }
  const values = [...copies.values()];
  const missing = values.filter((copy) => copy === null).length;
  const archived = values.length - missing - before;
  console.log(
    `${archived} URL${archived === 1 ? "" : "s"} archived, ${missing} without a copy, ${written} file${written === 1 ? "" : "s"} written`,
  );
}
