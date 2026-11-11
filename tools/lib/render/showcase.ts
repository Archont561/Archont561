/**
 * The README's showcase: a card per featured project (curated in data/profile.json),
 * an "every project" card that hands off to the portfolio, and the principles terminal.
 *
 * Curated wording comes from data/profile.json; the stack chip is the repository's
 * primary language and the registry chips are where it actually ships, both from
 * data/snapshot.json, so a card cannot claim a release that does not exist.
 */
import type { Registry, RepoFacts } from "@/tools/lib/capture/sources.ts";
import { fill } from "@/tools/lib/render/badges.ts";
import {
  cardPath,
  PRINCIPLES,
  projectCard,
  type TerminalLine,
  terminalCard,
} from "@/tools/lib/render/cards.ts";
import type { Tokens } from "@/tools/lib/render/health.ts";

export type Project = {
  name: string;
  url: string;
  description: string;
  docs: string;
  kind: string;
  featured?: boolean;
};

export type AllProjectsCard = {
  name: string;
  path: string;
  description: string;
  kind: string;
  stack: string[];
  cta: string;
};

export type Principles = { command: string; alt: string; lines: TerminalLine[] };

/** A rendered card and how the README links it. */
export type CardView = {
  name: string;
  slug: string;
  repoUrl: string;
  src: string;
  href: string;
  alt: string;
  svg: string;
};

export const slugOf = (name: string): string => name.toLowerCase();

/** A package belongs to a project when its name, minus scope and -py/-rs/-conda suffixes, starts with the project's. */
const stem = (name: string): string =>
  name
    .toLowerCase()
    .replace(/^@[^/]+\//, "")
    .replace(/-(py|rs|conda)$/, "");

/** Registries where `project` has a real release: reserved names and unbuilt channel entries do not count. */
export function shipsTo(project: string, registries: Registry[]): string[] {
  const key = stem(project);
  const labels = registries
    .filter((registry) =>
      registry.packages.some((pkg) => {
        const name = stem(pkg.name);
        return !pkg.reserved && pkg.version !== null && (name === key || name.startsWith(`${key}-`));
      }),
    )
    .map((registry) => registry.label);
  return [...new Set(labels)];
}

export function projectCards(
  projects: Project[],
  repos: RepoFacts[],
  registries: Registry[],
  all: AllProjectsCard,
  links: { docs: string; repo?: string },
  tokens: Tokens,
): CardView[] {
  const featured = projects.filter((project) => project.featured);
  const count = featured.length + 1;
  const cards = featured.map((project, index): CardView => {
    const repo = repos.find((candidate) => candidate.name.toLowerCase() === project.name.toLowerCase());
    const slug = slugOf(project.name);
    const svg = projectCard({
      name: project.name,
      path: slug,
      description: project.description,
      kind: project.kind,
      stack: repo?.language ? [repo.language] : [],
      ships: shipsTo(project.name, registries),
      cta: "docs",
      index,
      count,
    });
    return {
      name: project.name,
      slug,
      repoUrl: project.url,
      src: cardPath(slug),
      href: project.docs,
      alt: `${project.name}: ${project.description}`,
      svg,
    };
  });
  const description = fill(all.description, tokens);
  cards.push({
    name: all.name,
    slug: "all-projects",
    repoUrl: links.repo ?? links.docs,
    src: cardPath("all-projects"),
    href: links.docs,
    alt: `${all.name}: ${description}`,
    svg: projectCard({ ...all, description, ships: [], index: featured.length, count }),
  });
  return cards;
}

export function principlesCard(principles: Principles, footer: string, width: number): [string, string] {
  return [PRINCIPLES, terminalCard({ command: principles.command, lines: principles.lines, footer, width })];
}

/** Rows of two, so the README can lay the grid out with plain `<p>` blocks. */
export const pairs = <T>(items: T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(2 * i, 2 * i + 2));
