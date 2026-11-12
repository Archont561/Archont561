import { createClients } from "@/tools/lib/capture/clients.ts";
import { createFetch, HttpError } from "@/tools/lib/capture/http.ts";
import {
  byName,
  condaChannel,
  cratesUser,
  day,
  github,
  isReserved,
  mavenNamespace,
  npmOrg,
  nugetOwner,
  parseUserPackages,
  pomDescription,
  portfolioTokens,
  pypiUser,
  rUniverse,
  summarize,
  userPackagesCall,
} from "@/tools/lib/capture/sources.ts";
import { describe, expect, test, WORLD, type World, worldArb } from "@/tools/tests/fixtures.ts";

const clients = () => createClients({ fetch: createFetch({ retries: 1 }) });

describe("pure helpers", () => {
  test.prop(
    "summarize counts repositories and ranks at most four languages",
    (fc) => ({ world: worldArb(fc) }),
    (_fixtures, { world }) => {
      const summary = summarize(world.repos);
      expect(summary.owned).toBe(world.repos.length);
      expect(summary.archived).toBe(world.repos.filter((repo) => repo.archived).length);
      expect(summary.titled).toBe(world.repos.filter((repo) => repo.topics.length > 0).length);
      expect(summary.languages.length).toBeLessThanOrEqual(4);
      const counts = summary.languages.map((language) => language.count);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      const authored = world.repos.filter((repo) => !repo.fork);
      expect(summary.repos.map((repo) => repo.name)).toEqual(
        authored.map((repo) => repo.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
      );
      for (const repo of summary.repos) {
        const source = authored.find((candidate) => candidate.name === repo.name);
        expect(repo).toEqual({
          name: repo.name,
          language: source?.language ?? null,
          topics: source?.topics ?? [],
        });
      }
    },
  );

  test.prop(
    "parseUserPackages recovers the names an XML-RPC call lists, without roles or duplicates",
    (fc) => ({ names: fc.array(fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/), { maxLength: 6 }) }),
    (_fixtures, { names }) => {
      const xml = names
        .map((name) => `<string>Owner</string><string>${name}</string><string>Maintainer</string>`)
        .join("");
      expect(parseUserPackages(xml)).toEqual([...new Set(names)]);
    },
  );

  test("isReserved, day, byName and userPackagesCall", () => {
    expect(isReserved("0.0.0", "real")).toBe(true);
    expect(isReserved("1.0.0", "Reserved package name")).toBe(true);
    expect(isReserved("1.0.0", null)).toBe(false);
    expect(day("2026-05-06T07:08:09Z")).toBe("2026-05-06");
    expect(day(null)).toBeNull();
    expect(
      ["b", "A", "c"]
        .map((name) => ({ name }))
        .sort(byName)
        .map((item) => item.name),
    ).toEqual(["A", "b", "c"]);
    expect(userPackagesCall("Archont561")).toContain("<methodName>user_packages</methodName>");
  });
});

describe("sources over the generated clients", () => {
  test("read the fixture world from every registry", async ({ registry }) => {
    registry.serve(WORLD);
    const { accounts } = WORLD;
    expect((await github(clients(), accounts.github)).owned).toBe(3);
    expect((await npmOrg(clients(), accounts.npmScope)).packages[0]).toMatchObject({
      name: "@archont561/kit",
      version: "1.2.0",
      published: "2026-05-06",
      url: "https://www.npmjs.com/package/@archont561/kit",
    });
    expect((await pypiUser(clients(), accounts.pypi)).packages[0]).toMatchObject({
      name: "geo-tools",
      published: "2026-04-01",
    });
    expect((await cratesUser(clients(), accounts.crates)).packages[0]).toMatchObject({
      name: "clifacet",
      version: "0.2.0",
    });
    const channel = await condaChannel(clients(), "archont561/archont561");
    expect(channel).toMatchObject({
      id: "conda-archont561",
      install: "https://prefix.dev/archont561/archont561",
    });
    expect(channel.packages[0]?.url).toBe(
      "https://prefix.dev/channels/@archont561/archont561/packages/qgis-sdk",
    );
    expect(registry.urls()).toContain("https://registry.npmjs.org/%40archont561%2Fkit");
  });

  test("an upstream error surfaces as HttpError naming the endpoint", async ({ registry }) => {
    registry.fail("crates.io/api/v1/users", 404);
    const error = await cratesUser(clients(), "Archont561").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).url).toBe("https://crates.io/api/v1/users/Archont561");
  });

  test("an unknown conda channel is an error", async ({ registry }) => {
    registry.serve(WORLD);
    await expect(condaChannel(clients(), "nobody/nothing")).rejects.toThrow(
      "prefix.dev did not resolve channel nobody/nothing",
    );
  });
});

describe("pomDescription", () => {
  test.prop(
    "reads the project description, not the parent's, and unescapes XML entities",
    (fc) => ({ text: fc.stringMatching(/^[A-Za-z][A-Za-z&<>"' ]{0,30}[A-Za-z]$/) }),
    (_fixtures, { text }) => {
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
      const pom = `<project><parent><description>Parent</description></parent>\n  <description>\n    ${escaped}\n  </description></project>`;
      expect(pomDescription(pom)).toBe(text.replace(/\s+/g, " "));
    },
  );

  test("is null when the POM has no description or an empty one", () => {
    expect(pomDescription("<project><artifactId>x</artifactId></project>")).toBeNull();
    expect(pomDescription("<project><description>  </description></project>")).toBeNull();
  });
});

describe("NuGet, Maven Central and R-universe", () => {
  test("keep only owned packages and read dates, descriptions and reservations", async ({ registry }) => {
    registry.serve(WORLD);
    const nuget = await nugetOwner(clients(), "Archont561");
    expect(nuget).toMatchObject({
      id: "nuget",
      label: "NuGet",
      url: "https://www.nuget.org/profiles/Archont561",
    });
    expect(nuget.packages).toEqual([
      {
        name: "Playtest",
        version: "0.0.0",
        published: "2026-10-23",
        description: "Reserved placeholder",
        reserved: true,
        url: "https://www.nuget.org/packages/Playtest",
      },
    ]);
    const maven = await mavenNamespace(clients(), "io.github.archont561");
    expect(maven.packages).toEqual([
      {
        name: "playtest",
        version: "1.0.0",
        published: "2026-10-24",
        description: "Polyglot tests & more",
        reserved: false,
        url: "https://central.sonatype.com/artifact/io.github.archont561/playtest",
      },
    ]);
    expect(registry.urls()).toContain(
      "https://repo1.maven.org/maven2/io%2Fgithub%2Farchont561/playtest/1.0.0/playtest-1.0.0.pom",
    );
    expect(registry.urls()).toContain(
      "https://api.nuget.org/v3/registration5-gz-semver2/playtest/0.0.0.json",
    );
    const universe = await rUniverse(clients(), "Archont561", "archont561");
    expect(universe).toMatchObject({
      id: "r-universe",
      url: "https://archont561.r-universe.dev",
      install: "https://archont561.r-universe.dev",
    });
    expect(universe.packages).toEqual([
      {
        name: "geor",
        version: "0.2.0",
        published: "2026-09-01",
        description: "Geo R",
        reserved: false,
        url: "https://archont561.r-universe.dev/geor",
      },
      {
        name: "playtest",
        version: null,
        published: null,
        description: null,
        reserved: true,
        url: "https://github.com/Archont561/playtest",
      },
    ]);
  });

  test("a universe with no build yet (404) lists its registered names and links the registry", async ({
    registry,
  }) => {
    const world: World = { ...WORLD, universe: { registered: ["playtest"], built: [] } };
    registry.serve(world);
    const universe = await rUniverse(clients(), "Archont561", "archont561");
    expect(universe.url).toBe("https://github.com/Archont561/archont561.r-universe.dev");
    expect(universe.packages.map((pkg) => [pkg.name, pkg.reserved])).toEqual([["playtest", true]]);
  });

  test("any other universe failure is an error", async ({ registry }) => {
    registry.serve(WORLD);
    registry.fail("archont561.r-universe.dev/api/packages", 403);
    const error = await rUniverse(clients(), "Archont561", "archont561").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
  });

  test("a registry path that is not a file is an error", async ({ registry, httpMock }) => {
    registry.serve(WORLD);
    httpMock.get(/contents\/packages\.json$/, () => Response.json([]));
    await expect(rUniverse(clients(), "Archont561", "archont561")).rejects.toThrow(
      "Archont561/archont561.r-universe.dev: packages.json is not a file",
    );
  });
});

describe("portfolioTokens", () => {
  test("returns fetched tokens when fetch succeeds", async () => {
    const fetcher = (async () =>
      new Response(":root { --palette-day-background: #ffffff; }")) as unknown as typeof fetch;
    const tokens = await portfolioTokens(fetcher, "fallback");
    expect(tokens).toBe(":root { --palette-day-background: #ffffff; }");
  });

  test("falls back to fallback on HTTP error", async () => {
    const fetcher = (async () => new Response("Not found", { status: 404 })) as unknown as typeof fetch;
    const tokens = await portfolioTokens(fetcher, "fallback");
    expect(tokens).toBe("fallback");
  });

  test("falls back to fallback on fetch exception", async () => {
    const fetcher = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const tokens = await portfolioTokens(fetcher, "fallback");
    expect(tokens).toBe("fallback");
  });

  test("returns empty string when fetch fails and no fallback provided", async () => {
    const fetcher = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const tokens = await portfolioTokens(fetcher);
    expect(tokens).toBe("");
  });
});
