/**
 * `bun run tools pr`: open a pull request whose body is the rendered PR template.
 *
 * The title is linted with commitlint (it becomes the squash commit), the branch is pushed
 * (which runs the lefthook pre-push `check`), then `gh pr create` receives the body on stdin.
 */
import { log } from "@/tools/lib/log.ts";
import { commitlintPlan } from "@/tools/lib/quality.ts";
import { PR_TEMPLATE, renderPrTemplate, SUMMARY_PLACEHOLDER } from "@/tools/lib/render/pr.ts";
import { run, runner } from "@/tools/lib/run.ts";

export type PrOptions = {
  base: string;
  title?: string;
  summary?: string;
  draft?: boolean;
  dryRun?: boolean;
};

export type PrPlan = { branch: string; title: string; body: string; commands: string[][] };

export class PrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrError";
  }
}

/** The template without its leading generated-file comments, summary and commits filled in. */
export function fillTemplate(template: string, fill: { summary?: string; commits: string[] }): string {
  const start = template.indexOf("## ");
  if (start === -1 || !template.includes(SUMMARY_PLACEHOLDER)) {
    throw new PrError(`${PR_TEMPLATE} lost its sections or summary placeholder; fix templates/pr.ejs.`);
  }
  let body = template.slice(start);
  if (fill.summary?.trim()) body = body.replace(SUMMARY_PLACEHOLDER, fill.summary.trim());
  if (!fill.commits.length) return body;
  return `${body.trimEnd()}\n\n## Commits\n\n${fill.commits.map((subject) => `- ${subject}`).join("\n")}\n`;
}

async function git(root: string, args: string[]): Promise<string> {
  const result = await runner.capture(["git", ...args], { cwd: root });
  if (result.code !== 0) throw new PrError(`\`git ${args.join(" ")}\` exited with code ${result.code}`);
  return result.stdout;
}

/** Work out the branch, title, body and command lines without changing anything. */
export async function prPlan(root: string, options: PrOptions): Promise<PrPlan> {
  const branch = await git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch === "HEAD") throw new PrError("HEAD is detached; check out a topic branch first.");
  if (branch === options.base)
    throw new PrError(`Open pull requests from a topic branch, not ${options.base}.`);
  const log = await git(root, ["log", "--reverse", "--format=%s", `origin/${options.base}..HEAD`]);
  const commits = log ? log.split("\n") : [];
  if (!commits.length) throw new PrError(`${branch} has no commits ahead of origin/${options.base}.`);
  const title = options.title?.trim() || (commits.length === 1 ? commits[0] : undefined);
  if (!title) {
    throw new PrError(
      `${branch} has ${commits.length} commits; pass --title (it becomes the squash commit).`,
    );
  }
  const body = fillTemplate(await renderPrTemplate(root), { summary: options.summary, commits });
  const create = ["gh", "pr", "create", "--base", options.base, "--head", branch, "--title", title];
  return {
    branch,
    title,
    body,
    commands: [
      commitlintPlan({ message: title }).command,
      ["git", "push", "--set-upstream", "origin", branch],
      [...create, "--body-file", "-", ...(options.draft ? ["--draft"] : [])],
    ],
  };
}

export async function prTask(root: string, options: PrOptions): Promise<PrPlan> {
  const plan = await prPlan(root, options);
  if (options.dryRun) {
    log.info(`${plan.commands.map((command) => `$ ${command.join(" ")}`).join("\n")}\n\n${plan.body}`);
    return plan;
  }
  const [lint, push, create] = plan.commands as [string[], string[], string[]];
  await run(lint, { cwd: root, stdin: plan.title });
  await run(push, { cwd: root });
  await run(create, { cwd: root, stdin: plan.body });
  log.success(`Opened a pull request for ${plan.branch}.`);
  return plan;
}
