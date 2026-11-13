import { createServer } from "vite";
import solid from "@solidjs/vite-plugin";

const input = await new Response(Bun.stdin.stream()).json();
const server = await createServer({
  logLevel: "silent",
  plugins: [solid()],
});
try {
  const mod = await server.ssrLoadModule("/src/pages/TaquillaPage.tsx");
  const { renderToString } = await server.ssrLoadModule("@solidjs/web");
  process.stdout.write(renderToString(() => mod.TaquillaPage(input)));
} finally {
  await server.close();
}
