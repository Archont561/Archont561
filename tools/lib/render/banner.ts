/**
 * Animated terminal banner: figlet ASCII art and portfolio map typed out in an SVG.
 *
 * GitHub renders README images through <img>, which runs no JavaScript, so motion
 * comes strictly from SMIL (typing, wipes, contour settling, ripple pin, and shine).
 * The reveal sequence plays once with SMIL when viewers open the portfolio, and freezes
 * cleanly at its finished state. Under `prefers-reduced-motion` everything is shown static.
 */
import figlet, { type FontName } from "figlet";
import { siZsh } from "simple-icons";
import { brandExtras, palette } from "@/tools/lib/render/palette.ts";
import { contour, contourColor, type PortalRoute } from "./portal.ts";

export type BannerPortalConfig = {
  url: string;
  label: string;
  kicker: string;
  cta: string;
  routes: PortalRoute[];
};

export type BannerConfig = {
  text: string;
  font: string;
  title: string;
  tagline: string[];
  portal?: BannerPortalConfig;
};

/** Palette consumed from palette.ts (tokens.css + brandExtras). */
const C = {
  paper: palette.paper,
  surface: palette.surface,
  line: palette.line,
  ink: palette.ink,
  muted: palette.muted,
  green: palette.green,
  sage: palette.sage,
  forest: brandExtras.forest,
  copper: brandExtras.copper,
};

const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace";
const ART_SIZE = 14;
const ART_STEP = 16.5;
const TEXT_SIZE = 13;
const ADVANCE = 0.6; // monospace advance per em; textLength pins the grid to it
const PAD = 28;
const BAR = 34;
const MAP_W = 236;
const URL_SIZE = 24;
const ROW_STEP = 22;

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
  const width = Math.max(config.portal ? 728 : 0, Math.ceil(widest + PAD * 2));

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
  y = last(yTag);

  const x0 = PAD;
  const promptW = 2 * textCw;
  const clips: string[] = [];
  const body: string[] = [];
  const gradients: string[] = [
    `<linearGradient id="terrain" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${fmt(x0 + cols * artCw)}" y2="0">
<stop offset="0" stop-color="${C.forest}"/><stop offset="0.5" stop-color="${C.sage}"/><stop offset="1" stop-color="${C.copper}"/>
</linearGradient>`,
  ];
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

  let yPrompt: number;
  let height: number;

  if (config.portal) {
    const portal = config.portal;
    y += 30;
    const yDivider = y;
    y += 24;
    const yCmd3 = y;
    const third = `open ${portal.url}`;
    y += 26;

    const mapX = PAD;
    const mapY = y;
    const textX = mapX + MAP_W + 26;
    const yKicker = mapY + 20;
    const yUrl = yKicker + 32;
    const yRows = yUrl + 28;
    const mapH = Math.max(188, yRows + (portal.routes.length - 1) * ROW_STEP + 16 - mapY);
    const cx = mapX + MAP_W / 2;
    const cy = mapY + mapH / 2;

    const urlCw = URL_SIZE * ADVANCE;
    const rowCw = TEXT_SIZE * ADVANCE;
    const pathCols = Math.max(...portal.routes.map((row) => row.path.length)) + 2;

    y = mapY + mapH + 30;
    yPrompt = y;
    height = Math.ceil(yPrompt + 26);

    // Divider line inside terminal
    const divClip = reveal(x0, yDivider - 2, 4, width - 2 * x0, t4 + 0.15, 0.35);
    body.push(
      `<path d="M${x0} ${yDivider}H${width - x0}" stroke="${C.line}" stroke-dasharray="4 4" opacity=".6" class="anim" clip-path="url(#${divClip})"/>`,
    );

    // Command 3: "$ open ..."
    const t5 = t4 + 0.35;
    const d5 = third.length * 0.035;
    body.push(
      `<g class="seq" opacity="0">${appear(t5 - 0.12)}<text x="${x0}" y="${yCmd3}" class="p">$</text></g>`,
      `<text x="${fmt(x0 + promptW)}" y="${yCmd3}" class="c anim" clip-path="url(#${reveal(x0 + promptW, yCmd3 - TEXT_SIZE, TEXT_SIZE * 1.5, third.length * textCw, t5, d5, third.length)})">${esc(third)}</text>`,
    );

    // Map & details timeline
    const tUrl = t5 + d5 + 0.3;
    const dUrl = portal.label.length * 0.055;
    const tRows = tUrl + dUrl + 0.3;

    // Contours & Grid
    const contours = Array.from({ length: 7 }, (_, level) => {
      const stroke = contourColor(level);
      const dur = fmt(1.2 + level * 0.15);
      const fromOffset = level % 2 ? 60 : -60;
      return `<path class="contour" d="${contour(cx, cy, level)}" stroke="${stroke}" stroke-dasharray="5 4" stroke-dashoffset="${fromOffset}">
<animate attributeName="stroke-dashoffset" from="${fromOffset}" to="0" begin="${fmt(tUrl - 0.15)}s" dur="${dur}s" fill="freeze"/>
</path>`;
    }).join("\n");

    const grid = [0.25, 0.5, 0.75]
      .flatMap((f) => [
        `<path d="M${fmt(mapX + MAP_W * f)} ${mapY}V${mapY + mapH}"/>`,
        `<path d="M${mapX} ${fmt(mapY + mapH * f)}H${mapX + MAP_W}"/>`,
      ])
      .join("");

    const pin = `<g transform="translate(${fmt(cx)} ${fmt(cy)})">
<circle r="4" fill="none" stroke="${C.copper}" stroke-width="2" opacity="0">
<set attributeName="opacity" to="1" begin="${fmt(tUrl)}s" fill="freeze"/>
<animate attributeName="r" from="4" to="24" begin="${fmt(tUrl)}s" dur="1.2s" fill="freeze"/>
<animate attributeName="opacity" from="1" to="0" begin="${fmt(tUrl)}s" dur="1.2s" fill="freeze"/>
</circle>
<path d="M0 0C-3 -6 -9 -10 -9 -16A9 9 0 1 1 9 -16C9 -10 3 -6 0 0Z" fill="${C.copper}"/>
<circle cy="-16" r="3.5" fill="${C.paper}"/>
</g>`;

    // Map group
    body.push(
      `<g class="seq" opacity="0">${appear(tUrl - 0.2)}` +
        `<g clip-path="url(#map)"><rect x="${mapX}" y="${mapY}" width="${MAP_W}" height="${mapH}" fill="${C.surface}"/><g class="grid">${grid}</g>${contours}</g>` +
        `<rect x="${mapX + 0.5}" y="${mapY + 0.5}" width="${MAP_W - 1}" height="${mapH - 1}" rx="8" fill="none" stroke="${C.line}"/>` +
        `${pin}` +
        `</g>`,
    );

    // Kicker
    body.push(
      `<g class="seq" opacity="0">${appear(tUrl - 0.1)}<text x="${textX}" y="${yKicker}" class="k">${esc(portal.kicker)}</text></g>`,
    );

    // Typed URL
    const urlW = portal.label.length * urlCw;
    const urlSteps = portal.label.length;
    const typed = Array.from({ length: urlSteps + 1 }, (_, i) => fmt((urlW * i) / urlSteps)).join(";");
    clips.push(
      `<clipPath id="type-url"><rect x="${textX}" y="${yUrl - URL_SIZE}" width="0" height="${URL_SIZE * 1.4}"><animate attributeName="width" begin="${fmt(tUrl)}s" dur="${fmt(dUrl)}s" fill="freeze" calcMode="discrete" values="${typed}"/></rect></clipPath>`,
    );

    body.push(
      `<text x="${textX}" y="${yUrl}" class="u anim" textLength="${fmt(urlW)}" clip-path="url(#type-url)">${esc(portal.label)}</text>`,
      `<g class="seq" opacity="0">${appear(tUrl + dUrl)}<rect class="cursor" x="${fmt(textX + urlW + 4)}" y="${yUrl - URL_SIZE + 4}" width="${fmt(urlCw * 0.55)}" height="${URL_SIZE}" fill="${C.green}"/></g>`,
    );

    // Route rows
    portal.routes.forEach((row, i) => {
      const rowY = yRows + i * ROW_STEP;
      const begin = fmt(tRows + i * 0.25);
      body.push(
        `<g class="seq" opacity="0">
<set attributeName="opacity" to="1" begin="${begin}s" fill="freeze"/>
<animateTransform attributeName="transform" type="translate" from="-10 0" to="0 0" begin="${begin}s" dur="0.4s" fill="freeze"/>
<text x="${textX}" y="${rowY}" class="r">${esc(row.path)}</text><text x="${fmt(textX + pathCols * rowCw)}" y="${rowY}" class="d">${esc(row.text)}</text>
</g>`,
      );
    });

    // CTA button
    const ctaW = Math.ceil(portal.cta.length * rowCw + 32);
    const ctaX = width - PAD - ctaW;
    const ctaY = yKicker - 16;
    const tCta = tRows + portal.routes.length * 0.25;
    body.push(
      `<g class="seq" opacity="0"><set attributeName="opacity" to="1" begin="${fmt(tCta)}s" fill="freeze"/>
<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="26" rx="13" fill="${C.copper}"/>
<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="26" rx="13" fill="url(#shine)"/>
<text x="${fmt(ctaX + ctaW / 2)}" y="${ctaY + 17}" text-anchor="middle" class="cta">${esc(portal.cta)}</text></g>`,
    );

    gradients.push(
      `<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${palette.white}" stop-opacity="0"/>
<stop offset="0.5" stop-color="${palette.white}" stop-opacity="0"><animate attributeName="stop-opacity" values="0;0.45;0" begin="${fmt(tCta + 0.2)}s" dur="0.9s" fill="freeze"/></stop>
<stop offset="1" stop-color="${palette.white}" stop-opacity="0"/>
</linearGradient>`,
    );

    clips.push(
      `<clipPath id="map"><rect x="${mapX}" y="${mapY}" width="${MAP_W}" height="${mapH}" rx="8"/></clipPath>`,
    );

    // Idle zsh prompt at bottom
    const tPrompt = tCta + 0.35;
    body.push(
      `<g class="seq" opacity="0">${appear(tPrompt)}<text x="${x0}" y="${yPrompt}" class="p">~ ❯</text>` +
        `<rect class="cursor" x="${fmt(x0 + 3.2 * textCw)}" y="${fmt(yPrompt - TEXT_SIZE + 2)}" width="${fmt(textCw)}" height="${TEXT_SIZE + 2}" fill="${C.green}"/></g>`,
    );
  } else {
    // 4. Idle prompt with a blinking block cursor.
    y += 32;
    yPrompt = y;
    height = Math.ceil(yPrompt + 26);
    body.push(
      `<g class="seq" opacity="0">${appear(t4 + 0.2)}<text x="${x0}" y="${yPrompt}" class="p">$</text>` +
        `<rect class="cursor" x="${fmt(x0 + promptW)}" y="${fmt(yPrompt - TEXT_SIZE + 2)}" width="${fmt(textCw)}" height="${TEXT_SIZE + 2}" fill="${C.green}"/></g>`,
    );
  }

  const label = `${config.text}: ${config.tagline.join(" ")}`;
  const dots = [C.copper, C.sage, C.green]
    .map((fill, i) => `<circle cx="${20 + i * 20}" cy="${BAR / 2}" r="6" fill="${fill}"/>`)
    .join("");

  const zshX = width - 38;
  const zshHeader = `<g transform="translate(${zshX} 8) scale(0.75)" fill="${C.copper}" opacity=".85"><path d="${siZsh.path}"/></g><text x="${zshX - 6}" y="22" text-anchor="end" class="h">zsh</text>`;

  const defs = [...gradients, ...clips].filter(Boolean).join("\n");

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
.k{fill:${C.copper};font-size:11px;font-weight:700;letter-spacing:2px}
.u{fill:${C.ink};font-size:${URL_SIZE}px;font-weight:700}
.r{fill:${C.green};font-size:${TEXT_SIZE}px;font-weight:700}
.d{fill:${C.muted};font-size:${TEXT_SIZE}px}
.cta{fill:${C.paper};font-size:${TEXT_SIZE}px;font-weight:700}
.contour{fill:none;stroke-width:1.3;opacity:.85}
.grid path{stroke:${C.line};stroke-width:1;stroke-dasharray:2 5}
.cursor{animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){
.anim{clip-path:none!important}
.seq{opacity:1!important}
.cursor{animation:none!important}
}
</style>
<defs>
${defs}
</defs>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${C.paper}" stroke="${C.line}"/>
<path d="M0.5 ${BAR}H${width - 0.5}" stroke="${C.line}"/>
<path d="M10.5 0.5H${width - 10.5}A10 10 0 0 1 ${width - 0.5} 10.5V${BAR}H0.5V10.5A10 10 0 0 1 10.5 0.5Z" fill="${C.surface}"/>
${dots}
<text x="${width / 2}" y="${BAR / 2 + 4}" text-anchor="middle" class="h">${esc(config.title)}</text>
${zshHeader}
${body.join("\n")}
</svg>
`;
}
