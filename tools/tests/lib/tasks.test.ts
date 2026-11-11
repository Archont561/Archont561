import {
  BOT,
  captureTask,
  REFRESH_PATHS,
  refreshTask,
  renderTask,
  SNAPSHOT,
  StaleOutputError,
} from "@/tools/lib/tasks.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const env = { ci: false };

describe("captureTask", () => {
  test("--print logs the capture and writes nothing", async ({ repo, registry, logs }) => {
    void registry;
    const before = await Bun.file(`${repo}/${SNAPSHOT}`).text();
    expect(await captureTask(repo, { print: true, env })).toBe(false);
    expect(await Bun.file(`${repo}/${SNAPSHOT}`).text()).toBe(before);
    expect(JSON.parse(logs.out.join("")).github.owned).toBe(3);
  });

  test("writes drift once, then reports the snapshot as current", async ({ repo, registry, logs }) => {
    void registry;
    expect(await captureTask(repo, { env: { ci: false, githubToken: "t" } })).toBe(true);
    expect(await captureTask(repo, { env })).toBe(false);
    expect(logs.out.at(-1)).toBe("✔ Snapshot already current.\n");
  });
});

describe("renderTask", () => {
  test("writes outputs, then passes --check", async ({ repo, logs }) => {
    await renderTask(repo);
    await renderTask(repo, { check: true });
    expect(logs.out.at(-1)).toMatch(
      /^✔ README\.md, docs\/README\.md, \.github\/PULL_REQUEST_TEMPLATE\.md, assets\/banner\.svg, assets\/portal\.svg, \d+ cards, and \d+ badges are current\.\n$/,
    );
  });

  test("--check names the stale files", async ({ repo, logs }) => {
    void logs;
    await renderTask(repo);
    await Bun.write(`${repo}/README.md`, "edited by hand\n");
    const error = await renderTask(repo, { check: true }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StaleOutputError);
    expect((error as StaleOutputError).paths).toEqual(["README.md"]);
  });

  test("warns about removed orphan badges", async ({ repo, logs }) => {
    await Bun.write(`${repo}/assets/badges/orphan.svg`, "<svg/>");
    await renderTask(repo);
    expect(logs.err).toEqual(["⚠ Removed orphan assets/badges/orphan.svg\n"]);
  });
});

describe("refreshTask", () => {
  test("reports no drift when git is clean", async ({ repo, registry, proc, logs }) => {
    void registry;
    expect(await refreshTask(repo, { env })).toBe(false);
    expect(proc.capture).toHaveBeenCalledWith(["git", "status", "--porcelain", "--", ...REFRESH_PATHS], {
      cwd: repo,
    });
    expect(logs.out.at(-1)).toBe("✔ No drift since the last capture.\n");
  });

  test("reports drift without committing by default", async ({ repo, registry, proc, logs }) => {
    void registry;
    proc.capture.mockResolvedValue({ code: 0, stdout: " M README.md" });
    expect(await refreshTask(repo, { env })).toBe(true);
    expect(proc.exec).not.toHaveBeenCalled();
    expect(logs.out).toContain("Drift detected:\n M README.md\n");
  });

  test("--commit commits as the bot on CI, rebases, and pushes", async ({ repo, registry, proc, logs }) => {
    void registry;
    void logs;
    proc.capture.mockResolvedValue({ code: 0, stdout: " M README.md" });
    expect(await refreshTask(repo, { commit: true, env: { ci: true } })).toBe(true);
    expect(proc.commands()).toEqual([
      ["git", "add", "--", ...REFRESH_PATHS],
      [
        "git",
        "-c",
        `user.name=${BOT.name}`,
        "-c",
        `user.email=${BOT.email}`,
        "commit",
        "-m",
        "chore(data): refresh profile snapshot",
      ],
      ["git", "pull", "--rebase", "origin", "main"],
      ["git", "push", "origin", "HEAD:main"],
    ]);
  });

  test("--commit keeps the local git identity outside CI", async ({ repo, registry, proc, logs }) => {
    void registry;
    void logs;
    proc.capture.mockResolvedValue({ code: 0, stdout: "?? assets/badges/new.svg" });
    await refreshTask(repo, { commit: true, env });
    expect(proc.commands()[1]).toEqual(["git", "commit", "-m", "chore(data): refresh profile snapshot"]);
  });
});
