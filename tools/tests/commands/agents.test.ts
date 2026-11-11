import { runCommand } from "citty";
import agents from "@/tools/commands/agents.ts";
import { CommandError } from "@/tools/lib/run.ts";
import { type Proc, test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("agents runs agents-md without a symlink, honouring --dry-run", (fc) => ({ dryRun: fc.boolean() }))
  .given("agents-md is available", ({ proc, logs }) => ({
    spawned: proc as Proc,
    quiet: logs,
  }))
  .when("bun run tools agents runs", async ({ dryRun }) => {
    await runCommand(agents, { rawArgs: dryRun ? ["--dry-run"] : [] });
    return {};
  })
  .then("it spawns exactly the agents-md command line", ({ spawned, dryRun, expect }) => {
    expect(spawned.commands()).toEqual([["agents-md", "--no-symlink", ...(dryRun ? ["--dry-run"] : [])]]);
  });

test.scenario
  .prop("agents fails with the child's exit code", (fc) => ({ code: fc.integer({ min: 1, max: 255 }) }))
  .given("agents-md exits non-zero", ({ proc, logs, code }) => {
    proc.exec.mockResolvedValue(code);
    return { quiet: logs };
  })
  .when("bun run tools agents runs", async () => ({
    error: await runCommand(agents, { rawArgs: [] }).catch((caught: unknown) => caught),
  }))
  .then("the command rejects with a CommandError carrying that code", ({ error, code, expect }) => {
    expect(error).toBeInstanceOf(CommandError);
    expect((error as CommandError).code).toBe(code);
  });
