import { runCommand } from "citty";
import lint from "@/tools/commands/lint.ts";
import { LINTER_NAMES, LintError, type Linter } from "@/tools/lib/quality.ts";
import { test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("lint runs every linter, collects all failures, then fails once", (fc) => ({
    failing: fc.subarray(LINTER_NAMES),
    fix: fc.boolean(),
  }))
  .given("some linters report problems", ({ proc, logs, failing }) => {
    const heads: Record<string, Linter> = {
      biome: "biome",
      tsc: "types",
      "ast-grep": "ast-grep",
      alint: "alint",
      vale: "vale",
      knip: "knip",
      bun: "depcruise",
      secretlint: "secretlint",
      "/pixi/actionlint": "actionlint",
      "/pixi/zizmor": "zizmor",
    };
    const bins = (command: string[]) => heads[command[0] as string] as Linter;
    proc.exec.mockImplementation(async (command: string[]) => (failing.includes(bins(command)) ? 1 : 0));
    return { spawned: proc, quiet: logs, bins };
  })
  .when("bun run tools lint runs", async ({ fix }) => ({
    error: await runCommand(lint, { rawArgs: fix ? ["--fix"] : [] }).then(
      () => undefined,
      (caught: unknown) => caught,
    ),
  }))
  .then(
    "every linter ran in order and the error names exactly the failures",
    ({ spawned, bins, failing, fix, error, expect }) => {
      const commands = spawned.commands();
      expect(commands.map(bins)).toEqual(LINTER_NAMES);
      expect(commands[0]?.includes("--write")).toBe(fix);
      if (failing.length === 0) {
        expect(error).toBeUndefined();
        return;
      }
      expect(error).toBeInstanceOf(LintError);
      expect((error as LintError).linters).toEqual(failing);
    },
  );

test.scenario
  .prop("lint --only runs a single linter", (fc) => ({ only: fc.constantFrom(...LINTER_NAMES) }))
  .given("every linter passes", ({ proc, logs }) => ({ spawned: proc, quiet: logs }))
  .when("bun run tools lint --only runs", async ({ only }) => {
    await runCommand(lint, { rawArgs: ["--only", only] });
    return {};
  })
  .then("exactly one linter was spawned and the pass is logged", ({ spawned, quiet, expect }) => {
    expect(spawned.commands()).toHaveLength(1);
    expect(quiet.out.at(-1)).toMatch(/^✔ Lint passed: [a-z-]+\n$/);
  });
