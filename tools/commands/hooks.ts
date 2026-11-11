import { defineCommand } from "citty";
import { run } from "@/tools/lib/run.ts";

export default defineCommand({
  meta: { name: "hooks", description: "Install the lefthook git hooks from lefthook.yml" },
  async run() {
    await run(["lefthook", "install"]);
  },
});
