import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { EventRecord } from "./types.ts";
import { assertEvent } from "./validate.ts";

export const EVENTS_DIR = join(import.meta.dirname, "..", "..", "data", "events");

export function loadEvents(dir = EVENTS_DIR): EventRecord[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const slug = basename(file, ".json");
      const data = assertEvent(slug, JSON.parse(readFileSync(join(dir, file), "utf8")));
      return { slug, ...data };
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}
