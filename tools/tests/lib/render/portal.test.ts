import { ROOT } from "@/tools/lib/paths.ts";
import { contour, contourColor, portalRoutes, renderPortal, svgWidth } from "@/tools/lib/render/portal.ts";
import { buildOutputs } from "@/tools/lib/render/profile.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const config = {
  url: "https://example.org/",
  label: "example.org",
  kicker: "START HERE",
  cta: "enter →",
  width: 728,
  routes: [
    { path: "/docs/", text: "notes" },
    { path: "/packages/", text: "3 released" },
  ],
};

describe("renderPortal", () => {
  test("is an accessible SVG whose title and description name the portfolio and its routes", () => {
    const svg = renderPortal(config);
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="728"');
    expect(svg).toContain('<title id="ptitle">enter → https://example.org/</title>');
    expect(svg).toContain("START HERE example.org: /docs/ notes; /packages/ 3 released");
  });

  test("types the URL with SMIL, loops with CSS, and turns motion off for reduced motion", () => {
    const svg = renderPortal(config);
    expect(svg).toContain('calcMode="discrete"');
    expect(svg).toContain("@keyframes flow");
    expect(svg).toContain("@media (prefers-reduced-motion:reduce)");
    expect(svg.match(/class="flow( rev)?"/g)).toHaveLength(7);
    expect(svg.match(/<animateTransform /g)).toHaveLength(config.routes.length);
  });

  test.prop(
    "escapes any text and grows one row per route",
    (fc) => ({
      routes: fc.array(
        fc.record({ path: fc.stringMatching(/^\/[a-z<&>"]{1,10}$/), text: fc.string({ maxLength: 30 }) }),
        { minLength: 1, maxLength: 8 },
      ),
    }),
    (_fixtures, { routes }) => {
      const svg = renderPortal({ ...config, routes });
      const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1] as string);
      for (const text of texts) expect(text).not.toMatch(/[<>]|&(?!amp;|lt;|gt;|quot;)/);
      expect(svg.match(/class="r"/g)).toHaveLength(routes.length);
      expect(Number(svg.match(/height="(\d+)"/)?.[1])).toBe(
        Math.ceil(34 + 12 + 22 + 34 + 30 + (routes.length - 1) * 22 + 22),
      );
    },
  );

  test("is deterministic", () => {
    expect(renderPortal(config)).toBe(renderPortal(config));
  });
});

test.prop(
  "contours are closed rings that widen with each level",
  (fc) => ({ level: fc.integer({ min: 0, max: 10 }) }),
  (_fixtures, { level }) => {
    const ring = contour(0, 0, level, 48);
    expect(ring).toMatch(/^M.*Z$/);
    expect(ring.split("L")).toHaveLength(48);
    const xs = (path: string) =>
      path
        .slice(1, -1)
        .split("L")
        .map((point) => Math.abs(Number(point.split(" ")[0])));
    expect(Math.max(...xs(contour(0, 0, level + 1, 48)))).toBeGreaterThan(Math.max(...xs(ring)));
  },
);

test("portalRoutes fills snapshot tokens and rejects unknown ones", () => {
  expect(
    portalRoutes([{ path: "/p/", text: "{packages} across {registries}" }], { packages: 3, registries: 2 }),
  ).toEqual([{ path: "/p/", text: "3 across 2" }]);
  expect(() => portalRoutes([{ path: "/p/", text: "{nope}" }], {})).toThrow("unknown badge token {nope}");
});

test("svgWidth reads the root width and refuses an SVG without one", () => {
  expect(svgWidth('<svg xmlns="x" width="728" height="3">')).toBe(728);
  expect(() => svgWidth("<svg viewBox='0 0 1 1'>")).toThrow(RangeError);
});

test("the banner includes the portal content and is linked from the README", async () => {
  const outputs = await buildOutputs(ROOT);
  const banner = outputs.get("assets/banner.svg") as string;
  expect(banner).toContain("archont561.github.io");
  expect(banner).toContain("/docs/");
  expect(outputs.get("README.md")).toContain("](assets/banner.svg)](https://archont561.github.io/)");
});

test("contour colours step from the copper summit through sage slopes to forest lowlands", () => {
  expect([0, 1, 2, 3, 6].map(contourColor)).toEqual(["#B9794D", "#8FA17D", "#8FA17D", "#3d6b4f", "#3d6b4f"]);
});
