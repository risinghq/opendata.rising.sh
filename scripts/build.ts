import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { build, createServer } from "vite";

import { loadEvents } from "../src/data/load.ts";

const root = resolve(import.meta.dirname, "..");
const { values } = parseArgs({ options: { out: { type: "string", default: join(root, "dist") } } });
const out = resolve(values.out);

await rm(out, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: {
    outDir: out,
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: join(root, "src/site.css") },
  },
});
const manifest = JSON.parse(await readFile(join(out, ".vite/manifest.json"), "utf8")) as Record<
  string,
  { file: string }
>;
const entry = manifest["src/site.css"];
if (!entry) throw new Error("the stylesheet is missing from the build manifest");
await rm(join(out, ".vite"), { recursive: true });

const server = await createServer({
  root,
  appType: "custom",
  logLevel: "warn",
  server: { middlewareMode: true },
});
try {
  const { renderSite } = (await server.ssrLoadModule(
    "/src/render.tsx",
  )) as typeof import("../src/render.tsx");
  const files = renderSite(loadEvents(), `/${entry.file}`);
  for (const [path, content] of Object.entries(files)) {
    const target = join(out, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  console.log(`wrote ${Object.keys(files).length} files and ${entry.file} to ${out}`);
} finally {
  await server.close();
}
