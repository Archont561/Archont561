import { defineCommand } from "citty";
import { rootArg } from "@/tools/lib/cli/args.ts";
import { readEnv } from "@/tools/lib/config/env.ts";
import { captureTask } from "@/tools/lib/tasks.ts";

export default defineCommand({
  meta: {
    name: "capture",
    description:
      "Capture GitHub and registry facts (npm, PyPI, crates.io, NuGet, Maven Central, R-universe, prefix.dev) into data/snapshot.json",
  },
  args: {
    print: { type: "boolean", description: "Print the capture and write nothing", default: false },
    root: rootArg,
  },
  async run({ args }) {
    await captureTask(args.root, { print: args.print, env: readEnv() });
  },
});
