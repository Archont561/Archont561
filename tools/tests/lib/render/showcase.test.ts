import type { Pkg, Registry, RepoFacts } from "@/tools/lib/capture/sources.ts";
import { cardPath, PRINCIPLES } from "@/tools/lib/render/cards.ts";
import { pairs, principlesCard, projectCards, shipsTo, slugOf } from "@/tools/lib/render/showcase.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const pkg = (name: string, version: string | null = "1.0.0", reserved = false): Pkg => ({
  name,
  version,
  published: version && "2026-01-01",
  description: null,
  reserved,
  url: `https://x.test/${name}`,
});
const registry = (label: string, packages: Pkg[]): Registry => ({
  id: label.toLowerCase(),
  label,
  account: "acct",
  url: `https://x.test/${label}`,
  packages,
});

const registries = [
  registry("npm", [pkg("@archont561/geo-tools"), pkg("@archont561/notes", null)]),
  registry("PyPI", [pkg("geo-tools-py"), pkg("geo-toolsmith")]),
  registry("crates.io", [pkg("geo-tools-rs", "0.0.0", true)]),
  registry("Conda", [pkg("geo-tools-cli"), pkg("other")]),
];

const project = (name: string, featured: boolean) => ({
  name,
  url: `https://github.com/x/${name}`,
  description: `${name} does things.`,
  docs: `https://x.test/docs/projects/${slugOf(name)}/`,
  kind: "testing",
  featured,
});
const projects = [project("geo-tools", true), project("Notes", true), project("hidden", false)];
const repos: RepoFacts[] = [
  { name: "geo-tools", language: "Python", topics: [] },
  { name: "notes", language: null, topics: [] },
];
const all = {
  name: "Every project",
  path: "docs",
  description: "All {repos} repositories.",
  kind: "portfolio",
  stack: ["/docs/"],
  cta: "example.org",
};

describe("shipsTo", () => {
  test("matches the project's packages across scopes and language suffixes, and nothing that merely shares a prefix", () => {
    expect(shipsTo("geo-tools", registries)).toEqual(["npm", "PyPI", "Conda"]);
  });

  test("ignores reserved names and versionless entries", () => {
    expect(shipsTo("notes", registries)).toEqual([]);
    expect(shipsTo("geo-tools", [registries[2] as Registry])).toEqual([]);
  });

  test("names each registry once", () => {
    expect(shipsTo("geo-tools", [registry("PyPI", [pkg("geo-tools"), pkg("geo-tools-py")])])).toEqual([
      "PyPI",
    ]);
  });
});

describe("projectCards", () => {
  const cards = projectCards(
    projects,
    repos,
    registries,
    all,
    { docs: "https://x.test/docs/" },
    { repos: 7 },
  );

  test("renders the featured projects in order, then the every-project card", () => {
    expect(cards.map((card) => card.src)).toEqual([
      cardPath("geo-tools"),
      cardPath("notes"),
      cardPath("all-projects"),
    ]);
    expect(cards.map((card) => card.href)).toEqual([
      "https://x.test/docs/projects/geo-tools/",
      "https://x.test/docs/projects/notes/",
      "https://x.test/docs/",
    ]);
  });

  test("takes the stack from the repository's language, matched case-insensitively", () => {
    expect(cards[0]?.svg).toContain("Stack: Python. Ships to npm, PyPI, Conda.");
    expect(cards[1]?.svg).not.toContain("Stack:");
  });

  test("fills snapshot tokens into the every-project card and its alt text", () => {
    expect(cards[2]?.alt).toBe("Every project: All 7 repositories.");
    expect(cards[2]?.svg).toContain("All 7 repositories.");
  });

  test("shares one spotlight tour across all cards", () => {
    for (const [i, card] of cards.entries()) {
      expect(card.svg).toContain(`animation:spot 9s ease-in-out ${3 * i}s infinite`);
    }
  });
});

test("principlesCard renders the terminal at the given width", () => {
  const [path, svg] = principlesCard(
    { command: "./principles --show", alt: "alt", lines: [{ key: "lock", rule: "r", detail: "d" }] },
    "Ship it.",
    640,
  );
  expect(path).toBe(PRINCIPLES);
  expect(svg).toContain('width="640"');
  expect(svg).toContain("Ship it.");
});

test.prop(
  "pairs keeps every item in order, in rows of two",
  (fc) => ({ items: fc.array(fc.integer(), { maxLength: 11 }) }),
  (_fixtures, { items }) => {
    const rows = pairs(items);
    expect(rows.flat()).toEqual(items);
    expect(rows.length).toBe(Math.ceil(items.length / 2));
    for (const row of rows.slice(0, -1)) expect(row.length).toBe(2);
  },
);
