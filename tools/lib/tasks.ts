/**
 * Orchestration behind the profile tools: capture, render, and refresh.
 * Dependencies are parameters so tests can run them against a temporary root.
 */

import { createClients } from "@/tools/lib/capture/clients.ts";
import { createFetch } from "@/tools/lib/capture/http.ts";
import { type Accounts, capture, type Snapshot, saveIfChanged } from "@/tools/lib/capture/snapshot.ts";
import type { Env } from "@/tools/lib/config/env.ts";
import { log } from "@/tools/lib/log.ts";
import { BADGE_DIR, CARD_DIR, staleOutputs, writeOutputs } from "@/tools/lib/render/outputs.ts";
import { buildOutputs } from "@/tools/lib/render/profile.ts";
import { run, runner } from "@/tools/lib/run.ts";

export const SNAPSHOT = "data/snapshot.json";

export class StaleOutputError extends Error {
  constructor(readonly paths: string[]) {
    super(`Stale: ${paths.join(", ")}. Run \`bun run tools readme\` and commit the result.`);
    this.name = "StaleOutputError";
  }
}

async function accounts(root: string): Promise<Accounts> {
  return (await Bun.file(`${root}/data/profile.json`).json()).accounts;
}

export async function captureTask(
  root: string,
  options: { print?: boolean; fetch?: typeof fetch; env: Env },
): Promise<boolean> {
  const clients = createClients({
    fetch: options.fetch ?? createFetch(),
    githubToken: options.env.githubToken,
  });
  const snapshotPath = `${root}/${SNAPSHOT}`;
  const file = Bun.file(snapshotPath);
  const committed: Partial<Snapshot> = (await file.exists()) ? await file.json() : {};
  const fresh = await capture(clients, await accounts(root), {
    fetch: options.fetch,
    tokensFallback: committed.tokens,
  });
  if (options.print) {
    log.info(JSON.stringify(fresh, null, 2));
    return false;
  }
  const changed = await saveIfChanged(snapshotPath, fresh);
  log.success(changed ? `Snapshot updated (captured ${fresh.captured}).` : "Snapshot already current.");
  return changed;
}

export async function renderTask(root: string, options: { check?: boolean } = {}): Promise<void> {
  const outputs = await buildOutputs(root);
  const paths = [...outputs.keys()];
  const inDir = (dir: string) => paths.filter((path) => path.startsWith(`${dir}/`)).length;
  const cards = inDir(CARD_DIR);
  const badges = inDir(BADGE_DIR);
  const named = paths.filter((path) => !path.startsWith(`${BADGE_DIR}/`) && !path.startsWith(`${CARD_DIR}/`));
  const files = [...named, ...(cards ? [`${cards} cards`] : [])].join(", ");
  if (options.check) {
    const stale = await staleOutputs(root, outputs);
    if (stale.length) throw new StaleOutputError(stale);
    log.success(`${files}, and ${badges} badges are current.`);
    return;
  }
  const { removed } = await writeOutputs(root, outputs);
  for (const path of removed) log.warn(`Removed orphan ${path}`);
  log.success(`Rendered ${files}, and ${badges} badges.`);
}

export const REFRESH_PATHS = [SNAPSHOT, "README.md", "assets"];
export const BOT = {
  name: "github-actions[bot]",
  email: "41898282+github-actions[bot]@users.noreply.github.com",
};

/** Capture, render, and (optionally) commit and push when anything drifted. */
export async function refreshTask(
  root: string,
  options: { commit?: boolean; fetch?: typeof fetch; env: Env },
): Promise<boolean> {
  await captureTask(root, { fetch: options.fetch, env: options.env });
  await renderTask(root);
  const status = await runner.capture(["git", "status", "--porcelain", "--", ...REFRESH_PATHS], {
    cwd: root,
  });
  if (!status.stdout) {
    log.success("No drift since the last capture.");
    return false;
  }
  if (!options.commit) {
    log.info(`Drift detected:\n${status.stdout}`);
    return true;
  }
  const identity = options.env.ci ? ["-c", `user.name=${BOT.name}`, "-c", `user.email=${BOT.email}`] : [];
  await run(["git", "add", "--", ...REFRESH_PATHS], { cwd: root });
  await run(["git", ...identity, "commit", "-m", "chore(data): refresh profile snapshot"], { cwd: root });
  await run(["git", "pull", "--rebase", "origin", "main"], { cwd: root });
  await run(["git", "push", "origin", "HEAD:main"], { cwd: root });
  return true;
}
