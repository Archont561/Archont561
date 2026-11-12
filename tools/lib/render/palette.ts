/**
 * The SVG render layer's color palette, parsed from the portfolio's tokens.css
 * cached in data/snapshot.json, plus intentional brand extras.
 */
import snapshot from "@/data/snapshot.json" with { type: "json" };

export type ThemeTokens = {
  background: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  surface: string;
  surfaceBorder: string;
  codeBackground: string;
  codeBorder: string;
  codeInline: string;
  [key: string]: string;
};

export type SemanticTokens = {
  readonly paper: string;
  readonly surface: string;
  readonly line: string;
  readonly ink: string;
  readonly muted: string;
  readonly green: string;
  readonly sage: string;
  readonly white: string;
};

export type Palette = SemanticTokens & {
  readonly day: ThemeTokens;
  readonly night: ThemeTokens;
};

export type BrandExtras = {
  readonly forest: string;
  readonly copper: string;
  readonly moss: string;
  readonly sageVariant: string;
  readonly white: string;
};

/** Intentional additions not present in tokens.css or hand-tuned variants preserved from earlier iterations. */
export const brandExtras: BrandExtras = Object.freeze({
  forest: "#3d6b4f",
  copper: "#B9794D",
  moss: "#648b63",
  sageVariant: "#8FA17D",
  white: "#ffffff",
});

const FALLBACK_TOKENS = `
  --palette-day-background: #f8f9f6;
  --palette-day-text: #202d27;
  --palette-day-muted: #596b5e;
  --palette-day-border: #dde3db;
  --palette-day-primary: #355b42;
  --palette-day-on-primary: #ffffff;
  --palette-day-secondary: #526f4f;
  --palette-day-surface: #ecf0e7;
  --palette-day-surface-border: #dce3d6;
  --palette-day-code-background: #edf0e7;
  --palette-day-code-border: #d9e0d3;
  --palette-day-code-inline: #e9eee5;
  --palette-night-background: #131d18;
  --palette-night-text: #e4ece5;
  --palette-night-muted: #a5b4a9;
  --palette-night-border: #34453a;
  --palette-night-primary: #a2c7ab;
  --palette-night-on-primary: #131d18;
  --palette-night-secondary: #bfd4b8;
  --palette-night-surface: #26392a;
  --palette-night-surface-border: #3c5140;
  --palette-night-code-background: #1d2921;
  --palette-night-code-border: #2c3f31;
  --palette-night-code-inline: #243428;
`;

const toCamel = (str: string): string => str.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());

function collectVariables(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null = re.exec(css);
  while (match !== null) {
    const rawKey = match[1];
    const rawVal = match[2];
    if (rawKey && rawVal) {
      vars.set(rawKey.trim(), rawVal.trim());
    }
    match = re.exec(css);
  }
  return vars;
}

function resolveVariable(
  val: string | undefined,
  vars: Map<string, string>,
  seen = new Set<string>(),
): string {
  if (!val) return "";
  const trimmed = val.trim();
  const varMatch = trimmed.match(/^var\(\s*--([a-zA-Z0-9_-]+)\s*\)$/);
  if (!varMatch) return trimmed;
  const ref = varMatch[1];
  if (!ref || seen.has(ref)) return "";
  seen.add(ref);
  const target = vars.get(ref);
  return target ? resolveVariable(target, vars, seen) : "";
}

function partitionThemes(rawVars: Map<string, string>): {
  day: Record<string, string>;
  night: Record<string, string>;
} {
  const day: Record<string, string> = {};
  const night: Record<string, string> = {};
  for (const [key, val] of rawVars) {
    const resolved = resolveVariable(val, rawVars);
    if (key.startsWith("palette-day-")) {
      day[toCamel(key.slice("palette-day-".length))] = resolved;
    } else if (key.startsWith("palette-night-")) {
      night[toCamel(key.slice("palette-night-".length))] = resolved;
    }
  }
  return { day, night };
}

/**
 * Parse tokens.css CSS custom property declarations (--palette-day-*, --palette-night-*,
 * --color-*, and semantic aliases), resolving var(--...) references.
 */
export function parseCssTokens(css: string): Palette {
  const effectiveCss = css.trim() ? css : FALLBACK_TOKENS;
  const rawVars = collectVariables(effectiveCss);
  const { day, night } = partitionThemes(rawVars);

  const paper = night.background || resolveVariable(rawVars.get("paper"), rawVars) || "#131d18";
  const surface =
    night.codeBackground || resolveVariable(rawVars.get("code-bg"), rawVars) || night.surface || "#1d2921";
  const line = night.border || resolveVariable(rawVars.get("line"), rawVars) || "#34453a";
  const ink = night.text || resolveVariable(rawVars.get("ink"), rawVars) || "#e4ece5";
  const muted = night.muted || resolveVariable(rawVars.get("muted"), rawVars) || "#a5b4a9";
  const green = night.primary || resolveVariable(rawVars.get("green"), rawVars) || "#a2c7ab";
  const sage = night.secondary || resolveVariable(rawVars.get("atlas-accent"), rawVars) || "#bfd4b8";
  const white = "#fff";

  return Object.freeze({
    paper,
    surface,
    line,
    ink,
    muted,
    green,
    sage,
    white,
    day: Object.freeze(day as ThemeTokens),
    night: Object.freeze(night as ThemeTokens),
  });
}

const capturedTokens =
  "tokens" in snapshot && typeof snapshot.tokens === "string" ? snapshot.tokens : FALLBACK_TOKENS;

export const palette: Palette = parseCssTokens(capturedTokens);
