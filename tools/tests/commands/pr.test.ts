import { runCommand } from "citty";
import pr from "@/tools/commands/pr.ts";
import { fakeGit, test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("pr opens a pull request for the current branch with the rendered template", (fc) => ({
    branch: fc.stringMatching(/^(feat|fix|docs)\/[a-z][a-z0-9-]{0,15}$/),
    commits: fc.array(fc.stringMatching(/^(feat|fix|docs): [a-z](?:[a-z ]{0,19}[a-z])?$/), {
      minLength: 1,
      maxLength: 4,
    }),
    title: fc.option(fc.stringMatching(/^(feat|fix|docs): [a-z](?:[a-z ]{0,19}[a-z])?$/), { nil: undefined }),
    draft: fc.boolean(),
    base: fc.constantFrom("main", "release"),
  }))
  .given("a topic branch with commits ahead of the base", ({ repo, proc, logs, branch, commits }) => {
    fakeGit(proc, branch, commits);
    return { root: repo, spawned: proc, quiet: logs };
  })
  .when("bun run tools pr runs", async ({ root, title, draft, base }) => {
    const args = [
      "--root",
      root,
      "--base",
      base,
      ...(title ? ["--title", title] : []),
      ...(draft ? ["--draft"] : []),
    ];
    const error = await runCommand(pr, { rawArgs: args }).then(
      () => undefined,
      (caught: unknown) => caught as Error,
    );
    return { error };
  })
  .then(
    "the title is linted, the branch pushed, and gh receives the filled template",
    ({ spawned, error, branch, commits, title, draft, base, expect }) => {
      const expected = title ?? (commits.length === 1 ? commits[0] : undefined);
      if (!expected) {
        expect(error?.message).toContain("pass --title");
        expect(spawned.exec).not.toHaveBeenCalled();
        return;
      }
      expect(error).toBeUndefined();
      expect(spawned.commands()).toEqual([
        ["commitlint"],
        ["git", "push", "--set-upstream", "origin", branch],
        [
          "gh",
          "pr",
          "create",
          "--base",
          base,
          "--head",
          branch,
          "--title",
          expected,
          "--body-file",
          "-",
          ...(draft ? ["--draft"] : []),
        ],
      ]);
      const body = String(spawned.exec.mock.calls[2]?.[1]?.stdin);
      expect(body.startsWith("## What and why")).toBe(true);
      expect(
        body.endsWith(`## Commits\n\n${commits.map((subject: string) => `- ${subject}`).join("\n")}\n`),
      ).toBe(true);
    },
  );
