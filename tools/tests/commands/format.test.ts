import { runCommand } from "citty";
import format from "@/tools/commands/format.ts";
import { test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("format writes with Biome, or only reports with --check", (fc) => ({ check: fc.boolean() }))
  .given("Biome is available", ({ proc, logs }) => ({ spawned: proc, quiet: logs }))
  .when("bun run tools format runs", async ({ check }) => {
    await runCommand(format, { rawArgs: check ? ["--check"] : [] });
    return {};
  })
  .then("it formats the whole tree, writing only without --check", ({ spawned, check, expect }) => {
    const [command] = spawned.commands();
    expect(command?.slice(0, 2)).toEqual(["biome", "format"]);
    expect(command?.at(-1)).toBe(".");
    expect(command?.includes("--write")).toBe(!check);
  });
