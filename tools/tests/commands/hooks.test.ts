import { runCommand } from "citty";
import hooks from "@/tools/commands/hooks.ts";
import { test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("hooks installs lefthook and fails exactly when lefthook does", (fc) => ({ code: fc.nat(3) }))
  .given("lefthook exits with some code", ({ proc, logs, code }) => {
    proc.exec.mockResolvedValue(code);
    return { spawned: proc, quiet: logs };
  })
  .when("bun run tools hooks runs", async () => ({
    failed: await runCommand(hooks, { rawArgs: [] }).then(
      () => false,
      () => true,
    ),
  }))
  .then("lefthook install ran and the outcome follows its exit code", ({ spawned, failed, code, expect }) => {
    expect(spawned.commands()).toEqual([["lefthook", "install"]]);
    expect(failed).toBe(code !== 0);
  });
