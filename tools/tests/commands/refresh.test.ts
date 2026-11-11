import { runCommand } from "citty";
import refresh from "@/tools/commands/refresh.ts";
import { REFRESH_PATHS } from "@/tools/lib/tasks.ts";
import { test, worldArb } from "@/tools/tests/fixtures.ts";

test.scenario
  .prop("refresh commits only when asked and only when files drifted", (fc) => ({
    world: worldArb(fc),
    drift: fc.constantFrom("", " M README.md", "?? assets/badges/new.svg"),
    commit: fc.boolean(),
  }))
  .given(
    "registries serve the world and git reports some status",
    ({ repo, registry, proc, logs, world, drift }) => {
      registry.serve(world);
      proc.capture.mockResolvedValue({ code: 0, stdout: drift });
      return { root: repo, spawned: proc, quiet: logs };
    },
  )
  .when("bun run tools refresh runs", async ({ root, commit }) => {
    await runCommand(refresh, { rawArgs: ["--root", root, ...(commit ? ["--commit"] : [])] });
    return {};
  })
  .then(
    "git status scoped the check; add, commit, rebase, push ran only for a committed drift",
    ({ spawned, root, drift, commit, expect }) => {
      expect(spawned.capture).toHaveBeenCalledWith(["git", "status", "--porcelain", "--", ...REFRESH_PATHS], {
        cwd: root,
      });
      const git = spawned
        .commands()
        .map((command: string[]) =>
          command.find((part) => !part.startsWith("-") && part !== "git" && !part.includes("=")),
        );
      expect(git).toEqual(drift && commit ? ["add", "commit", "pull", "push"] : []);
    },
  );
