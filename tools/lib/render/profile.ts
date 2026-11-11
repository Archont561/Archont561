/**
 * Build every rendered file of the profile from its inputs: README.md, the docs index,
 * the pull request template, assets/banner.svg, assets/portal.svg, assets/cards/*.svg
 * and assets/badges/*.svg.
 *
 * Curated wording comes from data/profile.json, measured facts from data/snapshot.json,
 * and repository-health facts (Bun pin, coverage target, preset pin) from the files
 * that enforce them, so a badge cannot drift from its own configuration.
 */
import ejs from "ejs";
import type { Snapshot } from "@/tools/lib/capture/snapshot.ts";
import type { Pkg, Registry } from "@/tools/lib/capture/sources.ts";
import { type Badge, type BadgeSpec, fill, renderBadge } from "@/tools/lib/render/badges.ts";
import { renderBanner } from "@/tools/lib/render/banner.ts";
import { DOCS_INDEX, renderDocsIndex } from "@/tools/lib/render/docs.ts";
import { healthTokens, type Tokens } from "@/tools/lib/render/health.ts";
import { PORTAL, portalRoutes, renderPortal, svgWidth } from "@/tools/lib/render/portal.ts";
import { PR_TEMPLATE, renderPrTemplate } from "@/tools/lib/render/pr.ts";
import { pairs, principlesCard, projectCards } from "@/tools/lib/render/showcase.ts";

export type RegistryView = Registry & { released: number; reserved: number };
export type Release = Pkg & { registry: string };
export type { Tokens };

type Look = { logo: string; color: string };

// biome-ignore lint/suspicious/noExplicitAny: data/profile.json is curated JSON validated by rendering.
export type Profile = Record<string, any>;

export function summarizeRegistries(registries: Registry[]): RegistryView[] {
  return registries.map((registry) => {
    const released = registry.packages.filter((pkg) => !pkg.reserved).length;
    return { ...registry, released, reserved: registry.packages.length - released };
  });
}

/** Distinct registries (Conda channels count once) with at least one real release. */
export const shippingRegistries = (registries: RegistryView[]): number =>
  new Set(registries.filter((registry) => registry.released > 0).map((registry) => registry.label)).size;

export function latestRelease(registries: Registry[]): Release | undefined {
  return registries
    .flatMap((registry) =>
      registry.packages
        .filter((pkg) => !pkg.reserved && pkg.published)
        .map((pkg) => ({ ...pkg, registry: registry.label })),
    )
    .sort(
      (a, b) => (b.published as string).localeCompare(a.published as string) || a.name.localeCompare(b.name),
    )[0];
}

export const isChannel = (registry: Registry): boolean => registry.id.startsWith("conda-");

/** The count a registry badge shows: releases for registries, packages for channels. */
export function badgeCount(registry: RegistryView): string {
  if (!isChannel(registry)) {
    // A registry that only holds reserved names says so rather than "0 published".
    if (registry.released === 0 && registry.reserved > 0) return `${registry.reserved} reserved`;
    return `${registry.released} published`;
  }
  if (registry.packages.length === 0) return "open channel";
  return `${registry.packages.length} packages`;
}

export function registryBadges(registries: RegistryView[], looks: Record<string, Look>): Badge[] {
  return registries.map((registry) => {
    const kind = isChannel(registry) ? "conda" : registry.id;
    const look = looks[kind];
    if (!look) throw new Error(`no badge look for registry ${registry.id}`);
    const count = badgeCount(registry);
    const prefix = isChannel(registry) ? "conda" : registry.label;
    return renderBadge({
      id: `registry-${registry.id}`,
      label: `${prefix} · ${registry.account}`,
      message: count,
      color: look.color,
      logo: look.logo,
      url: registry.url,
      alt: `${registry.label} ${registry.account}: ${count}`,
      style: "flat-square",
    });
  });
}

export const curatedBadges = (specs: BadgeSpec[], tokens: Tokens): Badge[] =>
  specs.map((spec) =>
    renderBadge({ ...spec, message: fill(spec.message, tokens), alt: fill(spec.alt, tokens) }),
  );

export const markdownBadge = (badge: { alt: string; src: string; url: string }): string =>
  `[![${badge.alt}](${badge.src})](${badge.url})`;

export async function buildOutputs(root: string): Promise<Map<string, string>> {
  const read = (path: string) => Bun.file(`${root}/${path}`).json();
  const [profile, snapshot]: [Profile, Snapshot] = await Promise.all([
    read("data/profile.json"),
    read("data/snapshot.json"),
  ]);

  const registries = summarizeRegistries(snapshot.registries);
  const tokens: Tokens = {
    ...(await healthTokens(root)),
    repos: snapshot.github.owned as number,
    packages: registries.reduce((sum, registry) => sum + registry.released, 0),
    registries: shippingRegistries(registries),
  };

  const badges = {
    nav: curatedBadges(profile.badges.nav, tokens),
    connect: curatedBadges(profile.badges.connect, tokens),
    health: curatedBadges(profile.health.badges, tokens),
    registries: registryBadges(registries, profile.badges.registries),
  };

  const banner = renderBanner({ ...profile.banner, tagline: profile.tagline });
  const width = svgWidth(banner);
  const cards = projectCards(
    profile.projects,
    snapshot.github.repos,
    snapshot.registries,
    profile.portfolio.cards.all,
    { docs: `${profile.portfolio.url}docs/` },
    tokens,
  );
  const principles = principlesCard(profile.principles, profile.profile.principle, width);

  const readme = await ejs.renderFile(
    `${root}/templates/profile.ejs`,
    {
      ...profile,
      captured: snapshot.captured,
      hygiene: snapshot.github,
      registries,
      latest: latestRelease(registries),
      badges,
      live: profile.health.live,
      tokens,
      md: markdownBadge,
      cards,
      rows: pairs(cards),
      principlesSrc: principles[0],
    },
    { async: false },
  );

  const all = [...badges.nav, ...badges.connect, ...badges.health, ...badges.registries];
  return new Map<string, string>([
    ["README.md", readme],
    [DOCS_INDEX, await renderDocsIndex(root)],
    [PR_TEMPLATE, await renderPrTemplate(root)],
    ["assets/banner.svg", banner],
    [
      PORTAL,
      renderPortal({
        ...profile.portfolio.portal,
        url: profile.portfolio.url,
        label: profile.portfolio.label,
        routes: portalRoutes(profile.portfolio.portal.routes, tokens),
        width,
      }),
    ],
    principles,
    ...cards.map((card): [string, string] => [card.src, card.svg]),
    ...all.map((badge): [string, string] => [badge.src, badge.svg]),
  ]);
}
