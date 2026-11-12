/**
 * The committed snapshot of public facts, and the drift rule that decides when it
 * is rewritten: the capture date alone never produces a commit.
 */
import type { Clients } from "@/tools/lib/capture/clients.ts";
import {
  condaChannel,
  cratesUser,
  type GithubSummary,
  github,
  mavenNamespace,
  npmOrg,
  nugetOwner,
  portfolioTokens,
  pypiUser,
  type Registry,
  rUniverse,
} from "@/tools/lib/capture/sources.ts";

export type Accounts = {
  github: string;
  npmScope: string;
  pypi: string;
  crates: string;
  nuget: string;
  /** Maven Central namespace (groupId). */
  maven: string;
  /** R-universe name; its registry repository is `<github>/<rUniverse>.r-universe.dev`. */
  rUniverse: string;
  condaChannels: string[];
};

export type Snapshot = {
  captured: string;
  github: GithubSummary;
  registries: Registry[];
  tokens?: string;
};

export const today = (): string => new Date().toISOString().slice(0, 10);

export async function capture(
  clients: Clients,
  accounts: Accounts,
  options: { date?: string; tokensFallback?: string; fetch?: typeof fetch } = {},
): Promise<Snapshot> {
  const [repositories, tokens, ...registries] = await Promise.all([
    github(clients, accounts.github),
    portfolioTokens(options.fetch, options.tokensFallback),
    npmOrg(clients, accounts.npmScope),
    pypiUser(clients, accounts.pypi),
    cratesUser(clients, accounts.crates),
    nugetOwner(clients, accounts.nuget),
    mavenNamespace(clients, accounts.maven),
    rUniverse(clients, accounts.github, accounts.rUniverse),
    ...accounts.condaChannels.map((channel) => condaChannel(clients, channel)),
  ]);
  return {
    captured: options.date ?? today(),
    github: repositories,
    registries,
    ...(tokens ? { tokens } : {}),
  };
}

/** Compare content only, ignoring the capture date. */
export function sameContent(a: Partial<Snapshot>, b: Partial<Snapshot>): boolean {
  return JSON.stringify({ ...a, captured: undefined }) === JSON.stringify({ ...b, captured: undefined });
}

/** Write `fresh` to `path` when its content drifted; resolves to whether it wrote. */
export async function saveIfChanged(path: string, fresh: Snapshot): Promise<boolean> {
  const file = Bun.file(path);
  const committed: Partial<Snapshot> = (await file.exists()) ? await file.json() : {};
  if (sameContent(committed, fresh)) return false;
  await Bun.write(path, `${JSON.stringify(fresh, null, 2)}\n`);
  return true;
}
