import { ROOT } from "@/tools/lib/paths.ts";
import {
  agentsPlan,
  CLI_PACKAGES,
  commitlintPlan,
  formatPlan,
  gateSteps,
  LINKED,
  LINTER_NAMES,
  LINTERS,
  LintError,
  linksPlan,
  lintPlan,
  PROSE,
  runGate,
  runLinks,
  runLinters,
  testPlan,
} from "@/tools/lib/quality.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

test("plans spell out the exact command lines", () => {
  expect(agentsPlan(true)).toEqual(["agents-md", "--no-symlink", "--dry-run"]);
  expect(formatPlan(false)).toEqual(["biome", "format", "--write", "."]);
  expect(testPlan(true, ["tools"])).toEqual(["bun", "test", "--coverage", "tools"]);
  expect(commitlintPlan({ message: "" })).toEqual({ command: ["commitlint"], stdin: "" });
  expect(lintPlan("vale", false)).toEqual([
    { name: "vale", command: ["vale", "--no-global", "--config=.vale.ini", ...PROSE] },
  ]);
  expect(lintPlan("zizmor", false)[0]?.command).toEqual(["zizmor", "--offline", ".github"]);
  expect(linksPlan("/r", true)).toEqual([
    "lychee",
    "--config",
    "lychee.toml",
    "--remap",
    "^https://github\\.com/Archont561/Archont561/(?:blob|tree)/main/(.*)$ file:///r/$1",
    "--remap",
    "^https://github\\.com/Archont561/Archont561/actions/workflows/([a-z-]+\\.yml)(?:/badge\\.svg.*)?$ file:///r/.github/workflows/$1",
    "--offline",
    ...LINKED,
  ]);
});

test.prop(
  "lintPlan runs one or all linters and only Biome receives --write",
  (fc) => ({ only: fc.option(fc.constantFrom(...LINTER_NAMES), { nil: undefined }), fix: fc.boolean() }),
  (_fixtures, { only, fix }) => {
    const plan = lintPlan(only, fix);
    expect(plan.map((step) => step.name)).toEqual(only ? [only] : LINTER_NAMES);
    for (const { name, command } of plan) expect(command.includes("--write")).toBe(fix && name === "biome");
  },
);

test("runLinters rethrows unexpected errors instead of collecting them", async ({ proc, logs }) => {
  proc.exec.mockRejectedValue(new TypeError("spawn failed"));
  await expect(runLinters([{ name: "biome", command: ["biome"] }])).rejects.toThrow("spawn failed");
  expect(new LintError(["vale"]).message).toBe("Lint failed: vale");
  expect(logs.out).toEqual(["▸ biome\n"]);
});

test.scenario
  .prop("runGate runs steps in order and stops at the first failure", (fc) => ({
    failAt: fc.option(fc.nat(4), { nil: undefined }),
    size: fc.integer({ min: 1, max: 5 }),
  }))
  .given("a gate of steps", ({ logs, failAt, size }) => {
    const ran: number[] = [];
    const steps = Array.from({ length: size }, (_, index) => ({
      name: `step${index}`,
      run: async () => {
        ran.push(index);
        if (index === failAt) throw new Error(`step${index} failed`);
      },
    }));
    return { steps, ran, out: logs.out as string[] };
  })
  .when("the gate runs", async ({ steps }) => ({
    failed: await runGate(steps).then(
      () => false,
      () => true,
    ),
  }))
  .then(
    "steps ran up to the failure and success is logged only without one",
    ({ ran, out, failAt, size, failed, expect }) => {
      const stop = failAt !== undefined && failAt < size ? failAt + 1 : size;
      expect(ran).toEqual(Array.from({ length: stop }, (_, index) => index));
      expect(failed).toBe(stop !== size || (failAt !== undefined && failAt < size));
      expect(out.at(-1) === "✔ Quality gate passed.\n").toBe(!failed);
    },
  );

test("gateSteps mirror ci.yml", () => {
  expect(gateSteps("/repo").map((step) => step.name)).toEqual([
    "lint",
    "readme --check",
    "links --offline",
    "test",
  ]);
});

type Step = { run?: string; env?: Record<string, string> };
type Workflow = { on: { pull_request: { types: string[] } }; jobs: Record<string, { steps: Step[] }> };

test("pull-request.yml lints the commit range and the PR title, and re-lints when the title is edited", async () => {
  const workflow = Bun.YAML.parse(
    await Bun.file(`${ROOT}/.github/workflows/pull-request.yml`).text(),
  ) as Workflow;
  expect(workflow.on.pull_request.types).toContain("edited");
  const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);
  const title = steps.find((step) => step.run === 'bun run tools commitlint --message "$PR_TITLE"');
  // The title travels through env, never interpolated into the shell line (script injection).
  const expression = ["$", "{{ github.event.pull_request.title }}"].join("");
  expect(title?.env).toEqual({ PR_TITLE: expression });
  expect(steps.some((step) => step.run?.startsWith('bun run tools commitlint --from "$BASE_SHA"'))).toBe(
    true,
  );
  // The workflow's message lint is the same plan `bun run tools pr` runs locally before opening one.
  expect(commitlintPlan({ message: "feat: x" })).toEqual({ command: ["commitlint"], stdin: "feat: x" });
});

test("runLinters runs pixi tools from the environment and names failures by linter", async ({
  proc,
  logs,
}) => {
  proc.exec.mockImplementation(async (command: string[]) => (command[0] === "/pixi/zizmor" ? 1 : 0));
  const error = await runLinters(lintPlan(undefined, false), "/repo").catch((caught: unknown) => caught);
  expect(error).toEqual(new LintError(["zizmor"]));
  const heads = proc.commands().map((command: string[]) => command[0]);
  expect(heads).toContain("/pixi/actionlint");
  expect(heads.filter((head: string | undefined) => head === "bun")).toHaveLength(1);
  expect(logs.out).toContain("▸ /pixi/zizmor --offline .github\n");
});

test("runLinks runs the pixi lychee from the repository root", async ({ proc, logs }) => {
  await runLinks("/repo", false);
  expect(proc.exec.mock.calls[0]?.[0][0]).toBe("/pixi/lychee");
  expect(proc.exec.mock.calls[0]?.[0]).not.toContain("--offline");
  expect(proc.exec.mock.calls[0]?.[1]).toEqual({ cwd: "/repo" });
  expect(logs.out[0]).toStartWith("▸ /pixi/lychee --config lychee.toml");
});

test("knip ignores exactly the packages it cannot see used, and each one is installed", async () => {
  const knip = await Bun.file(`${ROOT}/knip.json`).json();
  const pkg = await Bun.file(`${ROOT}/package.json`).json();
  const spawned = new Set(Object.values(CLI_PACKAGES));
  // knip finds typescript through tsconfig.json; secretlint presets are named only in its config.
  const presets = (await Bun.file(`${ROOT}/.secretlintrc.json`).json()).rules.map(
    (rule: { id: string }) => rule.id,
  );
  expect(new Set(knip.ignoreDependencies)).toEqual(
    new Set([...spawned, ...presets].filter((name) => name !== "typescript")),
  );
  for (const name of spawned) expect(pkg.devDependencies).toHaveProperty([name]);
  for (const linter of Object.values(LINTERS)) {
    const [head, , , bin] = linter(false);
    const cli = head === "bun" ? (bin as string) : (head as string);
    expect(cli in CLI_PACKAGES || ["knip", "actionlint", "zizmor"].includes(cli)).toBe(true);
  }
});
