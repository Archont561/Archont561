/**
 * Entry point for `bun run tools <cmd>` (and the `bun run <cmd>` aliases in
 * package.json). Every tools/commands/<name>.ts is a subcommand; logic lives in tools/lib/.
 */
import { runMain } from "citty";
import { createCli } from "@/tools/lib/cli/discover.ts";
import { COMMANDS_DIR, ROOT } from "@/tools/lib/paths.ts";

const pkg = await Bun.file(`${ROOT}/package.json`).json();

await runMain(
  await createCli(COMMANDS_DIR, {
    name: "tools",
    version: pkg.version,
    description: "Repository automation for the Archont561 profile. Commands live in tools/commands/.",
  }),
);
