import { extname } from "node:path";
import { resolve } from "node:path";

import { createServer } from "vite";

import { loadEvents } from "../src/data/load.ts";

const root = resolve(import.meta.dirname, "..");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

const server = await createServer({ root, appType: "custom" });

server.middlewares.use(async (req, res, next) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  try {
    const { renderSite } = (await server.ssrLoadModule(
      "/src/render.tsx",
    )) as typeof import("../src/render.tsx");
    const files = renderSite(loadEvents(), "/src/site.css?direct");
    const key = path === "/" ? "index.html" : `${path.slice(1)}${extname(path) ? "" : ".html"}`;
    const content = files[key];
    res.statusCode = content === undefined ? 404 : 200;
    res.setHeader("content-type", types[extname(key)] ?? types[".html"]!);
    res.end(content ?? files["404.html"]);
  } catch (error) {
    next(error);
  }
});

await server.listen();
server.printUrls();
