import { defineCommand } from "citty";
import { rootArg } from "@/tools/lib/cli/args.ts";
import { readEnv } from "@/tools/lib/config/env.ts";
import { refreshTask } from "@/tools/lib/tasks.ts";

export default defineCommand({
  meta: {
    name: "refresh",
    description: "Capture, render, and report drift; with --commit, commit and push it (used by refresh.yml)",
  },
  args: {
    commit: {
      type: "boolean",
      description: "Commit and push the refreshed files when they drifted",
      default: false,
    },
    root: rootArg,
  },
  async run({ args }) {
    await refreshTask(args.root, { commit: args.commit, env: readEnv() });
  },
});
