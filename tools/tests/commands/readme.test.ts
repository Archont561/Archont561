import { runCommand } from "citty";
import readme from "@/tools/commands/readme.ts";
import { StaleOutputError } from "@/tools/lib/tasks.ts";
import { test } from "@/tools/tests/fixtures.ts";

const RENDERED = ["README.md", "docs/README.md", ".github/PULL_REQUEST_TEMPLATE.md", "assets/banner.svg"];

test.scenario
  .prop("readme --check fails exactly when a rendered file was edited by hand", (fc) => ({
    edited: fc.subarray(RENDERED),
    note: fc.stringMatching(/^[a-z ]{1,20}$/),
  }))
  .given("a freshly rendered repository", async ({ repo, logs }) => {
    await runCommand(readme, { rawArgs: ["--root", repo] });
    return { root: repo, quiet: logs };
  })
  .given("some outputs are edited by hand", async ({ root, edited, note }) => {
    for (const path of edited) await Bun.write(`${root}/${path}`, `${note}\n`);
    return {};
  })
  .when("bun run tools readme --check runs", async ({ root }) => ({
    error: await runCommand(readme, { rawArgs: ["--root", root, "--check"] }).then(
      () => undefined,
      (caught: unknown) => caught,
    ),
  }))
  .then("the stale files are named, and nothing else", ({ error, edited, expect }) => {
    if (edited.length === 0) {
      expect(error).toBeUndefined();
      return;
    }
    expect(error).toBeInstanceOf(StaleOutputError);
    expect((error as StaleOutputError).paths).toEqual(edited);
  });
