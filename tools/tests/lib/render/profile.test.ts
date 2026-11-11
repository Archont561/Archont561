import type { Pkg, Registry } from "@/tools/lib/capture/sources.ts";
import { ROOT } from "@/tools/lib/paths.ts";
import { cardPath, PRINCIPLES } from "@/tools/lib/render/cards.ts";
import { CARD_DIR } from "@/tools/lib/render/outputs.ts";
import {
  badgeCount,
  buildOutputs,
  curatedBadges,
  isChannel,
  latestRelease,
  markdownBadge,
  registryBadges,
  shippingRegistries,
  summarizeRegistries,
} from "@/tools/lib/render/profile.ts";
import { describe, expect, type FastCheck, test } from "@/tools/tests/fixtures.ts";

const pkg = (name: string, published: string | null, reserved = false): Pkg => ({
  name,
  version: "1.0.0",
  published,
  description: null,
  reserved,
  url: `https://x.test/${name}`,
});

const registry = (id: string, packages: Pkg[]): Registry => ({
  id,
  label: id === "npm" ? "npm" : "Conda",
  account: "acct",
  url: `https://x.test/${id}`,
  packages,
});

const looks = { npm: { logo: "npm", color: "#B9794D" }, conda: { logo: "anaconda", color: "#648b63" } };

const pkgArb = (fc: FastCheck) =>
  fc
    .record({
      name: fc.stringMatching(/^[a-z]{1,6}$/),
      published: fc.option(fc.constantFrom("2025-01-01", "2026-03-01", "2026-09-09"), { nil: null }),
      reserved: fc.boolean(),
    })
    .map(({ name, published, reserved }) => pkg(name, published, reserved));

describe("registry views", () => {
  test.prop(
    "summarizeRegistries splits every package into released or reserved",
    (fc) => ({ packages: fc.array(pkgArb(fc), { maxLength: 8 }) }),
    (_fixtures, { packages }) => {
      const [view] = summarizeRegistries([registry("npm", packages)]);
      expect((view?.released ?? 0) + (view?.reserved ?? 0)).toBe(packages.length);
      expect(view?.reserved).toBe(packages.filter((item) => item.reserved).length);
    },
  );

  test.prop(
    "latestRelease is the newest published, unreserved package",
    (fc) => ({
      npm: fc.array(pkgArb(fc), { maxLength: 5 }),
      conda: fc.array(pkgArb(fc), { maxLength: 5 }),
    }),
    (_fixtures, { npm, conda }) => {
      const latest = latestRelease([registry("npm", npm), registry("conda-x", conda)]);
      const candidates = [...npm, ...conda].filter((item) => item.published && !item.reserved);
      if (candidates.length === 0) {
        expect(latest).toBeUndefined();
        return;
      }
      const newest = candidates
        .map((item) => item.published as string)
        .sort()
        .at(-1);
      expect(latest?.published).toBe(newest);
      expect(latest?.reserved).toBe(false);
    },
  );

  test("latestRelease breaks ties by name", () => {
    const registries = [
      registry("npm", [pkg("zeta", "2026-03-01")]),
      registry("conda-x", [pkg("alpha", "2026-03-01")]),
    ];
    expect(latestRelease(registries)).toMatchObject({ name: "alpha", registry: "Conda" });
  });

  test("shippingRegistries counts registries with a real release, Conda channels once", () => {
    const views = summarizeRegistries([
      registry("npm", [pkg("a", "2026-01-01")]),
      registry("nuget", [pkg("b", null, true)]),
      registry("conda-x", [pkg("c", null)]),
      registry("conda-y", [pkg("d", null)]),
    ]).map((view) => (view.id.startsWith("conda-") ? { ...view, label: "Conda" } : view));
    expect(shippingRegistries(views)).toBe(2);
  });

  test("badgeCount reports releases for registries and packages for channels", () => {
    const [npm, channel, empty] = summarizeRegistries([
      registry("npm", [pkg("a", "2026-01-01")]),
      registry("conda-x", [pkg("a", null), pkg("b", null)]),
      registry("conda-y", []),
    ]);
    expect(isChannel(npm as Registry)).toBe(false);
    expect(badgeCount(npm as never)).toBe("1 published");
    expect(badgeCount(channel as never)).toBe("2 packages");
    expect(badgeCount(empty as never)).toBe("open channel");
  });

  test.prop(
    'a registry holding only reserved names says how many, never "0 published"',
    (fc) => ({ released: fc.nat(4), reserved: fc.nat(4) }),
    (_fixtures, { released, reserved }) => {
      const packages = [
        ...Array.from({ length: released }, (_, index) => pkg(`r${index}`, "2026-01-01")),
        ...Array.from({ length: reserved }, (_, index) => pkg(`s${index}`, null, true)),
      ];
      const [view] = summarizeRegistries([registry("nuget", packages)]);
      const expected = released === 0 && reserved > 0 ? `${reserved} reserved` : `${released} published`;
      expect(badgeCount(view as never)).toBe(expected);
    },
  );

  test("registryBadges uses the conda look for channels and fails without a look", () => {
    const views = summarizeRegistries([registry("npm", []), registry("conda-x", [])]);
    const badges = registryBadges(views, looks);
    expect(badges.map((badge) => badge.src)).toEqual([
      "assets/badges/registry-npm.svg",
      "assets/badges/registry-conda-x.svg",
    ]);
    expect(badges[1]).toMatchObject({
      label: "conda · acct",
      message: "open channel",
      alt: "Conda acct: open channel",
    });
    expect(() => registryBadges(summarizeRegistries([registry("pypi", [])]), looks)).toThrow(
      "no badge look for registry pypi",
    );
  });
});

describe("curated badges", () => {
  test("fill message and alt tokens", () => {
    const [badge] = curatedBadges(
      [
        {
          id: "c",
          label: "repos",
          message: "{repos}",
          color: "#000",
          url: "https://x.test",
          alt: "{repos} repos",
        },
      ],
      { repos: 23 },
    );
    expect(badge).toMatchObject({ message: "23", alt: "23 repos" });
  });

  test("markdownBadge links the image", () => {
    expect(markdownBadge({ alt: "A", src: "assets/a.svg", url: "https://x.test" })).toBe(
      "[![A](assets/a.svg)](https://x.test)",
    );
  });
});

describe("buildOutputs", async () => {
  const outputs = await buildOutputs(ROOT);

  test("renders the README, the banner, every card, and every badge", () => {
    expect(outputs.has("README.md")).toBe(true);
    expect(outputs.has("assets/banner.svg")).toBe(true);
    expect(outputs.has(PRINCIPLES)).toBe(true);
    expect(outputs.has(cardPath("all-projects"))).toBe(true);
    expect([...outputs.keys()].filter((path) => path.startsWith("assets/badges/")).length).toBeGreaterThan(
      15,
    );
  });

  test("opens on the portal, gathers the detail in one FAQ accordion, and signs off with the banner", () => {
    const readme = outputs.get("README.md") as string;
    expect(readme.indexOf("assets/portal.svg")).toBeLessThan(readme.indexOf("## "));
    expect(readme.indexOf(PRINCIPLES)).toBeLessThan(readme.indexOf("assets/cards/qgis-sdk.svg"));
    const summaries = [...readme.matchAll(/<details name="faq">\n<summary>/g)].length;
    expect(summaries).toBe([...readme.matchAll(/<details/g)].length);
    expect(summaries).toBeGreaterThan(5);
    expect(readme.trimEnd().endsWith("(assets/banner.svg)](https://archont561.github.io/)\n\n</div>")).toBe(
      true,
    );
  });

  test("links every card it renders, and the health answer keeps the live badges", () => {
    const readme = outputs.get("README.md") as string;
    for (const path of outputs.keys()) if (path.startsWith(`${CARD_DIR}/`)) expect(readme).toContain(path);
    expect(readme).toContain("How healthy is this profile repo?");
    expect(readme).toContain("actions/workflows/ci.yml/badge.svg");
    expect(readme).toContain("codecov.io/gh/Archont561/Archont561");
    expect(readme).toContain("assets/badges/health-coverage.svg");
  });

  test("matches the committed README", async () => {
    expect(outputs.get("README.md")).toBe(await Bun.file(`${ROOT}/README.md`).text());
  });
});
