import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { rawFetch, replaying, type RawInit } from "../raw.ts";

export const BASE = "https://api.5dollarfootballapi.com/v1";
export const CACHE = join(import.meta.dirname, "..", "..", ".cache", "liga1");

export function apiKey(): string {
  const env = process.env.FOOTBALL_API_KEY?.trim();
  if (env) return env;
  const file = join(homedir(), ".config", "5dollarfootballapi", "key");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  throw new Error(
    "no API key: set FOOTBALL_API_KEY or write the key to ~/.config/5dollarfootballapi/key",
  );
}

const PER_MINUTE = 18;

export class Api {
  requests = 0;
  remaining = -1;
  private keyValue: string | undefined;
  private stamps: number[] = [];
  private movedIds = new Map<number, number>();

  canonicalId(id: number): number {
    return this.movedIds.get(id) ?? id;
  }

  private key(): string {
    if (this.keyValue === undefined) this.keyValue = apiKey();
    return this.keyValue;
  }

  private async pace() {
    const now = Date.now();
    this.stamps = this.stamps.filter((t) => now - t < 60_000);
    if (this.stamps.length >= PER_MINUTE) {
      const wait = 60_000 - (now - this.stamps[0]!) + 250;
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  async get(path: string): Promise<unknown> {
    const init: RawInit = { redirect: "manual" };
    if (!replaying()) {
      await this.pace();
      this.stamps.push(Date.now());
      const key = this.key();
      init.headers = { authorization: `Bearer ${key}` };
      init.secrets = [key];
    }
    const response = await rawFetch(`${BASE}${path}`, init);
    this.requests++;
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining !== null) this.remaining = Number(remaining);
    if (response.status === 301 || response.status === 302) {
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: string; canonical_id?: number };
      } | null;
      const canonical = body?.error?.canonical_id;
      if (body?.error?.code === "league_moved" && canonical !== undefined) {
        const oldId = Number(path.match(/\/leagues\/(\d+)/)?.[1]);
        if (oldId) this.movedIds.set(oldId, canonical);
        console.log(`league moved, following canonical id ${canonical}`);
        return this.get(
          path
            .replace(/\/leagues\/\d+/, `/leagues/${canonical}`)
            .replace(/league=\d+/, `league=${canonical}`),
        );
      }
      throw new Error(`unexpected redirect for ${path}`);
    }
    if (response.status === 429) {
      const retry = Number(response.headers.get("retry-after") ?? 60);
      if (retry <= 120) {
        console.log(`429 on ${path}; waiting ${retry}s`);
        await new Promise((r) => setTimeout(r, retry * 1000));
        return this.get(path);
      }
      throw new Error(`rate limit reached after ${this.requests} requests; retry after ${retry}s`);
    }
    const body = (await response.json()) as {
      success: number;
      data?: unknown;
      error?: { code?: string; message?: string };
    };
    if (!response.ok || body.success !== 1) {
      throw new Error(
        `${path}: ${body.error?.code ?? response.status} ${body.error?.message ?? ""}`,
      );
    }
    return body.data;
  }
}

export function cacheWrite(name: string, data: unknown) {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, name), JSON.stringify(data));
}

export function cacheRead<T>(name: string): T {
  return JSON.parse(readFileSync(join(CACHE, name), "utf8")) as T;
}
