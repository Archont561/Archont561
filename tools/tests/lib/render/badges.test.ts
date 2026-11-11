import { fill, renderBadge, TERRAIN } from "@/tools/lib/render/badges.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const spec = {
  id: "probe",
  label: "label",
  message: "message",
  color: TERRAIN.moss,
  url: "https://x.test",
  alt: "Probe",
};

describe("renderBadge", () => {
  test("renders an SVG under assets/badges with the terrain label colour", () => {
    const badge = renderBadge(spec);
    expect(badge.src).toBe("assets/badges/probe.svg");
    expect(badge.svg.startsWith("<svg")).toBe(true);
    expect(badge.svg.endsWith("\n")).toBe(true);
    expect(badge.svg).toContain(TERRAIN.label);
    expect(badge.svg).toContain("LABEL");
    expect(badge.svg).not.toContain("data:image/svg+xml");
  });

  test("embeds a simple-icons logo and honours the style", () => {
    const badge = renderBadge({ ...spec, logo: "bun", style: "flat-square" });
    expect(badge.svg).toContain("data:image/svg+xml;base64,");
    expect(badge.svg).toContain(">label<");
  });

  test("rejects unknown logos", () => {
    expect(() => renderBadge({ ...spec, logo: "nosuchlogo" })).toThrow(
      'simple-icons has no siNosuchlogo (badge logo "nosuchlogo")',
    );
  });
});

describe("fill", () => {
  test.prop(
    "replaces every known token and leaves other text alone",
    (fc) => ({
      tokens: fc.dictionary(
        fc.stringMatching(/^[a-z]{1,8}$/),
        fc.oneof(fc.nat(), fc.stringMatching(/^[a-z0-9 ]{0,8}$/)),
        {
          minKeys: 1,
        },
      ),
      prose: fc.stringMatching(/^[a-z .,]{0,12}$/),
    }),
    (_fixtures, { tokens, prose }) => {
      const keys = Object.keys(tokens);
      const template = keys.map((key) => `${prose}{${key}}`).join("|");
      expect(fill(template, tokens)).toBe(keys.map((key) => `${prose}${tokens[key]}`).join("|"));
    },
  );

  test("rejects unknown tokens", () => {
    expect(fill("plain", {})).toBe("plain");
    expect(() => fill("{missing}", {})).toThrow("unknown badge token {missing}");
  });
});
