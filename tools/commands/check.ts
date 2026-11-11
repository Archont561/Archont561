import { defineCommand } from "citty";
import { rootArg } from "@/tools/lib/cli/args.ts";
import { gateSteps, runGate } from "@/tools/lib/quality.ts";

export default defineCommand({
  meta: {
    name: "check",
    description: "Run the full quality gate: lint, readme --check, links --offline, and test",
  },
  args: { root: rootArg },
  async run({ args }) {
    await runGate(gateSteps(args.root));
  },
});
