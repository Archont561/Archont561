/**
 * Animated SVG cards for the README: one per featured project, an "every project" card,
 * and the `./principles --show` terminal.
 *
 * GitHub shows them through <img>: no scripts, no pointer events, no web fonts, and the
 * markdown sanitizer strips `loading`, so an image can neither react to hover nor know
 * it scrolled into view (both verified). The cards therefore use motion that needs
 * neither: a spotlight that tours the grid one card at a time, and a terminal that
 * replays its command after a long hold. `prefers-reduced-motion` shows them static.
 */

import { CARD_DIR } from "@/tools/lib/render/outputs.ts";

export const PRINCIPLES = `${CARD_DIR}/principles.svg`;
export const cardPath = (slug: string): string => `${CARD_DIR}/${slug}.svg`;

const C = {
  paper: "#131d18",
  surface: "#1d2921",
  line: "#34453a",
  ink: "#e4ece5",
  muted: "#a5b4a9",
  green: "#a2c7ab",
  sage: "#8FA17D",
  moss: "#648b63",
  copper: "#B9794D",
};

const KIND_ACCENTS: Record<string, string> = {
  geospatial: C.copper,
  environments: C.moss,
  testing: C.sage,
  packaging: C.moss,
  compilers: C.copper,
  portfolio: C.green,
};

const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace";
const ADVANCE = 0.6;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n: number) => Number(n.toFixed(2)).toString();

const REDUCED =
  "@media (prefers-reduced-motion:reduce){*{animation:none!important}.spot{opacity:0!important}" +
  ".rise,.line{opacity:1!important;transform:none!important}.cover{display:none}}";

/** Greedy word wrap for monospace text; the last kept line ends in … when text is cut. */
export function wrap(text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= width)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word.slice(0, width));
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${(kept[maxLines - 1] as string).slice(0, width - 1)}…`;
  return kept;
}

// ------------------------------------------------------------------ project cards

export type ProjectCard = {
  name: string;
  /** Shown after `~/archont561/` in the card's header. */
  path: string;
  description: string;
  kind: string;
  /** Stack chips (outlined green), then registry chips (outlined copper). */
  stack: string[];
  ships: string[];
  cta: string;
  /** Position in the grid and its size, so the spotlight can take turns. */
  index: number;
  count: number;
};

export const CARD = { width: 420, height: 178, margin: 9, slot: 3 } as const;

type Chip = { label: string; shipped: boolean; x: number; width: number };

/** Lay chips left to right and drop whatever would run into the call to action. */
export function layoutChips(stack: string[], ships: string[], start: number, limit: number): Chip[] {
  const chips: Chip[] = [];
  let x = start;
  for (const [i, label] of [...stack, ...ships].entries()) {
    const width = label.length * 11 * ADVANCE + 16;
    if (x + width > limit) break;
    chips.push({ label, shipped: i >= stack.length, x, width });
    x += width + 6;
  }
  return chips;
}

/** Keyframes that light one card for its slot of the tour and leave it dark otherwise. */
export function spotlightKeyframes(index: number, count: number, slot: number = CARD.slot) {
  const cycle = slot * count;
  const on = 100 / count;
  return {
    cycle,
    delay: index * slot,
    frames: `0%{opacity:0}${fmt(on * 0.3)}%{opacity:.75}${fmt(on * 0.7)}%{opacity:.75}${fmt(on)}%{opacity:0}100%{opacity:0}`,
    sweep: fmt(on),
  };
}

export function projectCard(card: ProjectCard): string {
  const { width: W, height: H, margin: M } = CARD;
  const spot = spotlightKeyframes(card.index, card.count);
  const left = M + 18;
  const right = W - M - 18;
  const cta = `${card.cta} →`;
  const accent = KIND_ACCENTS[card.kind.toLowerCase()] ?? C.sage;
  const chips = layoutChips(card.stack, card.ships, left, right - cta.length * 12 * ADVANCE - 12)
    .map(
      (chip) =>
        `<g transform="translate(${fmt(chip.x)} ${H - M - 40})"><rect width="${fmt(chip.width)}" height="20" rx="10" fill="${chip.shipped ? "none" : C.paper}" stroke="${chip.shipped ? C.copper : C.line}"/>` +
        `<text x="${fmt(chip.width / 2)}" y="14" text-anchor="middle" font-size="11" fill="${chip.shipped ? C.copper : C.green}">${esc(chip.label)}</text></g>`,
    )
    .join("");
  const rise = (n: number) => `class="rise" style="animation-delay:${fmt(0.15 * card.index + 0.12 * n)}s"`;
  const box = `x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" rx="12"`;
  const desc = wrap(card.description, 46, 2)
    .map(
      (line, i) =>
        `<text x="${left}" y="${M + 84 + i * 18}" font-size="12.5" fill="${C.muted}">${esc(line)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">${esc(card.name)} (${esc(card.cta)})</title>
<desc id="d">${esc(card.description)}${card.stack.length ? ` Stack: ${esc(card.stack.join(", "))}.` : ""}${card.ships.length ? ` Ships to ${esc(card.ships.join(", "))}.` : ""}</desc>
<style>
text{font-family:${FONT};white-space:pre}
.rise{opacity:0;animation:rise .6s ease-out forwards}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.spot{opacity:0;animation:spot ${fmt(spot.cycle)}s ease-in-out ${fmt(spot.delay)}s infinite}
@keyframes spot{${spot.frames}}
.sheen{transform:translateX(-160px);animation:sheen ${fmt(spot.cycle)}s ease-in-out ${fmt(spot.delay)}s infinite}
@keyframes sheen{0%{transform:translateX(-160px)}${spot.sweep}%{transform:translateX(${W + 40}px)}100%{transform:translateX(${W + 40}px)}}
${REDUCED}
</style>
<defs>
<filter id="glow" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
<clipPath id="shape"><rect ${box}/></clipPath>
<linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<rect class="spot" ${box} fill="none" stroke="${C.copper}" stroke-width="3" filter="url(#glow)"/>
<rect ${box} fill="${C.surface}" stroke="${C.line}"/>
<path d="M${fmt(M + 14)} ${fmt(M + 1)}H${fmt(W - M - 14)}" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity=".85"/>
<rect class="spot" ${box} fill="none" stroke="${C.copper}" stroke-width="1.2"/>
<g clip-path="url(#shape)"><rect class="sheen" x="0" y="0" width="120" height="${H}" fill="url(#sh)" transform="skewX(-18)"/></g>
<g ${rise(0)}><text x="${left}" y="${M + 26}" font-size="11" fill="${C.muted}"><tspan fill="${C.moss}">~/archont561/</tspan>${esc(card.path)}</text>
<text x="${right}" y="${M + 26}" font-size="10.5" text-anchor="end" fill="${C.copper}" letter-spacing="1.5">${esc(card.kind.toUpperCase())}</text></g>
<g ${rise(1)}><text x="${left}" y="${M + 58}" font-size="21" font-weight="700" fill="${C.ink}">${esc(card.name)}</text></g>
<g ${rise(2)}>${desc}</g>
<g ${rise(3)}>${chips}</g>
<g ${rise(4)}><text x="${right}" y="${H - M - 25}" font-size="12" text-anchor="end" fill="${C.green}">${esc(card.cta)} <tspan fill="${C.copper}">→</tspan></text></g>
</svg>
`;
}

// ------------------------------------------------------------------ terminal

export type TerminalLine = { key: string; rule: string; detail: string };
export type Terminal = { command: string; lines: TerminalLine[]; footer: string; width: number };

/** One replay cycle: type, print, hold, clear. Seconds. */
export const LOOP = {
  cycle: 16,
  start: 0.25,
  perChar: 0.06,
  perLine: 0.32,
  hold: 14.6,
  clear: 15.4,
} as const;

const pct = (seconds: number) => fmt((100 * seconds) / LOOP.cycle);

/** Opacity keyframes for something that appears at `start` and stays until the clear. */
export const shownFrom = (name: string, start: number): string =>
  `@keyframes ${name}{0%,${pct(start)}%{opacity:0}${pct(start + 0.25)}%,${pct(LOOP.hold)}%{opacity:1}${pct(LOOP.clear)}%,100%{opacity:0}}`;

/** Steps a cover rectangle right one character at a time, revealing the command. */
export function typingKeyframes(chars: number, width: number): string {
  const steps = Array.from(
    { length: chars + 1 },
    (_, k) => `${pct(LOOP.start + k * LOOP.perChar)}%{transform:translateX(${fmt((k * width) / chars)}px)}`,
  );
  return `@keyframes type{${steps.join("")}${pct(LOOP.hold)}%{transform:translateX(${fmt(width)}px)}${pct(LOOP.clear)}%{transform:translateX(0)}}`;
}

/**
 * A terminal that types `command`, prints `lines`, holds, clears, and replays. Whoever
 * scrolls to it mid-hold sees the whole output; whoever arrives at the end sees it replay.
 */
export function terminalCard(term: Terminal): string {
  const W = term.width;
  const BAR = 30;
  const STEP = 22;
  const top = BAR + 30;
  const H = top + 30 + term.lines.length * STEP + 36;
  const typed = LOOP.start + term.command.length * LOOP.perChar;
  const cmdX = 22 + 2 * 14 * ADVANCE;
  const cmdW = term.command.length * 14 * ADVANCE;
  const keyWidth = Math.max(...term.lines.map((line) => line.key.length)) + 2;
  const frames = term.lines.map((_, i) => shownFrom(`l${i}`, typed + 0.35 + i * LOOP.perLine));
  frames.push(shownFrom("ft", typed + 0.5 + term.lines.length * LOOP.perLine));
  const body = term.lines.map(
    (line, i) =>
      `<text class="line" style="animation:l${i} ${LOOP.cycle}s linear infinite" x="22" y="${top + 30 + i * STEP}" font-size="13.5">` +
      `<tspan fill="${C.green}">${esc(line.key.padEnd(keyWidth))}</tspan><tspan fill="${C.ink}">${esc(line.rule)}</tspan>` +
      `<tspan fill="${C.muted}">  ${esc(line.detail)}</tspan></text>`,
  );
  const footY = top + 30 + term.lines.length * STEP + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">$ ${esc(term.command)}</title>
<desc id="d">${esc(term.lines.map((line) => `${line.key}: ${line.rule} (${line.detail})`).join("; "))}. ${esc(term.footer)}</desc>
<style>
text{font-family:${FONT};white-space:pre}
.cover{animation:type ${LOOP.cycle}s steps(1) infinite}
${typingKeyframes(term.command.length, cmdW)}
.cmd{animation:cmd ${LOOP.cycle}s linear infinite}
@keyframes cmd{0%,${pct(LOOP.hold)}%{opacity:1}${pct(LOOP.clear)}%{opacity:0}100%{opacity:1}}
.cur{animation:blink 1.1s steps(1) infinite}@keyframes blink{50%{opacity:0}}
.ft{animation:ft ${LOOP.cycle}s linear infinite}
${frames.join("\n")}
${REDUCED}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="${C.paper}" stroke="${C.line}"/>
<path d="M.5 ${BAR}V12.5a12 12 0 0 1 12-12h${W - 25}a12 12 0 0 1 12 12V${BAR}z" fill="${C.surface}"/>
<line x1="0" y1="${BAR}" x2="${W}" y2="${BAR}" stroke="${C.line}"/>
${[C.copper, C.sage, C.green].map((color, i) => `<circle cx="${20 + i * 18}" cy="15" r="5.5" fill="${color}"/>`).join("")}
<text x="${W / 2}" y="20" font-size="11.5" text-anchor="middle" fill="${C.muted}">archont561 — zsh</text>
<g class="cmd"><text x="22" y="${top}" font-size="14"><tspan fill="${C.copper}">❯ </tspan><tspan fill="${C.ink}" font-weight="700">${esc(term.command)}</tspan></text>
<rect class="cover" x="${fmt(cmdX)}" y="${top - 15}" width="${fmt(cmdW + 14)}" height="21" fill="${C.paper}"/></g>
${body.join("\n")}
<text class="line ft" x="22" y="${footY}" font-size="13.5" fill="${C.copper}" font-weight="700">${esc(term.footer)}<tspan class="cur" fill="${C.green}"> █</tspan></text>
</svg>
`;
}
