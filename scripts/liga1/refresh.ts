import { spawnSync } from "node:child_process";
import { join as joinPath, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");

const step = (args: string[]) => {
  const result = spawnSync("bun", args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`step failed: bun ${args.join(" ")}`);
};

step([joinPath("scripts", "import-liga1.ts")]);
const { run: fetchApi } = await import("./fetch.ts");
const { run: join } = await import("./join.ts");
const { run: forecast } = await import("./forecast.ts");
await fetchApi();
join();
forecast();
console.log("refresh complete");
