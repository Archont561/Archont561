import { defineCommand } from "citty";
import { rootArg } from "@/tools/lib/cli/args.ts";
import { runLinks } from "@/tools/lib/quality.ts";

export default defineCommand({
  meta: {
    name: "links",
    description:
      "Check every link in the README, AGENTS.md and docs with lychee (--offline: repo links and anchors only)",
  },
  args: {
    root: rootArg,
    offline: {
      type: "boolean",
      description: "Skip the network: check this repo's own links and anchors",
      default: false,
    },
  },
  async run({ args }) {
    await runLinks(args.root, args.offline);
  },
});
