import { defineCommand } from "citty";
import { formatPlan } from "@/tools/lib/quality.ts";
import { run } from "@/tools/lib/run.ts";

export default defineCommand({
  meta: { name: "format", description: "Format TypeScript and JSON with Biome" },
  args: {
    check: { type: "boolean", description: "Report unformatted files instead of writing", default: false },
  },
  async run({ args }) {
    await run(formatPlan(args.check));
  },
});
