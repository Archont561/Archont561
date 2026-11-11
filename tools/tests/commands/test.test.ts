import { runCommand } from "citty";
import testCommand from "@/tools/commands/test.ts";
import { test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("test runs bun test with coverage by default and forwards filters", (fc) => ({
    coverage: fc.boolean(),
    filters: fc.array(fc.stringMatching(/^[a-z][a-z/]{0,12}$/), { maxLength: 3 }),
  }))
  .given("bun test is available", ({ proc, logs }) => ({ spawned: proc, quiet: logs }))
  .when("bun run tools test runs", async ({ coverage, filters }) => {
    await runCommand(testCommand, { rawArgs: [...(coverage ? [] : ["--no-coverage"]), ...filters] });
    return {};
  })
  .then("the bun test command line matches the flags", ({ spawned, coverage, filters, expect }) => {
    expect(spawned.commands()).toEqual([["bun", "test", ...(coverage ? ["--coverage"] : []), ...filters]]);
  });
