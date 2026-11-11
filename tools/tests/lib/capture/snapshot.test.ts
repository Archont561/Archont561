import { createClients } from "@/tools/lib/capture/clients.ts";
import { createFetch } from "@/tools/lib/capture/http.ts";
import { capture, type Snapshot, sameContent, saveIfChanged, today } from "@/tools/lib/capture/snapshot.ts";
import { expect, test, WORLD } from "@/tools/tests/fixtures.ts";

test("capture gathers GitHub and every registry, dated today unless told otherwise", async ({ registry }) => {
  registry.serve(WORLD);
  const clients = createClients({ fetch: createFetch({ retries: 1 }) });
  const dated = await capture(clients, WORLD.accounts, { date: "2026-01-02" });
  expect(dated.captured).toBe("2026-01-02");
  expect(dated.registries.map((item) => item.id)).toEqual([
    "npm",
    "pypi",
    "crates",
    "nuget",
    "maven",
    "r-universe",
    "conda-archont561",
    "conda-geospatial",
  ]);
  expect((await capture(clients, WORLD.accounts)).captured).toBe(today());
});

test.prop(
  "sameContent ignores the capture date and nothing else",
  (fc) => ({
    a: fc.stringMatching(/^2026-0[1-9]-[0-2][1-9]$/),
    b: fc.stringMatching(/^2026-0[1-9]-[0-2][1-9]$/),
    owned: fc.nat(30),
    otherOwned: fc.nat(30),
  }),
  (_fixtures, { a, b, owned, otherOwned }) => {
    const snap = (captured: string, count: number) =>
      ({
        captured,
        github: { owned: count, forks: 0, archived: 0, titled: 0, languages: [], repos: [] },
        registries: [],
      }) as Snapshot;
    expect(sameContent(snap(a, owned), snap(b, owned))).toBe(true);
    expect(sameContent(snap(a, owned), snap(a, otherOwned))).toBe(owned === otherOwned);
  },
);

test("saveIfChanged writes drift once and skips date-only changes", async ({ tmpdir }) => {
  const path = tmpdir.path("snapshot.json");
  const fresh = {
    captured: "2026-01-01",
    github: { owned: 1, forks: 0, archived: 0, titled: 0, languages: [], repos: [] },
    registries: [],
  };
  expect(await saveIfChanged(path, fresh)).toBe(true);
  expect(await saveIfChanged(path, { ...fresh, captured: "2026-02-02" })).toBe(false);
  expect(await Bun.file(path).json()).toEqual(fresh);
});
