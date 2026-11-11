import { runCommand } from "citty";
import links from "@/tools/commands/links.ts";
import { CommandError } from "@/tools/lib/run.ts";
import { test } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("links runs lychee over the rendered prose, offline on request", (fc) => ({
    offline: fc.boolean(),
    broken: fc.boolean(),
  }))
  .given("lychee finds broken links or none", ({ proc, logs, broken }) => {
    proc.exec.mockResolvedValue(broken ? 2 : 0);
    return { spawned: proc, quiet: logs };
  })
  .when("bun run tools links runs", async ({ offline }) => ({
    error: await runCommand(links, { rawArgs: ["--root", "/repo", ...(offline ? ["--offline"] : [])] }).then(
      () => undefined,
      (caught: unknown) => caught,
    ),
  }))
  .then(
    "the pixi lychee ran once and its exit code decides",
    ({ spawned, offline, broken, error, expect }) => {
      const [command] = spawned.commands();
      expect(command?.[0]).toBe("/pixi/lychee");
      expect(command?.includes("--offline")).toBe(offline);
      expect(command?.slice(-3)).toEqual(["README.md", "AGENTS.md", "docs"]);
      expect(command?.some((arg: string) => arg.endsWith(" file:///repo/$1"))).toBe(true);
      if (broken) expect(error).toEqual(new CommandError(command as string[], 2));
      else expect(error).toBeUndefined();
    },
  );
