import { mock } from "bun:test";
import { runCommand } from "citty";
import { test } from "@/tools/tests/fixtures.ts";

const createClient = mock(async (_jobs: unknown) => []);
mock.module("@hey-api/openapi-ts", () => ({ createClient }));
const { default: clients } = await import("@/tools/commands/clients.ts");

test.scenario
  .prop("clients regenerates every registry client under the given root", (fc) => ({
    root: fc.stringMatching(/^\/tmp\/[a-z]{1,8}$/),
  }))
  .given("code generators are available", ({ proc, logs }) => {
    createClient.mockClear();
    return { spawned: proc, out: logs.out as string[] };
  })
  .when("bun run tools clients runs", async ({ root }) => {
    await runCommand(clients, { rawArgs: ["--root", root] });
    return {};
  })
  .then(
    "Hey API ran one job per REST registry and gql.tada introspected prefix.dev in that root",
    ({ spawned, out, root, expect }) => {
      const [jobs] = createClient.mock.calls[0] as [{ output: { path: string }; input: string }[]];
      expect(jobs.map((job) => job.output.path.split("/").at(-1))).toEqual([
        "github",
        "crates",
        "npm",
        "pypi",
        "nuget",
        "maven",
        "runiverse",
      ]);
      expect(jobs.filter((job) => job.input.startsWith(root))).toHaveLength(5);
      expect(
        spawned.exec.mock.calls.map(([command, options]: [string[], { cwd: string }]) => [
          command.slice(0, 2),
          options.cwd,
        ]),
      ).toEqual([
        [["gql.tada", "generate-schema"], root],
        [["gql.tada", "generate-output"], root],
      ]);
      expect(out.at(-1)).toBe("✔ Registry clients regenerated under tools/lib/capture/clients/.\n");
    },
  );
