import { defineCommand } from "citty";
import { testPlan } from "@/tools/lib/quality.ts";
import { run } from "@/tools/lib/run.ts";

export default defineCommand({
  meta: { name: "test", description: "Run bun test with coverage (fails under the 90% threshold)" },
  args: {
    coverage: { type: "boolean", description: "Collect coverage into coverage/lcov.info", default: true },
  },
  async run({ args }) {
    await run(testPlan(args.coverage, args._));
  },
});
