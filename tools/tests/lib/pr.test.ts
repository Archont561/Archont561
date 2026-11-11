import { fillTemplate, PrError, prPlan, prTask } from "@/tools/lib/pr.ts";
import { renderPrTemplate, SUMMARY_PLACEHOLDER } from "@/tools/lib/render/pr.ts";
import { describe, expect, fakeGit, test } from "@/tools/tests/fixtures.ts";

describe("fillTemplate", () => {
  test.prop(
    "drops the generated header, fills the summary, and lists the commits in order",
    (fc) => ({
      summary: fc.option(fc.stringMatching(/^[A-Z][a-z ,]{0,40}\.$/), { nil: undefined }),
      commits: fc.array(fc.stringMatching(/^(feat|fix): [a-z](?:[a-z ]{0,19}[a-z])?$/), { maxLength: 5 }),
    }),
    async ({ repo }, { summary, commits }) => {
      const body = fillTemplate(await renderPrTemplate(repo), { summary, commits });
      expect(body.startsWith("## What and why\n")).toBe(true);
      expect(body).not.toContain("Generated from");
      expect(body.includes(SUMMARY_PLACEHOLDER)).toBe(!summary);
      if (summary) expect(body).toContain(`\n\n${summary}\n\n## Checks`);
      const listed = body.split("## Commits\n\n")[1];
      expect(listed?.trimEnd().split("\n") ?? []).toEqual(commits.map((subject) => `- ${subject}`));
    },
  );

  test("refuses a template that lost its sections or placeholder", () => {
    expect(() => fillTemplate("no sections", { commits: [] })).toThrow(PrError);
    expect(() => fillTemplate("## What and why\n\nTyped by hand.\n", { commits: [] })).toThrow(
      "fix templates/pr.ejs",
    );
  });
});

describe("prPlan", () => {
  test("refuses a detached HEAD, the base branch, an empty branch, and a failing git", async ({
    repo,
    proc,
  }) => {
    const plan = (branch: string, commits: string[], failing?: string) => {
      fakeGit(proc, branch, commits, failing);
      return prPlan(repo, { base: "main" }).then(
        () => new Error("planned"),
        (caught: unknown) => caught as Error,
      );
    };
    expect((await plan("HEAD", ["feat: x"])).message).toBe(
      "HEAD is detached; check out a topic branch first.",
    );
    expect((await plan("main", ["feat: x"])).message).toBe(
      "Open pull requests from a topic branch, not main.",
    );
    expect((await plan("topic", [])).message).toBe("topic has no commits ahead of origin/main.");
    expect((await plan("topic", ["feat: x"], "log")).message).toBe(
      "`git log --reverse --format=%s origin/main..HEAD` exited with code 128",
    );
  });

  test("needs --title when the branch has several commits", async ({ repo, proc }) => {
    fakeGit(proc, "topic", ["feat: a", "fix: b"]);
    const error = await prPlan(repo, { base: "main", title: "  " }).catch((caught: unknown) => caught);
    expect(error).toEqual(new PrError("topic has 2 commits; pass --title (it becomes the squash commit)."));
  });
});

describe("prTask", () => {
  test("--dry-run prints the commands and body and runs nothing", async ({ repo, proc, logs }) => {
    fakeGit(proc, "topic", ["feat: one"]);
    const plan = await prTask(repo, { base: "main", dryRun: true, draft: true });
    expect(proc.exec).not.toHaveBeenCalled();
    expect(logs.out.join("")).toBe(
      `$ commitlint\n$ git push --set-upstream origin topic\n` +
        `$ gh pr create --base main --head topic --title feat: one --body-file - --draft\n\n${plan.body}\n`,
    );
  });

  test("lints the title, pushes, then pipes the body to gh", async ({ repo, proc, logs }) => {
    fakeGit(proc, "topic", ["feat: one"]);
    const plan = await prTask(repo, { base: "main", summary: "Why." });
    expect(proc.exec.mock.calls).toEqual([
      [["commitlint"], { cwd: repo, stdin: "feat: one" }],
      [["git", "push", "--set-upstream", "origin", "topic"], { cwd: repo }],
      [
        [
          "gh",
          "pr",
          "create",
          "--base",
          "main",
          "--head",
          "topic",
          "--title",
          "feat: one",
          "--body-file",
          "-",
        ],
        { cwd: repo, stdin: plan.body },
      ],
    ]);
    expect(logs.out.at(-1)).toBe("✔ Opened a pull request for topic.\n");
  });
});
