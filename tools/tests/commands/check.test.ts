import { runCommand } from "citty";
import check from "@/tools/commands/check.ts";
import readme from "@/tools/commands/readme.ts";
import { LintError } from "@/tools/lib/quality.ts";
import { CommandError } from "@/tools/lib/run.ts";
import { test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop(
    "check runs lint, readme --check, links --offline and test in order, stopping at the first failure",
    (fc) => ({
      lintFails: fc.boolean(),
      testFails: fc.boolean(),
    }),
  )
  .given(
    "a rendered repository and tools that pass or fail",
    async ({ repo, proc, logs, lintFails, testFails }) => {
      await runCommand(readme, { rawArgs: ["--root", repo] });
      proc.exec.mockImplementation(async (command: string[]) => {
        if (command.join(" ").startsWith("bun test")) return testFails ? 1 : 0;
        return lintFails && command[0] === "vale" ? 1 : 0;
      });
      return { root: repo, spawned: proc, out: logs.out as string[] };
    },
  )
  .when("bun run tools check runs", async ({ root }) => ({
    error: await runCommand(check, { rawArgs: ["--root", root] }).then(
      () => undefined,
      (caught: unknown) => caught,
    ),
  }))
  .then(
    "the gate reports the first failing step, or passes",
    ({ error, out, spawned, lintFails, testFails, expect }) => {
      const ranTests = spawned
        .commands()
        .some((command: string[]) => command.join(" ").startsWith("bun test"));
      if (lintFails) {
        expect(error).toBeInstanceOf(LintError);
        expect(ranTests).toBe(false);
      } else if (testFails) {
        expect(error).toBeInstanceOf(CommandError);
      } else {
        expect(error).toBeUndefined();
        expect(out.at(-1)).toBe("✔ Quality gate passed.\n");
      }
      expect(out.filter((line) => line.startsWith("▸ tools ")).length).toBe(lintFails ? 1 : 4);
    },
  );
