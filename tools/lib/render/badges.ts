/**
 * Badges rendered offline with badge-maker (the shields.io engine) and simple-icons.
 *
 * Every badge is a committed SVG, so the README never calls a badge service and a
 * count on a badge is the same captured fact as the count in the text blocks.
 */
import { makeBadge } from "badge-maker";
import * as icons from "simple-icons";
import { brandExtras, palette } from "@/tools/lib/render/palette.ts";

export type BadgeSpec = {
  /** File stem under assets/badges/. */
  id: string;
  label: string;
  message: string;
  color: string;
  logo?: string;
  url: string;
  alt: string;
  style?: "flat" | "flat-square" | "for-the-badge" | "plastic" | "social";
};

export type Badge = BadgeSpec & { src: string; svg: string };

/** Terrain palette shared with archont561.github.io. */
export const TERRAIN = Object.freeze({
  label: palette.surface,
  forest: palette.day.primary,
  moss: brandExtras.moss,
  sage: palette.sage,
  copper: brandExtras.copper,
});

function logo(slug?: string): string | undefined {
  if (!slug) return undefined;
  const key = `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
  const icon = (icons as Record<string, { path: string } | undefined>)[key];
  if (!icon) throw new Error(`simple-icons has no ${key} (badge logo "${slug}")`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${palette.white}" d="${icon.path}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function renderBadge(spec: BadgeSpec): Badge {
  const logoBase64 = logo(spec.logo);
  const svg = makeBadge({
    label: spec.label,
    message: spec.message,
    color: spec.color,
    labelColor: TERRAIN.label,
    style: spec.style ?? "for-the-badge",
    ...(logoBase64 ? { logoBase64 } : {}),
  });
  return { ...spec, src: `assets/badges/${spec.id}.svg`, svg: `${svg}\n` };
}

/** Replace {token} placeholders with captured numbers. */
export function fill(text: string, tokens: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in tokens)) throw new Error(`unknown badge token ${match}`);
    return String(tokens[key]);
  });
}
