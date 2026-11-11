/**
 * Animated terminal banner: figlet ASCII art typed out in an SVG.
 *
 * GitHub renders README images through <img>, which runs no JavaScript, so motion
 * comes from SMIL (typing and wipes) and CSS (the terrain shimmer and cursor). The
 * reveal plays once on load; the shimmer and cursor keep going. Under
 * `prefers-reduced-motion` everything is shown static.
 */
import figlet, { type FontName } from "figlet";

export type BannerConfig = {
  text: string;
  font: string;
  title: string;
  tagline: string[];
};

/** Terrain palette shared with archont561.github.io. */
const C = {
  paper: "#131d18",
  surface: "#1d2921",
  line: "#34453a",
  ink: "#e4ece5",
  muted: "#a5b4a9",
  green: "#a2c7ab",
  sage: "#8FA17D",
  forest: "#3d6b4f",
  copper: "#B9794D",
};

const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace";
const ART_SIZE = 14;
const ART_STEP = 16.5;
const TEXT_SIZE = 13;
const ADVANCE = 0.6; // monospace advance per em; textLength pins the grid to it
const PAD = 28;
const BAR = 34;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmt = (n: number) => Number(n.toFixed(2)).toString();

/** Last element of a non-empty list; the banner layout always has at least one row. */
function last<T>(items: T[]): T {
  const item = items.at(-1);
  if (item === undefined) throw new RangeError("expected a non-empty list");
  return item;
}

/** Double-line box glyphs as polylines inside one cell, centred on (cx, cy). */
function boxGlyph(ch: string, x: number, y: number, w: number, h: number): string | null {
  const cx = x + w / 2,
    cy = y + h / 2,
    d = Math.min(w, h) * 0.2;
  const r = x + w,
    b = y + h;
  const P = (...pts: [number, number][]) => `M${pts.map(([px, py]) => `${fmt(px)} ${fmt(py)}`).join("L")}`;
  switch (ch) {
    case "═":
      return P([x, cy - d], [r, cy - d]) + P([x, cy + d], [r, cy + d]);
    case "║":
      return P([cx - d, y], [cx - d, b]) + P([cx + d, y], [cx + d, b]);
    case "╗":
      return P([x, cy - d], [cx + d, cy - d], [cx + d, b]) + P([x, cy + d], [cx - d, cy + d], [cx - d, b]);
    case "╔":
      return P([r, cy - d], [cx - d, cy - d], [cx - d, b]) + P([r, cy + d], [cx + d, cy + d], [cx + d, b]);
    case "╝":
      return P([x, cy + d], [cx + d, cy + d], [cx + d, y]) + P([x, cy - d], [cx - d, cy - d], [cx - d, y]);
    case "╚":
      return P([r, cy + d], [cx - d, cy + d], [cx - d, y]) + P([r, cy - d], [cx + d, cy - d], [cx + d, y]);
    default:
      return null;
  }
}

/** One figlet row: █ runs merge into rects, box glyphs become strokes, anything else stays text. */
function cells(line: string, x0: number, top: number, cw: number, ch: number): string {
  const rects: string[] = [];
  const paths: string[] = [];
  const texts: string[] = [];
  for (let i = 0; i < line.length; ) {
    const c = line.charAt(i);
    if (c === "█") {
      let j = i;
      while (line.charAt(j) === "█") j++;
      // A hair of overlap closes anti-aliasing seams between neighbouring rows.
      rects.push(
        `<rect x="${fmt(x0 + i * cw)}" y="${fmt(top - 0.3)}" width="${fmt((j - i) * cw)}" height="${fmt(ch + 0.6)}"/>`,
      );
      i = j;
      continue;
    }
    if (c !== " ") {
      const path = boxGlyph(c, x0 + i * cw, top, cw, ch);
      if (path) paths.push(path);
      else texts.push(`<text x="${fmt(x0 + i * cw)}" y="${fmt(top + ch - 4)}" class="c">${esc(c)}</text>`);
    }
    i++;
  }
  return (
    `<g class="a">${rects.join("")}</g>` +
    (paths.length ? `<path class="sh" d="${paths.join("")}"/>` : "") +
    texts.join("")
  );
}

export function renderBanner(config: BannerConfig): string {
  const raw = figlet.textSync(config.text, { font: config.font as FontName }).split("\n");
  while (raw.length && !last(raw).trim()) raw.pop();
  const cols = Math.max(...raw.map((line) => line.length));
  const art = raw.map((line) => line.padEnd(cols));

  const artCw = ART_SIZE * ADVANCE;
  const textCw = TEXT_SIZE * ADVANCE;
  const command = `figlet -f "${config.font}" ${config.text}`;
  const second = "cat tagline.txt";
  const widest = Math.max(
    cols * artCw,
    ...config.tagline.map((line) => line.length * textCw),
    (command.length + 2) * textCw,
  );
  const width = Math.ceil(widest + PAD * 2);

  let y = BAR + 32;
  const yCmd = y;
  y += 30;
  const yArt = art.map((_, i) => y + i * ART_STEP);
  const artRows = art.map((line, i) => ({ line, y: y + i * ART_STEP }));
  y = last(yArt) + 38;
  const yCmd2 = y;
  y += 28;
  const yTag = config.tagline.map((_, i) => y + i * 20);
  const tagRows = config.tagline.map((line, i) => ({ line, y: y + i * 20 }));
  y = last(yTag) + 32;
  const yPrompt = y;
  const height = Math.ceil(yPrompt + 26);

  const clips: string[] = [];
  const body: string[] = [];
  let clipId = 0;

  /** A clipPath whose rect grows from 0 to `w`, either per character or as one wipe. */
  const reveal = (
    x: number,
    yTop: number,
    h: number,
    w: number,
    begin: number,
    dur: number,
    steps?: number,
  ) => {
    const id = `r${clipId++}`;
    const anim = steps
      ? `<animate attributeName="width" begin="${fmt(begin)}s" dur="${fmt(dur)}s" fill="freeze" calcMode="discrete" values="${Array.from({ length: steps + 1 }, (_, i) => fmt((w * i) / steps)).join(";")}"/>`
      : `<animate attributeName="width" begin="${fmt(begin)}s" dur="${fmt(dur)}s" fill="freeze" values="0;${fmt(w)}" keySplines="0.2 0 0.2 1" calcMode="spline"/>`;
    clips.push(
      `<clipPath id="${id}"><rect x="${fmt(x)}" y="${fmt(yTop)}" width="0" height="${fmt(h)}">${anim}</rect></clipPath>`,
    );
    return id;
  };
  const appear = (begin: number) =>
    `<set attributeName="opacity" to="1" begin="${fmt(begin)}s" fill="freeze"/>`;

  const x0 = PAD;
  const promptW = 2 * textCw;

  // 1. "$ figlet ..." typed character by character.
  const t1 = 0.4;
  const d1 = command.length * 0.042;
  body.push(
    `<g class="seq" opacity="0">${appear(t1 - 0.15)}<text x="${x0}" y="${yCmd}" class="p">$</text></g>`,
    `<text x="${fmt(x0 + promptW)}" y="${yCmd}" class="c anim" clip-path="url(#${reveal(x0 + promptW, yCmd - TEXT_SIZE, TEXT_SIZE * 1.5, command.length * textCw, t1, d1, command.length)})">${esc(command)}</text>`,
  );

  // 2. The figlet art, drawn as vector cells (no font seams) and wiped in line by line.
  const t2 = t1 + d1 + 0.3;
  artRows.forEach(({ line, y: rowY }, i) => {
    const top = rowY - ART_STEP + 3;
    const clip = reveal(x0, top - 1, ART_STEP + 2, cols * artCw, t2 + i * 0.12, 0.5);
    body.push(`<g class="anim" clip-path="url(#${clip})">${cells(line, x0, top, artCw, ART_STEP)}</g>`);
  });

  // 3. "$ cat tagline.txt" typed, then the tagline wiped in.
  const t3 = t2 + art.length * 0.12 + 0.75;
  const d3 = second.length * 0.05;
  body.push(
    `<g class="seq" opacity="0">${appear(t3 - 0.15)}<text x="${x0}" y="${yCmd2}" class="p">$</text></g>`,
    `<text x="${fmt(x0 + promptW)}" y="${yCmd2}" class="c anim" clip-path="url(#${reveal(x0 + promptW, yCmd2 - TEXT_SIZE, TEXT_SIZE * 1.5, second.length * textCw, t3, d3, second.length)})">${second}</text>`,
  );
  let t4 = t3 + d3 + 0.25;
  tagRows.forEach(({ line, y: rowY }) => {
    const dur = Math.max(0.5, line.length * 0.011);
    const clip = reveal(x0, rowY - TEXT_SIZE, TEXT_SIZE * 1.5, line.length * textCw, t4, dur);
    body.push(`<text x="${x0}" y="${rowY}" class="t anim" clip-path="url(#${clip})">${esc(line)}</text>`);
    t4 += dur + 0.1;
  });

  // 4. Idle prompt with a blinking block cursor.
  body.push(
    `<g class="seq" opacity="0">${appear(t4 + 0.2)}<text x="${x0}" y="${yPrompt}" class="p">$</text>` +
      `<rect class="cursor" x="${fmt(x0 + promptW)}" y="${fmt(yPrompt - TEXT_SIZE + 2)}" width="${fmt(textCw)}" height="${TEXT_SIZE + 2}" fill="${C.green}"/></g>`,
  );

  const label = `${config.text}: ${config.tagline.join(" ")}`;
  const dots = [C.copper, C.sage, C.green]
    .map((fill, i) => `<circle cx="${20 + i * 20}" cy="${BAR / 2}" r="6" fill="${fill}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(config.text)}</title>
<desc id="desc">${esc(label)}</desc>
<style>
text{font-family:${FONT};white-space:pre}
.p{fill:${C.green};font-size:${TEXT_SIZE}px;font-weight:700}
.c{fill:${C.ink};font-size:${TEXT_SIZE}px}
.t{fill:${C.muted};font-size:${TEXT_SIZE}px}
.a{fill:url(#terrain)}
.sh{fill:none;stroke:url(#terrain);stroke-width:1.1;opacity:.55}
.h{fill:${C.muted};font-size:12px}
.s1{animation:shift 9s ease-in-out infinite alternate}
.s2{animation:shift 9s ease-in-out -3s infinite alternate}
.s3{animation:shift 9s ease-in-out -6s infinite alternate}
.cursor{animation:blink 1.1s steps(1) infinite}
@keyframes shift{0%{stop-color:${C.forest}}33%{stop-color:${C.sage}}66%{stop-color:${C.green}}100%{stop-color:${C.copper}}}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){
.anim{clip-path:none!important}
.seq{opacity:1!important}
.s1,.s2,.s3,.cursor{animation:none}
}
</style>
<defs>
<linearGradient id="terrain" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${fmt(x0 + cols * artCw)}" y2="0">
<stop offset="0" class="s1" stop-color="${C.forest}"/><stop offset="0.5" class="s2" stop-color="${C.sage}"/><stop offset="1" class="s3" stop-color="${C.copper}"/>
</linearGradient>
${clips.join("\n")}
</defs>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${C.paper}" stroke="${C.line}"/>
<path d="M0.5 ${BAR}H${width - 0.5}" stroke="${C.line}"/>
<path d="M10.5 0.5H${width - 10.5}A10 10 0 0 1 ${width - 0.5} 10.5V${BAR}H0.5V10.5A10 10 0 0 1 10.5 0.5Z" fill="${C.surface}"/>
${dots}
<text x="${width / 2}" y="${BAR / 2 + 4}" text-anchor="middle" class="h">${esc(config.title)}</text>
${body.join("\n")}
</svg>
`;
}
