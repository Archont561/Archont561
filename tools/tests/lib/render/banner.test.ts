import { siZsh } from "simple-icons";
import { ROOT } from "@/tools/lib/paths.ts";
import { renderBanner } from "@/tools/lib/render/banner.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const profile = await Bun.file(`${ROOT}/data/profile.json`).json();
const config = { ...profile.banner, tagline: profile.tagline };
const svg = renderBanner(config);

describe("renderBanner", () => {
  test("is an accessible SVG titled from the config", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('<title id="title">Archont561</title>');
    expect(svg).toContain(`class="h">${config.title}</text>`);
    expect(svg).toContain('role="img"');
  });

  test("renders the Zsh logo and label in the header bar", () => {
    expect(svg).toContain(siZsh.path);
    expect(svg).toContain(">zsh</text>");
  });

  test("renders the embedded portal content when configured", () => {
    const bannerWithPortal = renderBanner({
      ...config,
      portal: {
        url: "https://example.org/",
        label: "example.org",
        kicker: "START HERE",
        cta: "enter →",
        routes: [{ path: "/docs/", text: "notes" }],
      },
    });
    expect(bannerWithPortal).toContain("START HERE");
    expect(bannerWithPortal).toContain("example.org");
    expect(bannerWithPortal).toContain("/docs/");
    expect(bannerWithPortal).toContain("enter →");
    expect(bannerWithPortal).toContain("~ ❯");
    expect(bannerWithPortal).toContain('attributeName="stroke-dashoffset"');
    expect(bannerWithPortal).toContain('attributeName="r"');
    expect(bannerWithPortal).not.toContain('repeatCount="indefinite"');
  });

  test("draws block glyphs as vector cells, not text", () => {
    expect(svg).toContain("<rect");
    expect(svg).toContain("<path");
    expect(svg).not.toContain("█");
  });

  test("animates with SMIL and switches it off for reduced motion", () => {
    expect(svg).toContain("<animate");
    expect(svg).toContain("prefers-reduced-motion");
  });

  test.prop(
    "escapes any tagline text",
    (fc) => ({ line: fc.string({ maxLength: 30 }) }),
    (_fixtures, { line }) => {
      const out = renderBanner({ ...config, tagline: [`<${line}&"`] });
      expect(out).toContain("&lt;");
      expect(out).toContain("&amp;");
      expect(out).not.toContain(`<${line}&"`);
    },
    { numRuns: 15 },
  );

  test("is deterministic", () => {
    expect(renderBanner(config)).toBe(svg);
  });

  test("traces double-line box glyphs as shadow strokes", () => {
    const art = renderBanner({ ...config, font: "ANSI Shadow", text: "BOX" });
    expect(art).toContain('<path class="sh" d="M');
  });
});
