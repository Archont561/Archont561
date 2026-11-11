import { runCommand } from "citty";
import commitlint from "@/tools/commands/commitlint.ts";
import { test } from "@/tools/tests/fixtures.ts";

const ref = (fc: typeof import("fast-check").default) => fc.stringMatching(/^[a-z0-9][a-z0-9~^.-]{0,10}$/);

test.scenario
  .prop("commitlint lints a message from stdin", (fc) => ({
    message: fc.stringMatching(/^(feat|fix|docs)(\([a-z]+\))?: [a-z][a-z ]{0,30}$/),
  }))
  .given("commitlint is available", ({ proc, logs }) => ({ spawned: proc, quiet: logs }))
  .when("bun run tools commitlint --message runs", async ({ message }) => {
    await runCommand(commitlint, { rawArgs: ["--message", message] });
    return {};
  })
  .then("the message is piped to commitlint", ({ spawned, message, expect }) => {
    expect(spawned.exec).toHaveBeenCalledWith(["commitlint"], { stdin: message });
  });

test.scenario
  .prop("commitlint lints a range, defaulting its end to HEAD", (fc) => ({
    from: ref(fc),
    to: fc.option(ref(fc), { nil: undefined }),
  }))
  .given("commitlint is available", ({ proc, logs }) => ({ spawned: proc, quiet: logs }))
  .when("bun run tools commitlint --from runs", async ({ from, to }) => {
    await runCommand(commitlint, { rawArgs: ["--from", from, ...(to ? ["--to", to] : [])] });
    return {};
  })
  .then("commitlint receives the range", ({ spawned, from, to, expect }) => {
    expect(spawned.commands()).toEqual([["commitlint", "--from", from, "--to", to ?? "HEAD"]]);
  });

test.scenario
  .prop("commitlint lints the commit-msg file or the last commit", (fc) => ({
    edit: fc.option(fc.stringMatching(/^\.git\/[A-Z_]{3,16}$/), { nil: undefined }),
  }))
  .given("commitlint is available", ({ proc, logs }) => ({ spawned: proc, quiet: logs }))
  .when("bun run tools commitlint runs", async ({ edit }) => {
    await runCommand(commitlint, { rawArgs: edit ? ["--edit", edit] : [] });
    return {};
  })
  .then("lefthook's file is linted, otherwise the last commit", ({ spawned, edit, expect }) => {
    expect(spawned.commands()).toEqual([edit ? ["commitlint", "--edit", edit] : ["commitlint", "--last"]]);
  });
