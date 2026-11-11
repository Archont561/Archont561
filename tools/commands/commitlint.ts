import { defineCommand } from "citty";
import { commitlintPlan } from "@/tools/lib/quality.ts";
import { run } from "@/tools/lib/run.ts";

export default defineCommand({
  meta: {
    name: "commitlint",
    description: "Check Conventional Commit messages against .commitlintrc.json",
  },
  args: {
    edit: {
      type: "string",
      description: "Lint a commit message file (lefthook commit-msg)",
      valueHint: "file",
    },
    from: { type: "string", description: "Lint every commit after this ref", valueHint: "ref" },
    to: { type: "string", description: "End of the range (default HEAD)", valueHint: "ref" },
    message: { type: "string", description: "Lint a message string, e.g. a pull request title" },
  },
  async run({ args }) {
    const plan = commitlintPlan(args);
    await run(plan.command, { stdin: plan.stdin });
  },
});
