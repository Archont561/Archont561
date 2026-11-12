/**
 * Project fixtures for the tools suite, composed on bun-test-utils' built-ins.
 * Import `test` from here (not from the package) in every test file.
 *
 * - `logs`      recordLog() sink, restored at teardown.
 * - `proc`      runner.exec / runner.capture spies; nothing is spawned. Pixi tools
 *               resolve to `/pixi/<name>` whether or not the environment is installed.
 * - `repo`      a temporary repository root holding the files render/capture read.
 * - `registry`  serves a registry `World` through httpMock, behind networkGuard,
 *               so a test can never reach the real network.
 * - `exitCode`  restores process.exitCode after commands that set it.
 *
 * `fakeGit` scripts the `proc` capture spy as a git checkout for `bun run tools pr`.
 *
 * `worldArb` generates arbitrary registry worlds for `test.scenario.prop`.
 */
import { type Mock, spyOn } from "bun:test";
import { cp } from "node:fs/promises";
import { join } from "node:path";
import { test as base } from "@archont561/bun-test-utils";
import type fc from "fast-check";
import snapshot from "@/data/snapshot.json" with { type: "json" };
import type { Accounts } from "@/tools/lib/capture/snapshot.ts";
import { recordLog } from "@/tools/lib/log.ts";
import { ROOT } from "@/tools/lib/paths.ts";
import { runner } from "@/tools/lib/run.ts";
import { isPixiTool, toolchain } from "@/tools/lib/toolchain.ts";

export const DEFAULT_TOKENS_CSS: string = snapshot.tokens ?? "";

export type FastCheck = typeof fc;

// ---------------------------------------------------------------- registry world

export type Repo = {
  name: string;
  language: string | null;
  fork: boolean;
  archived: boolean;
  topics: string[];
};
export type Release = { name: string; version: string; published: string; description: string };
export type CondaRow = { name: string; version: string | null; published: string | null; summary: string };

export type World = {
  accounts: Accounts;
  repos: Repo[];
  npm: Release[];
  pypi: Release[];
  crates: Release[];
  nuget: Release[];
  maven: Release[];
  /** Names in the universe's registry repository; `built` holds those R-universe has built. */
  universe: { registered: string[]; built: Release[] };
  conda: Record<string, CondaRow[]>;
};

/** The accounts in data/profile.json. */
export const ACCOUNTS: Accounts = {
  github: "Archont561",
  npmScope: "archont561",
  pypi: "Archont561",
  crates: "Archont561",
  nuget: "Archont561",
  maven: "io.github.archont561",
  rUniverse: "archont561",
  condaChannels: ["archont561/archont561", "archont561/geospatial"],
};

/** A small, consistent world covering every source. */
export const WORLD: World = {
  accounts: ACCOUNTS,
  repos: [
    { name: "geo-tools", language: "Python", fork: false, archived: false, topics: ["gis"] },
    { name: "forked", language: "Rust", fork: true, archived: true, topics: [] },
    { name: "Notes", language: null, fork: false, archived: false, topics: [] },
  ],
  npm: [{ name: "@archont561/kit", version: "1.2.0", published: "2026-05-06", description: "Kit" }],
  pypi: [{ name: "geo-tools", version: "0.3.0", published: "2026-04-01", description: "Geo tools" }],
  crates: [{ name: "clifacet", version: "0.2.0", published: "2026-03-04", description: "CLI" }],
  nuget: [
    { name: "Playtest", version: "0.0.0", published: "2026-10-23", description: "Reserved placeholder" },
  ],
  maven: [
    { name: "playtest", version: "1.0.0", published: "2026-10-24", description: "Polyglot tests & more" },
  ],
  universe: {
    registered: ["geor", "playtest"],
    built: [{ name: "geor", version: "0.2.0", published: "2026-09-01", description: "Geo R" }],
  },
  conda: {
    "archont561/archont561": [
      { name: "qgis-sdk", version: "4.0.0", published: "2026-06-01", summary: "SDK" },
    ],
    "archont561/geospatial": [],
  },
};

const CRATES_USER_ID = 7;
const PAGE_SIZE = 50;

const xmlRpcPackages = (names: string[]): string =>
  `<?xml version="1.0"?><methodResponse><params><param><value><array><data>${names
    .map(
      (name) =>
        `<value><array><data><value><string>Owner</string></value><value><string>${name}</string></value></data></array></value>`,
    )
    .join("")}</data></array></value></param></params></methodResponse>`;

const notFound = (url: URL) => new Response(`no route for ${url.href}`, { status: 404 });

const escapeXml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Packages that a search returns but this account does not own, so filters are exercised. */
const NUGET_DECOY = { id: "Decoy.Package", version: "1.0.0", owners: ["someone-else"] };
const MAVEN_DECOY = { g: "io.github.archont561.decoy", a: "decoy", latestVersion: "1.0.0" };

/** What a route handler sees; `at` matches host and decoded path exactly. */
type Ask = {
  world: World;
  accounts: Accounts;
  request: Request;
  url: URL;
  at: (host: string, path: string) => boolean;
};
/** One registry's routes: a response, or undefined to let the next registry answer. */
type Handler = (ask: Ask) => Response | undefined | Promise<Response | undefined>;

const githubRoute: Handler = ({ world, accounts, at }) => {
  if (at("api.github.com", `/users/${accounts.github}/repos`)) return Response.json(world.repos);
  return undefined;
};

const npmRoute: Handler = ({ world, accounts, at }) => {
  if (at("registry.npmjs.org", `/-/org/${accounts.npmScope}/package`)) {
    return Response.json(Object.fromEntries(world.npm.map((pkg) => [pkg.name, "write"])));
  }
  const npm = world.npm.find((pkg) => at("registry.npmjs.org", `/${pkg.name}`));
  if (!npm) return undefined;
  return Response.json({
    name: npm.name,
    description: npm.description,
    "dist-tags": { latest: npm.version },
    time: { [npm.version]: `${npm.published}T07:08:09.000Z` },
  });
};

const pypiRoute: Handler = async ({ world, accounts, request, url, at }) => {
  if (at("pypi.org", "/pypi") && request.method === "POST") {
    const body = await request.text();
    if (!body.includes(`<string>${accounts.pypi}</string>`)) return notFound(url);
    return new Response(xmlRpcPackages(world.pypi.map((pkg) => pkg.name)), {
      headers: { "Content-Type": "text/xml" },
    });
  }
  const pypi = world.pypi.find((pkg) => at("pypi.org", `/pypi/${pkg.name}/json`));
  if (!pypi) return undefined;
  return Response.json({
    info: { version: pypi.version, summary: pypi.description },
    releases: { [pypi.version]: [{ upload_time: `${pypi.published}T10:00:00` }] },
  });
};

const cratesRoute: Handler = ({ world, accounts, url, at }) => {
  if (at("crates.io", `/api/v1/users/${accounts.crates}`)) {
    return Response.json({ user: { id: CRATES_USER_ID, login: accounts.crates } });
  }
  if (!at("crates.io", "/api/v1/crates") || url.searchParams.get("user_id") !== String(CRATES_USER_ID)) {
    return undefined;
  }
  return Response.json({
    crates: world.crates.map((crate) => ({
      name: crate.name,
      max_version: crate.version,
      updated_at: `${crate.published}T00:00:00Z`,
      description: crate.description,
    })),
    meta: { total: world.crates.length },
  });
};

const nugetRoute: Handler = ({ world, accounts, url, at }) => {
  if (at("azuresearch-usnc.nuget.org", "/query") && url.searchParams.get("q") === `owner:${accounts.nuget}`) {
    const data = world.nuget.map((pkg) => ({
      id: pkg.name,
      version: pkg.version,
      description: pkg.description,
      owners: [accounts.nuget],
    }));
    return Response.json({ totalHits: data.length + 1, data: [...data, NUGET_DECOY] });
  }
  const leaf = (pkg: Release) =>
    `/v3/registration5-gz-semver2/${pkg.name.toLowerCase()}/${pkg.version.toLowerCase()}.json`;
  const nuget = world.nuget.find((pkg) => at("api.nuget.org", leaf(pkg)));
  if (!nuget) return undefined;
  return Response.json({ listed: true, published: `${nuget.published}T19:36:05.87+00:00` });
};

const mavenRoute: Handler = ({ world, accounts, url, at }) => {
  if (
    at("central.sonatype.com", "/solrsearch/select") &&
    url.searchParams.get("q") === `g:${accounts.maven}`
  ) {
    const docs = world.maven.map((pkg) => ({
      g: accounts.maven,
      a: pkg.name,
      latestVersion: pkg.version,
      timestamp: Date.parse(`${pkg.published}T12:00:00Z`),
    }));
    return Response.json({ response: { numFound: docs.length + 1, docs: [...docs, MAVEN_DECOY] } });
  }
  const group = accounts.maven.replaceAll(".", "/");
  const pomPath = (pkg: Release) =>
    `/maven2/${group}/${pkg.name}/${pkg.version}/${pkg.name}-${pkg.version}.pom`;
  const pom = world.maven.find((pkg) => at("repo1.maven.org", pomPath(pkg)));
  if (!pom) return undefined;
  return new Response(
    `<project><parent><description>Parent POM</description></parent><artifactId>${pom.name}</artifactId>` +
      `<description>${escapeXml(pom.description)}</description></project>`,
    { headers: { "Content-Type": "text/xml" } },
  );
};

const universeRoute: Handler = ({ world, accounts, at }) => {
  const registry = `/repos/${accounts.github}/${accounts.rUniverse}.r-universe.dev/contents/packages.json`;
  if (at("api.github.com", registry)) {
    const entries = world.universe.registered.map((name) => ({
      package: name,
      url: `https://github.com/${accounts.github}/${name}`,
    }));
    const content = Buffer.from(JSON.stringify(entries)).toString("base64");
    return Response.json({ type: "file", encoding: "base64", content });
  }
  if (!at(`${accounts.rUniverse}.r-universe.dev`, "/api/packages")) return undefined;
  const { built } = world.universe;
  if (!built.length) {
    return new Response(`No packages found for this owner or maintainer: ${accounts.rUniverse}`, {
      status: 404,
    });
  }
  return Response.json(
    built.map((pkg) => ({
      Package: pkg.name,
      Version: pkg.version,
      Title: pkg.description,
      _published: `${pkg.published}T11:23:15.186Z`,
    })),
  );
};

const prefixRoute: Handler = async ({ world, request, at }) => {
  if (!at("prefix.dev", "/api/graphql") || request.method !== "POST") return undefined;
  const { variables } = (await request.json()) as { variables: { channel: string; page: number } };
  const rows = world.conda[variables.channel];
  if (!rows) return Response.json({ data: { channel: null } });
  const slice = rows.slice(variables.page * PAGE_SIZE, (variables.page + 1) * PAGE_SIZE);
  return Response.json({
    data: {
      channel: {
        packages: {
          pages: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
          page: slice.map((row) => ({
            name: row.name,
            summary: row.summary,
            lastCreatedDate: row.published && `${row.published}T00:00:00Z`,
            versions: { page: row.version ? [{ version: row.version }] : [] },
          })),
        },
      },
    },
  });
};

const tokensRoute: Handler = ({ at }) => {
  if (
    at(
      "raw.githubusercontent.com",
      "/Archont561/archont561.github.io/main/apps/portfolio/src/app/tokens.css",
    ) ||
    at("api.github.com", "/repos/Archont561/archont561.github.io/contents/apps/portfolio/src/app/tokens.css")
  ) {
    return new Response(DEFAULT_TOKENS_CSS, { headers: { "Content-Type": "text/css" } });
  }
  return undefined;
};

const ROUTES: Handler[] = [
  tokensRoute,
  githubRoute,
  npmRoute,
  pypiRoute,
  cratesRoute,
  nugetRoute,
  mavenRoute,
  universeRoute,
  prefixRoute,
];

/** Answer one request from `world` the way the real registries would. */
export async function route(world: World, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const at = (host: string, path: string) => url.host === host && decodeURIComponent(url.pathname) === path;
  for (const handler of ROUTES) {
    const response = await handler({ world, accounts: world.accounts, request, url, at });
    if (response) return response;
  }
  return notFound(url);
}

// ---------------------------------------------------------------- arbitraries

const NAME = /^[a-z][a-z0-9-]{1,14}$/;

/** fast-check strategies for registry worlds; pass `fc` from `test.scenario.prop`. */
export function worldArb(fc: FastCheck): fc.Arbitrary<World> {
  const name = fc.stringMatching(NAME);
  const date = fc
    .date({ min: new Date("2015-01-01"), max: new Date("2026-12-31"), noInvalidDate: true })
    .map((value) => value.toISOString().slice(0, 10));
  const version = fc.oneof(
    { weight: 1, arbitrary: fc.constant("0.0.0") },
    { weight: 4, arbitrary: fc.tuple(fc.nat(9), fc.nat(20), fc.nat(20)).map((parts) => parts.join(".")) },
  );
  const description = fc.oneof(
    fc.constantFrom("Placeholder", "reserved package name", "Geo tools", "SDK", "CLI"),
    fc.stringMatching(/^[A-Z][a-z ]{0,20}$/),
  );
  const release = (prefix = "") =>
    fc.record({ name: name.map((value) => `${prefix}${value}`), version, published: date, description });
  const releases = (prefix?: string) =>
    fc.uniqueArray(release(prefix), { selector: (pkg) => pkg.name.toLowerCase(), maxLength: 6 });
  const repo = fc.record({
    name,
    language: fc.option(fc.constantFrom("Python", "Rust", "TypeScript", "Astro", "Go"), { nil: null }),
    fork: fc.boolean(),
    archived: fc.boolean(),
    topics: fc.array(name, { maxLength: 2 }),
  });
  const condaRow = fc.record({
    name,
    version: fc.option(version, { nil: null }),
    published: fc.option(date, { nil: null }),
    summary: description,
  });
  const rows = (minLength: number, maxLength: number) =>
    fc.uniqueArray(condaRow, { selector: (row) => row.name, minLength, maxLength });
  // A quarter of channels span several GraphQL pages, so paging is exercised every run.
  const channel = fc.oneof(
    { weight: 3, arbitrary: rows(0, 6) },
    { weight: 1, arbitrary: rows(PAGE_SIZE + 1, 2 * PAGE_SIZE + 5) },
  );
  return fc.record({
    accounts: fc.constant(ACCOUNTS),
    repos: fc.uniqueArray(repo, { selector: (r) => r.name.toLowerCase(), maxLength: 12 }),
    npm: releases(`@${ACCOUNTS.npmScope}/`),
    pypi: releases(),
    crates: releases(),
    // NuGet ids are mixed-case; registration URLs must lowercase them.
    nuget: releases().map((pkgs) =>
      pkgs.map((pkg) => ({ ...pkg, name: pkg.name[0]?.toUpperCase() + pkg.name.slice(1) })),
    ),
    maven: releases(),
    universe: fc
      .uniqueArray(fc.tuple(name, release(), fc.boolean()), { selector: ([value]) => value, maxLength: 5 })
      .map((rows) => ({
        registered: rows.map(([value]) => value),
        built: rows.filter(([, , built]) => built).map(([value, pkg]) => ({ ...pkg, name: value })),
      })),
    conda: fc.record({ "archont561/archont561": channel, "archont561/geospatial": channel }),
  });
}

// ---------------------------------------------------------------- fixtures

export type Proc = {
  exec: Mock<typeof runner.exec>;
  capture: Mock<typeof runner.capture>;
  /** Command lines passed to runner.exec, in order. */
  commands: () => string[][];
};

export type Registry = {
  /** Serve `world` (replacing the current one) and return it. */
  serve: (world: World) => World;
  /** Make every request whose URL contains `fragment` answer with `status`. */
  fail: (fragment: string, status: number) => void;
  /** URLs requested so far. */
  urls: () => string[];
};

/** Files the render and capture pipelines read. */
/** Answer `git rev-parse` with the branch and `git log` with the commit subjects. */
export function fakeGit(proc: Proc, branch: string, commits: string[], failing?: string): void {
  proc.capture.mockImplementation(async (command: string[]) => {
    if (command[1] === failing) return { code: 128, stdout: "" };
    return { code: 0, stdout: command[1] === "rev-parse" ? branch : commits.join("\n") };
  });
}

export const REPO_FILES = [
  "data",
  "templates",
  "docs",
  "package.json",
  ".commitlintrc.json",
  "codecov.yml",
  "vendor/clean-code-presets/UPSTREAM.pin",
];

export const test = base.extend({
  logs: {
    setup: async (use) => {
      const logs = recordLog();
      try {
        await use(logs);
      } finally {
        logs.restore();
      }
    },
  },
  proc: {
    setup: async (use) => {
      const exec = spyOn(runner, "exec").mockResolvedValue(0);
      const capture = spyOn(runner, "capture").mockResolvedValue({ code: 0, stdout: "" });
      const resolve = spyOn(toolchain, "resolve").mockImplementation(async ([head, ...rest]) =>
        isPixiTool(head)
          ? [`/pixi/${head}`, ...rest]
          : [head as string, ...rest].filter((part) => part !== undefined),
      );
      try {
        await use({
          exec,
          capture,
          commands: () => exec.mock.calls.map(([command]) => command),
        } satisfies Proc);
      } finally {
        exec.mockRestore();
        capture.mockRestore();
        resolve.mockRestore();
      }
    },
  },
  repo: {
    setup: async (use, { tmpdir }) => {
      for (const path of REPO_FILES) await cp(join(ROOT, path), tmpdir.path(path), { recursive: true });
      await use(tmpdir.dir as string);
    },
  },
  registry: {
    // networkGuard is built first, so httpMock wraps it and answers before the guard looks.
    setup: async (use, { networkGuard, httpMock }) => {
      let world = WORLD;
      const failures: [string, number][] = [];
      httpMock.use("*", /^https:\/\//, (request: Request) => {
        const failure = failures.find(([fragment]) => request.url.includes(fragment));
        return failure ? new Response("upstream failure", { status: failure[1] }) : route(world, request);
      });
      const registry: Registry = {
        serve: (next) => {
          world = next;
          return next;
        },
        fail: (fragment, status) => {
          failures.push([fragment, status]);
        },
        urls: () => httpMock.calls().map((call: { url: string }) => call.url),
      };
      await use(registry);
      if (networkGuard.calls().length) throw new Error("a test reached the network guard");
    },
  },
  exitCode: {
    setup: async (use) => {
      const previous = process.exitCode;
      try {
        await use({ read: () => process.exitCode });
      } finally {
        // Bun ignores `process.exitCode = undefined`, so an unset code is restored as 0.
        process.exitCode = previous ?? 0;
      }
    },
  },
});

export { describe, expect } from "@archont561/bun-test-utils";
