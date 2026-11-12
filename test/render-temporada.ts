import { createServer } from "vite";
import solid from "@solidjs/vite-plugin";

const input = await new Response(Bun.stdin.stream()).json();
const server = await createServer({
  logLevel: "silent",
  plugins: [solid()],
});
try {
  const mod = await server.ssrLoadModule("/src/pages/TemporadaPage.tsx");
  const { renderToString } = await server.ssrLoadModule("/node_modules/@solidjs/web");
  process.stdout.write(renderToString(() => mod.TemporadaPage(input)));
} finally {
  await server.close();
}
