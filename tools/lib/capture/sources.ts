/**
 * One function per public data source. Accounts are discovered, not curated: each
 * source lists its own packages, so a new release appears without editing a manifest.
 */
import type { ResultOf } from "gql.tada";
import { findUser, listCrates } from "@/tools/lib/capture/clients/crates/index.ts";
import { reposGetContent, reposListForUser } from "@/tools/lib/capture/clients/github/index.ts";
import { getRepositoryFile, searchArtifacts } from "@/tools/lib/capture/clients/maven/index.ts";
import { getPackument, listOrgPackages } from "@/tools/lib/capture/clients/npm/index.ts";
import { getRegistrationLeaf, searchPackages } from "@/tools/lib/capture/clients/nuget/index.ts";
import { getProject, xmlRpc } from "@/tools/lib/capture/clients/pypi/index.ts";
import { listUniversePackages } from "@/tools/lib/capture/clients/runiverse/index.ts";
import { BASE_URLS, type Clients, graphql, universeUrl } from "@/tools/lib/capture/clients.ts";
import { HttpError } from "@/tools/lib/capture/http.ts";

export type Pkg = {
  name: string;
  version: string | null;
  published: string | null;
  description: string | null;
  reserved: boolean;
  url: string;
};

export type Registry = {
  id: string;
  label: string;
  account: string;
  url: string;
  install?: string;
  packages: Pkg[];
};

export type GithubSummary = {
  owned: number;
  forks: number;
  archived: number;
  titled: number;
  languages: { name: string; count: number }[];
  /** Authored (non-fork) repositories by name: what project cards show as their stack. */
  repos: RepoFacts[];
};

export type RepoFacts = { name: string; language: string | null; topics: string[] };

/** Placeholder releases that hold a name rather than ship code. */
const RESERVATION = /placeholder|reserved package name|trusted.?publishing/i;

export const day = (stamp?: string | null): string | null => (stamp ? stamp.slice(0, 10) : null);

export const isReserved = (version: string | null, description: string | null): boolean =>
  version === "0.0.0" || RESERVATION.test(description ?? "");

export const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase());

type Repo = { name: string; language?: string | null; fork: boolean; archived?: boolean; topics?: string[] };

export function summarize(repos: Repo[]): GithubSummary {
  const languages = new Map<string, number>();
  for (const repo of repos) {
    if (repo.language) languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1);
  }
  return {
    owned: repos.length,
    forks: repos.filter((repo) => repo.fork).length,
    archived: repos.filter((repo) => repo.archived).length,
    titled: repos.filter((repo) => (repo.topics ?? []).length > 0).length,
    languages: [...languages]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([name, count]) => ({ name, count })),
    repos: repos
      .filter((repo) => !repo.fork)
      .map((repo) => ({ name: repo.name, language: repo.language ?? null, topics: repo.topics ?? [] }))
      .sort(byName),
  };
}

export async function github(clients: Clients, owner: string): Promise<GithubSummary> {
  const { data } = await reposListForUser({
    client: clients.github,
    path: { username: owner },
    query: { per_page: 100, type: "owner" },
    throwOnError: true,
  });
  return summarize(data);
}

export async function npmOrg(clients: Clients, scope: string): Promise<Registry> {
  const client = clients.npm;
  const { data: owned } = await listOrgPackages({ client, path: { scope }, throwOnError: true });
  const packages = await Promise.all(
    Object.keys(owned).map(async (name): Promise<Pkg> => {
      const { data: doc } = await getPackument({ client, path: { name }, throwOnError: true });
      const version = doc["dist-tags"]?.latest ?? null;
      const description = doc.description ?? null;
      return {
        name,
        version,
        published: day(version ? doc.time?.[version] : null),
        description,
        reserved: isReserved(version, description),
        url: `https://www.npmjs.com/package/${name}`,
      };
    }),
  );
  return {
    id: "npm",
    label: "npm",
    account: `@${scope}`,
    url: `https://www.npmjs.com/org/${scope}`,
    packages: packages.sort(byName),
  };
}

/** Package names from a PyPI XML-RPC `user_packages` response. */
export function parseUserPackages(xml: string): string[] {
  const values = [...xml.matchAll(/<string>([^<]+)<\/string>/g)].map((match) => match[1] as string);
  return [...new Set(values.filter((value) => value !== "Owner" && value !== "Maintainer"))];
}

export const userPackagesCall = (user: string): string =>
  `<?xml version="1.0"?><methodCall><methodName>user_packages</methodName><params><param><value><string>${user}</string></value></param></params></methodCall>`;

export async function pypiUser(clients: Clients, user: string): Promise<Registry> {
  const client = clients.pypi;
  // The user page sits behind a JavaScript challenge; XML-RPC still lists ownership.
  const { data: xml } = await xmlRpc({
    client,
    body: userPackagesCall(user),
    parseAs: "text",
    throwOnError: true,
  });
  const packages = await Promise.all(
    parseUserPackages(xml).map(async (name): Promise<Pkg> => {
      const { data: doc } = await getProject({ client, path: { project: name }, throwOnError: true });
      const version = doc.info.version ?? null;
      const files = (version && doc.releases?.[version]) || [];
      const description = doc.info.summary || null;
      return {
        name,
        version,
        published: day(files[0]?.upload_time ?? null),
        description,
        reserved: isReserved(version, description),
        url: `https://pypi.org/project/${name}/`,
      };
    }),
  );
  return {
    id: "pypi",
    label: "PyPI",
    account: user,
    url: `https://pypi.org/user/${user}/`,
    packages: packages.sort(byName),
  };
}

export async function cratesUser(clients: Clients, user: string): Promise<Registry> {
  const client = clients.crates;
  const { data: found } = await findUser({ client, path: { user }, throwOnError: true });
  const { data: listing } = await listCrates({
    client,
    query: { user_id: found.user.id, per_page: 100 },
    throwOnError: true,
  });
  const packages = listing.crates.map(
    (crate): Pkg => ({
      name: crate.name,
      version: crate.max_version,
      published: day(crate.updated_at),
      description: crate.description,
      reserved: isReserved(crate.max_version, crate.description),
      url: `https://crates.io/crates/${crate.name}`,
    }),
  );
  return {
    id: "crates",
    label: "crates.io",
    account: user,
    url: `https://crates.io/users/${user}`,
    packages: packages.sort(byName),
  };
}

export async function nugetOwner(clients: Clients, owner: string): Promise<Registry> {
  const client = clients.nuget;
  const { data: found } = await searchPackages({
    client,
    baseUrl: BASE_URLS.nugetSearch,
    query: { q: `owner:${owner}`, take: 100, prerelease: true, semVerLevel: "2.0.0" },
    throwOnError: true,
  });
  // `owner:` is a search filter, not an exact match; keep only packages this account owns.
  const owned = found.data.filter((pkg) =>
    (pkg.owners ?? []).some((name) => name.toLowerCase() === owner.toLowerCase()),
  );
  const packages = await Promise.all(
    owned.map(async (pkg): Promise<Pkg> => {
      const { data: leaf } = await getRegistrationLeaf({
        client,
        path: { id: pkg.id.toLowerCase(), version: pkg.version.toLowerCase() },
        throwOnError: true,
      });
      const description = pkg.description || pkg.summary || null;
      return {
        name: pkg.id,
        version: pkg.version,
        published: day(leaf.published),
        description,
        reserved: isReserved(pkg.version, description),
        url: `https://www.nuget.org/packages/${pkg.id}`,
      };
    }),
  );
  return {
    id: "nuget",
    label: "NuGet",
    account: owner,
    url: `https://www.nuget.org/profiles/${owner}`,
    packages: packages.sort(byName),
  };
}

/** The `<description>` of a POM, unescaped; null when absent or empty. */
export function pomDescription(pom: string): string | null {
  const project = pom.replace(/<parent>[\s\S]*?<\/parent>/, "");
  const text = project.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.trim();
  if (!text) return null;
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return text
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => entities[name] as string)
    .replace(/\s+/g, " ");
}

export async function mavenNamespace(clients: Clients, namespace: string): Promise<Registry> {
  const client = clients.maven;
  const { data: found } = await searchArtifacts({
    client,
    query: { q: `g:${namespace}`, rows: 200, wt: "json" },
    throwOnError: true,
  });
  const artifacts = found.response.docs.filter((doc) => doc.g === namespace);
  const packages = await Promise.all(
    artifacts.map(async (doc): Promise<Pkg> => {
      const version = doc.latestVersion;
      const { data: pom } = await getRepositoryFile({
        client,
        baseUrl: BASE_URLS.mavenRepo,
        path: {
          groupPath: namespace.replaceAll(".", "/"),
          artifact: doc.a,
          version,
          file: `${doc.a}-${version}.pom`,
        },
        parseAs: "text",
        throwOnError: true,
      });
      const description = pomDescription(pom);
      return {
        name: doc.a,
        version,
        published: day(doc.timestamp ? new Date(doc.timestamp).toISOString() : null),
        description,
        reserved: isReserved(version, description),
        url: `https://central.sonatype.com/artifact/${namespace}/${doc.a}`,
      };
    }),
  );
  return {
    id: "maven",
    label: "Maven Central",
    account: namespace,
    url: `https://central.sonatype.com/namespace/${namespace}`,
    packages: packages.sort(byName),
  };
}

/** Entries of an R-universe registry file (`packages.json`). */
export type UniverseEntry = { package: string; url: string };

/** The repository that registers a universe's packages: `<owner>/<universe>.r-universe.dev`. */
export const universeRegistry = (owner: string, universe: string) => ({
  owner,
  repo: `${universe}.r-universe.dev`,
});

async function registeredPackages(
  clients: Clients,
  owner: string,
  universe: string,
): Promise<UniverseEntry[]> {
  const { data: file } = await reposGetContent({
    client: clients.github,
    path: { ...universeRegistry(owner, universe), path: "packages.json" },
    throwOnError: true,
  });
  if (Array.isArray(file) || file.type !== "file") {
    throw new Error(`${owner}/${universe}.r-universe.dev: packages.json is not a file`);
  }
  return JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) as UniverseEntry[];
}

/** A universe lists what it has built; a 404 means nothing is built yet. */
async function builtPackages(clients: Clients, universe: string) {
  try {
    const { data } = await listUniversePackages({
      client: clients.runiverse,
      baseUrl: universeUrl(universe),
      query: { fields: "Package,Version,Title,_published", limit: 500 },
      throwOnError: true,
    });
    return data;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return [];
    throw error;
  }
}

/**
 * Registered packages from the universe's registry repository, with version and date
 * from the universe once built. A registered name with no build yet holds the name only.
 */
export async function rUniverse(clients: Clients, owner: string, universe: string): Promise<Registry> {
  const [registered, built] = await Promise.all([
    registeredPackages(clients, owner, universe),
    builtPackages(clients, universe),
  ]);
  const builds = new Map(built.map((pkg) => [pkg.Package, pkg]));
  const site = universeUrl(universe);
  const names = [...new Set([...registered.map((entry) => entry.package), ...builds.keys()])];
  const packages = names.map((name): Pkg => {
    const build = builds.get(name);
    const description = build?.Title || null;
    return {
      name,
      version: build?.Version ?? null,
      published: day(build?._published),
      description,
      reserved: !build || isReserved(build.Version, description),
      url: build ? `${site}/${name}` : (registered.find((entry) => entry.package === name)?.url as string),
    };
  });
  const { repo } = universeRegistry(owner, universe);
  return {
    id: "r-universe",
    label: "R-universe",
    account: universe,
    // The universe site answers 404 until its first build; the registry repository always resolves.
    url: built.length ? site : `https://github.com/${owner}/${repo}`,
    install: site,
    packages: packages.sort(byName),
  };
}

/** One page of a prefix.dev channel listing, typed from the introspected schema. */
export const ChannelPackages = graphql(`
  query ChannelPackages($channel: String!, $page: Int!) {
    channel(name: $channel) {
      packages(limit: 50, page: $page) {
        pages
        page { name summary lastCreatedDate versions(limit: 1) { page { version } } }
      }
    }
  }
`);

type ChannelRow = NonNullable<ResultOf<typeof ChannelPackages>["channel"]>["packages"]["page"][number];

export async function condaChannel(clients: Clients, channel: string): Promise<Registry> {
  const [owner, name] = channel.split("/");
  const rows: ChannelRow[] = [];
  for (let page = 0, pages = 1; page < pages; page++) {
    const result = await clients.prefix(ChannelPackages, { channel, page });
    const listing = result.channel?.packages;
    if (!listing) throw new Error(`prefix.dev did not resolve channel ${channel}`);
    pages = listing.pages;
    rows.push(...listing.page);
  }
  const packages = rows.map(
    (row): Pkg => ({
      name: row.name,
      version: row.versions.page[0]?.version ?? null,
      published: day(row.lastCreatedDate),
      description: row.summary || null,
      // Upstream dev versions such as 0.0.0.dev20220721 are real builds, not stubs.
      reserved: false,
      url: `https://prefix.dev/channels/@${owner}/${name}/packages/${row.name}`,
    }),
  );
  return {
    id: `conda-${name}`,
    label: "Conda",
    account: channel,
    url: `https://prefix.dev/channels/@${owner}/${name}`,
    install: `https://prefix.dev/${channel}`,
    packages: packages.sort(byName),
  };
}

export const TOKENS_URL =
  "https://raw.githubusercontent.com/Archont561/archont561.github.io/main/apps/portfolio/src/app/tokens.css";
export const TOKENS_API_URL =
  "https://api.github.com/repos/Archont561/archont561.github.io/contents/apps/portfolio/src/app/tokens.css?ref=main";

/**
 * Fetch the portfolio tokens.css from its pinned ref, falling back to the committed snapshot
 * on network or HTTP failure.
 */
export async function portfolioTokens(fetcher: typeof fetch = fetch, fallback?: string): Promise<string> {
  const direct = await fetcher(TOKENS_URL)
    .then(async (res) => (res.ok ? await res.text() : null))
    .catch(() => null);
  if (direct) return direct;

  const api = await fetcher(TOKENS_API_URL, { headers: { Accept: "application/vnd.github.v3.raw" } })
    .then(async (res) => (res.ok ? await res.text() : null))
    .catch(() => null);
  if (api) return api;

  if (fallback !== undefined) return fallback;
  return "";
}
