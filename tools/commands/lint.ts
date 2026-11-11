import { defineCommand } from "citty";
import { LINTER_NAMES, lintPlan, runLinters } from "@/tools/lib/quality.ts";

export default defineCommand({
  meta: {
    name: "lint",
    description:
      "Run Biome, tsc, ast-grep, Alint and Vale (polyglot-clean-code presets), then knip, dependency-cruiser, secretlint, actionlint and zizmor",
  },
  args: {
    only: { type: "enum", options: LINTER_NAMES, description: "Run a single linter" },
    fix: { type: "boolean", description: "Let Biome apply safe fixes and formatting", default: false },
  },
  async run({ args }) {
    await runLinters(lintPlan(args.only, args.fix));
  },
});
