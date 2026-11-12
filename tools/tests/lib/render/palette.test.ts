import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "@/tools/lib/paths.ts";
import { brandExtras, palette, parseCssTokens } from "@/tools/lib/render/palette.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const CSS_FIXTURE = `
:root {
  --palette-day-background: #f8f9f6;
  --palette-day-text: #202d27;
  --palette-day-primary: #355b42;
  --palette-day-on-primary: #ffffff;
  --palette-day-secondary: #526f4f;

  --palette-night-background: #131d18;
  --palette-night-text: #e4ece5;
  --palette-night-muted: #a5b4a9;
  --palette-night-border: #34453a;
  --palette-night-primary: #a2c7ab;
  --palette-night-secondary: #bfd4b8;
  --palette-night-code-background: #1d2921;

  --color-background: var(--palette-night-background);
  --paper: var(--color-background);
}
`;

describe("palette", () => {
  test("parses palette and semantic vars from CSS tokens fixture", () => {
    const parsed = parseCssTokens(CSS_FIXTURE);
    expect(parsed.paper).toBe("#131d18");
    expect(parsed.surface).toBe("#1d2921");
    expect(parsed.line).toBe("#34453a");
    expect(parsed.ink).toBe("#e4ece5");
    expect(parsed.muted).toBe("#a5b4a9");
    expect(parsed.green).toBe("#a2c7ab");
    expect(parsed.sage).toBe("#bfd4b8");
    expect(parsed.white).toBe("#fff");
    expect(parsed.day.primary).toBe("#355b42");
    expect(parsed.day.paper).toBe("#f8f9f6");
    expect(parsed.day.surface).toBe("#edf0e7");
    expect(parsed.day.green).toBe("#355b42");
    expect(parsed.day.sage).toBe("#526f4f");
    expect(parsed.day.ink).toBe("#202d27");
    expect(parsed.day.white).toBe("#fff");
    expect(parsed.night.secondary).toBe("#bfd4b8");
    expect(parsed.night.paper).toBe("#131d18");
    expect(parsed.night.green).toBe("#a2c7ab");
    expect(parsed.night.sage).toBe("#bfd4b8");
  });

  test("resolves fallback when input CSS is empty", () => {
    const parsed = parseCssTokens("");
    expect(parsed.paper).toBe("#131d18");
    expect(parsed.surface).toBe("#1d2921");
    expect(parsed.sage).toBe("#bfd4b8");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.day)).toBe(true);
    expect(Object.isFrozen(parsed.night)).toBe(true);
  });

  test("parses semantic vars when night theme tokens are absent", () => {
    const parsed = parseCssTokens(`
      --paper: #111111;
      --code-bg: #222222;
      --line: #333333;
      --ink: #444444;
      --muted: #555555;
      --green: #666666;
      --atlas-accent: #777777;
    `);
    expect(parsed.paper).toBe("#111111");
    expect(parsed.surface).toBe("#222222");
    expect(parsed.line).toBe("#333333");
    expect(parsed.ink).toBe("#444444");
    expect(parsed.muted).toBe("#555555");
    expect(parsed.green).toBe("#666666");
    expect(parsed.sage).toBe("#777777");
  });

  test("exports frozen palette and brandExtras with expected intentional values", () => {
    expect(Object.isFrozen(palette)).toBe(true);
    expect(Object.isFrozen(brandExtras)).toBe(true);
    expect(palette.sage).toBe("#bfd4b8");
    expect(brandExtras.sageVariant).toBe("#8FA17D");
    expect(brandExtras.forest).toBe("#3d6b4f");
    expect(brandExtras.copper).toBe("#B9794D");
    expect(brandExtras.moss).toBe("#648b63");
    expect(brandExtras.white).toBe("#ffffff");
  });

  test("asserts no 6-digit hex literal remains in tools/lib/render outside palette.ts", async () => {
    const renderDir = join(ROOT, "tools/lib/render");
    const files = await readdir(renderDir);
    const hexPattern = /#[0-9a-fA-F]{6}\b/g;

    for (const file of files) {
      if (!file.endsWith(".ts") || file === "palette.ts") continue;
      const content = await Bun.file(join(renderDir, file)).text();
      const matches = content.match(hexPattern);
      expect(matches).toBeNull();
    }
  });
});
