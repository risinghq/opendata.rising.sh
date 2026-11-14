import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RawInit extends RequestInit {
  secrets?: string[];
}

interface IndexEntry {
  url: string;
  fetchedAt: string;
  status: number;
  sha256: string;
}

export function replaying(): boolean {
  return process.env.DATA_REPLAY === "1";
}

function archiveDir(): string {
  const data = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
  return join(data, "data.rising.sh", "raw");
}

function sanitized(url: string, secrets: string[]): string {
  let out = url;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.replaceAll(secret, "***").replaceAll(encodeURIComponent(secret), "***");
  }
  return out;
}

function readIndex(dir: string): IndexEntry[] {
  const file = join(dir, "index.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as IndexEntry];
      } catch {
        return [];
      }
    });
}

function replay(dir: string, url: string): Response {
  const hit = readIndex(dir).findLast(
    (entry) => entry.url === url && entry.status >= 200 && entry.status < 400,
  );
  if (!hit) throw new Error(`DATA_REPLAY=1: no stored response for ${url}`);
  return new Response(readFileSync(join(dir, hit.sha256)), { status: hit.status });
}

function record(dir: string, url: string, status: number, body: ArrayBuffer): void {
  mkdirSync(dir, { recursive: true });
  const sha256 = createHash("sha256").update(new Uint8Array(body)).digest("hex");
  const file = join(dir, sha256);
  if (!existsSync(file)) {
    const tmp = join(dir, `${sha256}.tmp`);
    writeFileSync(tmp, Buffer.from(body));
    renameSync(tmp, file);
  }
  const entry: IndexEntry = { url, fetchedAt: new Date().toISOString(), status, sha256 };
  appendFileSync(join(dir, "index.jsonl"), `${JSON.stringify(entry)}\n`);
}

export async function rawFetch(url: string, init: RawInit = {}): Promise<Response> {
  const { secrets = [], ...rest } = init;
  const seen = sanitized(url, secrets);
  const dir = archiveDir();
  if (replaying()) return replay(dir, seen);
  const response = await fetch(url, rest);
  const body = await response.arrayBuffer();
  record(dir, seen, response.status, body);
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
