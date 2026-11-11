/**
 * Quality tooling behind the lint, links, format, test, commitlint, agents and check
 * commands. Each `*Plan` returns the exact command line so tests can assert it
 * without spawning anything.
 */

import { CLIENTS_DIR } from "@/tools/lib/capture/codegen.ts";
import { log } from "@/tools/lib/log.ts";
import { ROOT } from "@/tools/lib/paths.ts";
import { CommandError, run } from "@/tools/lib/run.ts";
import { renderTask } from "@/tools/lib/tasks.ts";
import { toolchain } from "@/tools/lib/toolchain.ts";

export const agentsPlan = (dryRun: boolean): string[] => [
  "agents-md",
  "--no-symlink",
  ...(dryRun ? ["--dry-run"] : []),
];

export const formatPlan = (check: boolean): string[] =>
  check ? ["biome", "format", "."] : ["biome", "format", "--write", "."];

/** Coverage reporters and the 90% threshold live in bunfig.toml; Codecov reads coverage/lcov.info. */
export const testPlan = (coverage: boolean, filters: string[]): string[] => [
  "bun",
  "test",
  ...(coverage ? ["--coverage"] : []),
  ...filters,
];

export type CommitlintArgs = { edit?: string; from?: string; to?: string; message?: string };
export type CommitlintPlan = { command: string[]; stdin?: string };

/** Pick what to lint: a message, a commit-msg file, a commit range, or the last commit. */
export function commitlintPlan(args: CommitlintArgs): CommitlintPlan {
  if (args.message !== undefined) return { command: ["commitlint"], stdin: args.message };
  if (args.edit) return { command: ["commitlint", "--edit", args.edit] };
  if (args.from) return { command: ["commitlint", "--from", args.from, "--to", args.to ?? "HEAD"] };
  return { command: ["commitlint", "--last"] };
}

/** Prose checked by Vale against the vendored polyglot-clean-code styles. */
export const PROSE = ["README.md", "AGENTS.md", "docs"];

/**
 * Each linter and the command line it runs, in run order. actionlint and zizmor come from
 * pixi (tools/lib/toolchain.ts); dependency-cruiser needs Node 22+, so it runs on Bun's
 * runtime instead.
 */
export const LINTERS = {
  biome: (fix: boolean) => ["biome", "check", ...(fix ? ["--write"] : []), "."],
  types: () => ["tsc", "--noEmit", "-p", "tsconfig.json"],
  // Generated clients are not hand-written code; Biome and coverage skip them too.
  "ast-grep": () => ["ast-grep", "scan", "--config", "sgconfig.yml", "--globs", `!${CLIENTS_DIR}/**`],
  alint: () => ["alint", "check", ".", "-c", ".alint.yml"],
  vale: () => ["vale", "--no-global", "--config=.vale.ini", ...PROSE],
  knip: () => ["knip"],
  depcruise: () => [
    "bun",
    "run",
    "--bun",
    "depcruise",
    "tools",
    "--config",
    ".dependency-cruiser.json",
    "--output-type",
    "err",
  ],
  secretlint: () => ["secretlint", "**/*"],
  actionlint: () => ["actionlint"],
  zizmor: () => ["zizmor", "--offline", ".github"],
} satisfies Record<string, (fix: boolean) => string[]>;

export type Linter = keyof typeof LINTERS;
export const LINTER_NAMES = Object.keys(LINTERS) as Linter[];
export type LintStep = { name: Linter; command: string[] };

/**
 * The npm package behind every CLI the tools spawn by name. knip cannot see a binary
 * inside a string array, so knip.json ignores exactly these packages (a test keeps the
 * two lists equal), and anything else unused still fails the lint.
 */
export const CLI_PACKAGES: Record<string, string> = {
  biome: "@biomejs/biome",
  tsc: "typescript",
  "ast-grep": "@ast-grep/cli",
  alint: "@asamarts/alint",
  vale: "@vvago/vale",
  depcruise: "dependency-cruiser",
  secretlint: "secretlint",
  commitlint: "@commitlint/cli",
  "agents-md": "@eugeniughelbur/agents-md",
};

export function lintPlan(only: Linter | undefined, fix: boolean): LintStep[] {
  const names = only ? [only] : LINTER_NAMES;
  return names.map((name) => ({ name, command: LINTERS[name](fix) }));
}

/** One or more linters reported problems; their own output already explains which. */
export class LintError extends Error {
  constructor(readonly linters: string[]) {
    super(`Lint failed: ${linters.join(", ")}`);
    this.name = "LintError";
  }
}

/** Run every linter even after a failure, then fail once with the full list. */
export async function runLinters(steps: LintStep[], root: string = ROOT): Promise<void> {
  const failed: string[] = [];
  for (const step of steps) {
    try {
      await run(await toolchain.resolve(step.command, root));
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      failed.push(step.name);
    }
  }
  if (failed.length) throw new LintError(failed);
  log.success(`Lint passed: ${steps.map((step) => step.name).join(", ")}`);
}

/** Rendered prose whose links lychee checks. */
export const LINKED = ["README.md", "AGENTS.md", "docs"];

/** Links into this repository on GitHub, served from the working tree instead. */
export const SELF = "https://github\\.com/Archont561/Archont561";

/**
 * lychee over the rendered prose. Links to this repository's own files and workflows are
 * remapped to the working tree, so they are checked before a push; `offline` checks only
 * those and the anchors, which needs no network and so runs in the gate.
 */
export const linksPlan = (root: string, offline: boolean): string[] => [
  "lychee",
  "--config",
  "lychee.toml",
  "--remap",
  `^${SELF}/(?:blob|tree)/main/(.*)$ file://${root}/$1`,
  "--remap",
  `^${SELF}/actions/workflows/([a-z-]+\\.yml)(?:/badge\\.svg.*)?$ file://${root}/.github/workflows/$1`,
  ...(offline ? ["--offline"] : []),
  ...LINKED,
];

export const runLinks = async (root: string, offline: boolean): Promise<void> =>
  run(await toolchain.resolve(linksPlan(root, offline), root), { cwd: root });

export type GateStep = { name: string; run: () => Promise<void> };

/** The local equivalent of ci.yml, in the same order. */
export const gateSteps = (root: string): GateStep[] => [
  { name: "lint", run: () => runLinters(lintPlan(undefined, false)) },
  { name: "readme --check", run: () => renderTask(root, { check: true }) },
  { name: "links --offline", run: () => runLinks(root, true) },
  { name: "test", run: () => run(testPlan(true, [])) },
];

/** Run the steps in order; the first failure stops the gate. */
export async function runGate(steps: GateStep[]): Promise<void> {
  for (const step of steps) {
    log.step(`tools ${step.name}`);
    await step.run();
  }
  log.success("Quality gate passed.");
}
