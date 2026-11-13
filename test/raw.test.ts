import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Api } from "../scripts/liga1/api.ts";
import { rawFetch } from "../scripts/raw.ts";

const realFetch = globalThis.fetch;
const realDataHome = process.env.XDG_DATA_HOME;
const realReplay = process.env.OPENDATA_REPLAY;
const realKey = process.env.FOOTBALL_API_KEY;

let archive: string;

const indexLines = () =>
  readFileSync(join(archive, "index.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as { url: string; fetchedAt: string; status: number; sha256: string },
    );

beforeEach(() => {
  archive = join(mkdtempSync(join(tmpdir(), "opendata-raw-")), "opendata", "raw");
  process.env.XDG_DATA_HOME = archive.slice(0, -"/opendata/raw".length);
  delete process.env.OPENDATA_REPLAY;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = realDataHome;
  if (realReplay === undefined) delete process.env.OPENDATA_REPLAY;
  else process.env.OPENDATA_REPLAY = realReplay;
  if (realKey === undefined) delete process.env.FOOTBALL_API_KEY;
  else process.env.FOOTBALL_API_KEY = realKey;
});

const stub = (handler: (url: string) => Response) => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return handler(String(input));
  }) as typeof fetch;
  return calls;
};

describe("rawFetch", () => {
  test("stores a body once and appends one index line per fetch", async () => {
    stub(() => new Response("hello"));
    await rawFetch("https://a.test/x");
    await rawFetch("https://a.test/x");
    const files = readdirSync(archive).sort();
    expect(files).toHaveLength(2);
    expect(files).toContain("index.jsonl");
    const entries = indexLines();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.sha256).toBe(entries[1]!.sha256);
    expect(files).toContain(entries[0]!.sha256);
    expect(entries[0]!.status).toBe(200);
    expect(entries[0]!.url).toBe("https://a.test/x");
    expect(typeof entries[0]!.fetchedAt).toBe("string");
  });

  test("the index never holds the key", async () => {
    const calls = stub(() => new Response("ok"));
    await rawFetch("https://a.test/feed?key=s3cr3t-value&lang=es", {
      secrets: ["s3cr3t-value"],
    });
    expect(calls[0]).toBe("https://a.test/feed?key=s3cr3t-value&lang=es");
    const raw = readFileSync(join(archive, "index.jsonl"), "utf8");
    expect(raw).not.toContain("s3cr3t-value");
    expect(indexLines()[0]!.url).toBe("https://a.test/feed?key=***&lang=es");
  });

  test("replay returns the latest stored body without a request", async () => {
    let body = "first";
    stub(() => new Response(body));
    await rawFetch("https://a.test/x");
    body = "second";
    await rawFetch("https://a.test/x");

    process.env.OPENDATA_REPLAY = "1";
    stub(() => {
      throw new Error("network called in replay");
    });
    const response = await rawFetch("https://a.test/x");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("second");
  });

  test("replay of an unknown URL fails naming it", async () => {
    process.env.OPENDATA_REPLAY = "1";
    await expect(rawFetch("https://a.test/nothing")).rejects.toThrow("https://a.test/nothing");
  });

  test("a 5xx response is recorded but not replayed", async () => {
    stub(() => new Response("oops", { status: 500 }));
    const response = await rawFetch("https://a.test/down");
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("oops");
    expect(indexLines()[0]).toMatchObject({ url: "https://a.test/down", status: 500 });

    process.env.OPENDATA_REPLAY = "1";
    await expect(rawFetch("https://a.test/down")).rejects.toThrow("https://a.test/down");
  });

  test("Api.get follows a stored league_moved redirect in replay", async () => {
    process.env.FOOTBALL_API_KEY = "k";
    stub((url) =>
      url.includes("/leagues/1/")
        ? new Response(JSON.stringify({ error: { code: "league_moved", canonical_id: 2 } }), {
            status: 301,
          })
        : new Response(JSON.stringify({ success: 1, data: ["ok"] })),
    );
    expect(await new Api().get("/leagues/1/fixtures?page=1")).toEqual(["ok"]);

    process.env.OPENDATA_REPLAY = "1";
    stub(() => {
      throw new Error("network called in replay");
    });
    const api = new Api();
    expect(await api.get("/leagues/1/fixtures?page=1")).toEqual(["ok"]);
    expect(api.canonicalId(1)).toBe(2);
  });

  test("replay serves the later 2xx after a recorded failure", async () => {
    let status = 500;
    stub(() => new Response(status === 200 ? "fine" : "oops", { status }));
    await rawFetch("https://a.test/flaky");
    status = 200;
    await rawFetch("https://a.test/flaky");

    process.env.OPENDATA_REPLAY = "1";
    expect(await (await rawFetch("https://a.test/flaky")).text()).toBe("fine");
  });
});
