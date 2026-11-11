import { defineCommand } from "citty";
import { rootArg } from "@/tools/lib/cli/args.ts";
import { renderTask } from "@/tools/lib/tasks.ts";

export default defineCommand({
  meta: {
    name: "readme",
    description:
      "Render README.md, docs/README.md, the PR template, the banner, and every badge from templates/",
  },
  args: {
    check: {
      type: "boolean",
      description: "Fail when a rendered file is stale instead of writing",
      default: false,
    },
    root: rootArg,
  },
  async run({ args }) {
    await renderTask(args.root, { check: args.check });
  },
});
