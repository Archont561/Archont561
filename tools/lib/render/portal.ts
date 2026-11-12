/**
 * Animated portal card: the README's link into the portfolio, drawn as a small map.
 *
 * Contour lines flow around a pulsing "you are here" pin while the portfolio URL types out
 * and its sections fade in. Like the banner it runs inside GitHub's <img>, so motion is
 * SMIL (reveals) plus CSS (contour flow, pin pulse, cursor, CTA shimmer); the reveals play
 * once, the rest loops, and `prefers-reduced-motion` shows everything static.
 */
import { fill } from "@/tools/lib/render/badges.ts";
import { brandExtras, palette } from "@/tools/lib/render/palette.ts";

export type PortalRoute = { path: string; text: string };

export type PortalConfig = {
  url: string;
  label: string;
  kicker: string;
  cta: string;
  routes: PortalRoute[];
  /** Matches the banner so the two stack as one column. */
  width: number;
};

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
const ADVANCE = 0.6;
const BAR = 34;
const PAD = 16;
const MAP_W = 236;
const URL_SIZE = 24;
const ROW_SIZE = 13;
const ROW_STEP = 22;
const LEVELS = 7;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmt = (n: number) => Number(n.toFixed(2)).toString();

/** Width of a rendered SVG's root element, so the card can match the banner. */
export function svgWidth(svg: string): number {
  const width = Number(svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/)?.[1]);
  if (!Number.isFinite(width) || width <= 0) throw new RangeError("SVG has no numeric width");
  return width;
}

/** One closed contour: a wobbly ring whose wobble grows with its level, like real terrain. */
export function contour(cx: number, cy: number, level: number, points = 96): string {
  const base = 14 + level * 15;
  const wobble = 2 + level * 1.6;
  const path: string[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const r =
      base +
      wobble *
        (Math.sin(3 * t + level * 0.7) + 0.6 * Math.sin(5 * t + level * 1.3) + 0.3 * Math.sin(2 * t - level));
    path.push(`${fmt(cx + r * Math.cos(t) * 1.15)} ${fmt(cy + r * Math.sin(t) * 0.85)}`);
  }
  return `M${path.join("L")}Z`;
}

/** The summit ring is copper, the slopes sage, the lowlands forest. */
export function contourColor(level: number): string {
  if (level === 0) return C.copper;
  if (level < 3) return C.sage;
  return C.forest;
}

/** Route rows with their `{token}` placeholders filled from the snapshot. */
export const portalRoutes = (routes: PortalRoute[], tokens: Record<string, string | number>): PortalRoute[] =>
  routes.map((route) => ({ path: route.path, text: fill(route.text, tokens) }));

export function renderPortal(config: PortalConfig): string {
  const { width } = config;
  const rows = config.routes;
  const mapX = PAD;
  const mapY = BAR + 12;
  const textX = mapX + MAP_W + 22;
  const yKicker = mapY + 22;
  const yUrl = yKicker + 34;
  const yRows = yUrl + 30;
  const height = Math.ceil(yRows + (rows.length - 1) * ROW_STEP + 22);
  const mapH = height - mapY - PAD;
  const cx = mapX + MAP_W / 2;
  const cy = mapY + mapH / 2 + 6;

  const urlCw = URL_SIZE * ADVANCE;
  const rowCw = ROW_SIZE * ADVANCE;
  const pathCols = Math.max(...rows.map((row) => row.path.length)) + 2;

  // Timeline: the URL types, then the rows slide in one after another.
  const tUrl = 0.5;
  const dUrl = config.label.length * 0.06;
  const tRows = tUrl + dUrl + 0.35;

  const contours = Array.from({ length: LEVELS }, (_, level) => {
    const cls = level % 2 ? "flow rev" : "flow";
    const stroke = contourColor(level);
    return `<path class="${cls}" d="${contour(cx, cy, level)}" stroke="${stroke}" style="animation-duration:${14 + level * 3}s"/>`;
  }).join("\n");

  const grid = [0.25, 0.5, 0.75]
    .flatMap((f) => [
      `<path d="M${fmt(mapX + MAP_W * f)} ${mapY}V${mapY + mapH}"/>`,
      `<path d="M${mapX} ${fmt(mapY + mapH * f)}H${mapX + MAP_W}"/>`,
    ])
    .join("");

  const pin = `<g transform="translate(${fmt(cx)} ${fmt(cy)})">
<circle class="pulse" r="10" fill="none" stroke="${C.copper}" stroke-width="2"/>
<circle class="pulse late" r="10" fill="none" stroke="${C.copper}" stroke-width="2"/>
<path d="M0 0C-3 -6 -9 -10 -9 -16A9 9 0 1 1 9 -16C9 -10 3 -6 0 0Z" fill="${C.copper}"/>
<circle cy="-16" r="3.5" fill="${C.paper}"/>
</g>`;

  const urlW = config.label.length * urlCw;
  const steps = config.label.length;
  const typed = Array.from({ length: steps + 1 }, (_, i) => fmt((urlW * i) / steps)).join(";");
  const url = `<text x="${textX}" y="${yUrl}" class="u anim" textLength="${fmt(urlW)}" clip-path="url(#type)">${esc(config.label)}</text>
<g class="seq" opacity="0"><set attributeName="opacity" to="1" begin="${fmt(tUrl + dUrl)}s" fill="freeze"/><rect class="cursor" x="${fmt(textX + urlW + 4)}" y="${yUrl - URL_SIZE + 4}" width="${fmt(urlCw * 0.55)}" height="${URL_SIZE}" fill="${C.green}"/></g>`;

  const routeRows = rows
    .map((row, i) => {
      const y = yRows + i * ROW_STEP;
      const begin = fmt(tRows + i * 0.28);
      return `<g class="seq" opacity="0">
<set attributeName="opacity" to="1" begin="${begin}s" fill="freeze"/>
<animateTransform attributeName="transform" type="translate" from="-10 0" to="0 0" begin="${begin}s" dur="0.45s" fill="freeze"/>
<text x="${textX}" y="${y}" class="r">${esc(row.path)}</text><text x="${fmt(textX + pathCols * rowCw)}" y="${y}" class="d">${esc(row.text)}</text>
</g>`;
    })
    .join("\n");

  const ctaW = Math.ceil(config.cta.length * rowCw + 32);
  const ctaX = width - PAD - ctaW;
  const ctaY = yKicker - 17;
  const cta = `<g class="seq" opacity="0"><set attributeName="opacity" to="1" begin="${fmt(tRows + rows.length * 0.28)}s" fill="freeze"/>
<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="26" rx="13" fill="${C.copper}"/>
<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="26" rx="13" fill="url(#shine)"/>
<text x="${fmt(ctaX + ctaW / 2)}" y="${ctaY + 17}" text-anchor="middle" class="cta">${esc(config.cta)}</text></g>`;

  const address = `<rect x="${fmt(width / 2 - 150)}" y="8" width="300" height="18" rx="9" fill="${C.paper}" stroke="${C.line}"/>
<text x="${width / 2}" y="21" text-anchor="middle" class="h">${esc(config.url)}</text>`;
  const dots = [C.copper, C.sage, C.green]
    .map((color, i) => `<circle cx="${20 + i * 20}" cy="${BAR / 2}" r="6" fill="${color}"/>`)
    .join("");
  const summary = `${config.kicker} ${config.label}: ${rows.map((row) => `${row.path} ${row.text}`).join("; ")}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="ptitle pdesc">
<title id="ptitle">${esc(`${config.cta} ${config.url}`)}</title>
<desc id="pdesc">${esc(summary)}</desc>
<style>
text{font-family:${FONT};white-space:pre}
.h{fill:${C.muted};font-size:11px}
.k{fill:${C.copper};font-size:11px;font-weight:700;letter-spacing:2px}
.u{fill:${C.ink};font-size:${URL_SIZE}px;font-weight:700}
.r{fill:${C.green};font-size:${ROW_SIZE}px;font-weight:700}
.d{fill:${C.muted};font-size:${ROW_SIZE}px}
.cta{fill:${C.paper};font-size:${ROW_SIZE}px;font-weight:700}
.flow{fill:none;stroke-width:1.3;stroke-dasharray:5 4;opacity:.85;animation:flow linear infinite}
.rev{animation-direction:reverse}
.grid path{stroke:${C.line};stroke-width:1;stroke-dasharray:2 5}
.pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.6s ease-out infinite}
.late{animation-delay:1.3s}
.cursor{animation:blink 1.1s steps(1) infinite}
@keyframes flow{to{stroke-dashoffset:-90}}
@keyframes pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.2);opacity:0}}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){
.anim{clip-path:none!important}
.seq{opacity:1!important}
.flow,.pulse,.cursor{animation:none}
.pulse{opacity:0}
}
</style>
<defs>
<clipPath id="map"><rect x="${mapX}" y="${mapY}" width="${MAP_W}" height="${mapH}" rx="8"/></clipPath>
<clipPath id="type"><rect x="${textX}" y="${yUrl - URL_SIZE}" width="0" height="${URL_SIZE * 1.4}"><animate attributeName="width" begin="${fmt(tUrl)}s" dur="${fmt(dUrl)}s" fill="freeze" calcMode="discrete" values="${typed}"/></rect></clipPath>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${palette.white}" stop-opacity="0"/>
<stop offset="0.5" stop-color="${palette.white}" stop-opacity="0"><animate attributeName="stop-opacity" values="0;0;.35;0" keyTimes="0;.6;.8;1" dur="4.5s" repeatCount="indefinite"/></stop>
<stop offset="1" stop-color="${palette.white}" stop-opacity="0"/>
</linearGradient>
</defs>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${C.paper}" stroke="${C.line}"/>
<path d="M10.5 0.5H${width - 10.5}A10 10 0 0 1 ${width - 0.5} 10.5V${BAR}H0.5V10.5A10 10 0 0 1 10.5 0.5Z" fill="${C.surface}"/>
<path d="M0.5 ${BAR}H${width - 0.5}" stroke="${C.line}"/>
${dots}
${address}
<g clip-path="url(#map)">
<rect x="${mapX}" y="${mapY}" width="${MAP_W}" height="${mapH}" fill="${C.surface}"/>
<g class="grid">${grid}</g>
${contours}
</g>
<rect x="${mapX + 0.5}" y="${mapY + 0.5}" width="${MAP_W - 1}" height="${mapH - 1}" rx="8" fill="none" stroke="${C.line}"/>
${pin}
<text x="${textX}" y="${yKicker}" class="k">${esc(config.kicker)}</text>
${url}
${routeRows}
${cta}
</svg>
`;
}
