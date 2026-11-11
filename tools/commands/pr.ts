import { defineCommand } from "citty";
import { rootArg } from "@/tools/lib/cli/args.ts";
import { prTask } from "@/tools/lib/pr.ts";

export default defineCommand({
  meta: {
    name: "pr",
    description: "Lint the title, push the branch, and open a pull request with the rendered template (gh)",
  },
  args: {
    title: {
      type: "string",
      description: "Conventional Commit title; defaults to the subject of a single-commit branch",
    },
    summary: { type: "string", description: "Paragraph for the 'What and why' section" },
    base: { type: "string", description: "Branch to merge into", default: "main", valueHint: "branch" },
    draft: { type: "boolean", description: "Open the pull request as a draft", default: false },
    "dry-run": {
      type: "boolean",
      description: "Print the commands and the body; change nothing",
      default: false,
    },
    root: rootArg,
  },
  async run({ args }) {
    await prTask(args.root, {
      base: args.base,
      title: args.title,
      summary: args.summary,
      draft: args.draft,
      dryRun: args["dry-run"],
    });
  },
});
