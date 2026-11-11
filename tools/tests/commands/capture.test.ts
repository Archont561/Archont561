import { runCommand } from "citty";
import capture from "@/tools/commands/capture.ts";
import type { Snapshot } from "@/tools/lib/capture/snapshot.ts";
import { byName, isReserved } from "@/tools/lib/capture/sources.ts";
import { type Registry, test, worldArb } from "@/tools/tests/fixtures.ts";

const names = (items: { name: string }[]) => [...items].sort(byName).map((item) => item.name);

test.scenario
  .prop("capture records any registry world in data/snapshot.json", (fc) => ({ world: worldArb(fc) }))
  .given("registries serve the world", ({ repo, registry, logs, world }) => {
    (registry as Registry).serve(world);
    return { root: repo as string, quiet: logs };
  })
  .when("bun run tools capture runs", async ({ root }) => {
    await runCommand(capture, { rawArgs: ["--root", root] });
    return { written: (await Bun.file(`${root}/data/snapshot.json`).json()) as Snapshot };
  })
  .then("every source is captured, sorted, with reservations detected", ({ written, world, expect }) => {
    expect(written.github.owned).toBe(world.repos.length);
    expect(written.github.forks).toBe(world.repos.filter((repo) => repo.fork).length);
    const [npm, pypi, crates, nuget, maven, universe, ...conda] = written.registries;
    for (const [registry, releases] of [
      [npm, world.npm],
      [pypi, world.pypi],
      [crates, world.crates],
      [nuget, world.nuget],
      [maven, world.maven],
    ] as const) {
      expect(registry?.packages.map((pkg) => pkg.name)).toEqual(names(releases));
      for (const pkg of registry?.packages ?? []) {
        const release = releases.find((candidate) => candidate.name === pkg.name);
        expect(pkg.version).toBe(release?.version ?? null);
        expect(pkg.published).toBe(release?.published ?? null);
        expect(pkg.reserved).toBe(isReserved(pkg.version, pkg.description));
      }
    }
    // Every registered R package is listed; only a built one has a version, and an unbuilt one is reserved.
    expect(universe?.packages.map((pkg) => pkg.name)).toEqual(
      names(world.universe.registered.map((name) => ({ name }))),
    );
    for (const pkg of universe?.packages ?? []) {
      const build = world.universe.built.find((candidate) => candidate.name === pkg.name);
      expect(pkg.version).toBe(build?.version ?? null);
      expect(pkg.published).toBe(build?.published ?? null);
      expect(pkg.reserved).toBe(!build || isReserved(pkg.version, pkg.description));
    }
    expect(universe?.url).toBe(
      world.universe.built.length
        ? "https://archont561.r-universe.dev"
        : "https://github.com/Archont561/archont561.r-universe.dev",
    );
    expect(conda.map((channel) => channel.account)).toEqual(world.accounts.condaChannels);
    for (const channel of conda) {
      expect(channel.packages.map((pkg) => pkg.name)).toEqual(names(world.conda[channel.account] ?? []));
      expect(channel.packages.every((pkg) => !pkg.reserved)).toBe(true);
    }
  });

test.scenario
  .prop("capture --print logs the capture and leaves the snapshot alone", (fc) => ({ world: worldArb(fc) }))
  .given("registries serve the world", async ({ repo, registry, logs, world }) => {
    registry.serve(world);
    return {
      root: repo,
      out: logs.out as string[],
      before: await Bun.file(`${repo}/data/snapshot.json`).text(),
    };
  })
  .when("bun run tools capture --print runs", async ({ root }) => {
    await runCommand(capture, { rawArgs: ["--root", root, "--print"] });
    return { after: await Bun.file(`${root}/data/snapshot.json`).text() };
  })
  .then("stdout holds the capture and the file is untouched", ({ out, before, after, world, expect }) => {
    expect(after).toBe(before);
    expect(JSON.parse(out.join("")).github.owned).toBe(world.repos.length);
  });
