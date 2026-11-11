import { defineCommand } from "citty";
import { agentsPlan } from "@/tools/lib/quality.ts";
import { run } from "@/tools/lib/run.ts";

export default defineCommand({
  meta: { name: "agents", description: "Refresh the marked sections of AGENTS.md with agents-md" },
  args: {
    "dry-run": { type: "boolean", description: "Show what would change and write nothing", default: false },
  },
  async run({ args }) {
    await run(agentsPlan(args["dry-run"]));
  },
});
