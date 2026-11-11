import {
  CARD,
  cardPath,
  LOOP,
  layoutChips,
  PRINCIPLES,
  projectCard,
  shownFrom,
  spotlightKeyframes,
  terminalCard,
  typingKeyframes,
  wrap,
} from "@/tools/lib/render/cards.ts";
import { CARD_DIR } from "@/tools/lib/render/outputs.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const card = {
  name: "geo-tools",
  path: "geo-tools",
  description: 'Tools for <maps> & "rasters".',
  kind: "geospatial",
  stack: ["Python"],
  ships: ["PyPI", "Conda"],
  cta: "docs",
  index: 1,
  count: 3,
};

const terminal = {
  command: "./principles --show",
  lines: [
    { key: "lock", rule: "reproducible", detail: "lockfiles" },
    { key: "enforce", rule: "machine-checked", detail: "linters" },
  ],
  footer: "Lock it, ship it.",
  width: 728,
};

test("cards live under assets/cards", () => {
  expect(cardPath("geo-tools")).toBe(`${CARD_DIR}/geo-tools.svg`);
  expect(PRINCIPLES).toBe(`${CARD_DIR}/principles.svg`);
});

describe("wrap", () => {
  test.prop(
    "never exceeds the width or the line budget, and keeps every word when it fits",
    (fc) => ({
      words: fc.array(fc.stringMatching(/^[a-z]{1,12}$/), { maxLength: 20 }),
      width: fc.integer({ min: 12, max: 40 }),
      maxLines: fc.integer({ min: 1, max: 4 }),
    }),
    (_fixtures, { words, width, maxLines }) => {
      const lines = wrap(words.join(" "), width, maxLines);
      expect(lines.length).toBeLessThanOrEqual(maxLines);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
      if (!lines.at(-1)?.endsWith("…")) expect(lines.join(" ")).toBe(words.join(" "));
    },
  );

  test("marks cut text with an ellipsis", () => {
    expect(wrap("one two three four", 9, 1)).toEqual(["one two…"]);
  });
});

describe("layoutChips", () => {
  test.prop(
    "lays chips in order without gaps or overlap, stops before the limit, and marks registries as shipped",
    (fc) => ({
      stack: fc.array(fc.stringMatching(/^[A-Za-z]{1,10}$/), { maxLength: 3 }),
      ships: fc.array(fc.stringMatching(/^[A-Za-z]{1,10}$/), { maxLength: 4 }),
      limit: fc.integer({ min: 30, max: 400 }),
    }),
    (_fixtures, { stack, ships, limit }) => {
      const chips = layoutChips(stack, ships, 20, limit);
      expect(chips.map((chip) => chip.label)).toEqual([...stack, ...ships].slice(0, chips.length));
      chips.forEach((chip, i) => {
        expect(chip.x + chip.width).toBeLessThanOrEqual(limit);
        expect(chip.shipped).toBe(i >= stack.length);
        if (i > 0) expect(chip.x).toBeCloseTo((chips[i - 1]?.x ?? 0) + (chips[i - 1]?.width ?? 0) + 6);
      });
    },
  );
});

describe("spotlightKeyframes", () => {
  test.prop(
    "gives every card one slot of a shared cycle, so exactly one card is lit at a time",
    (fc) => ({ count: fc.integer({ min: 1, max: 9 }), index: fc.nat({ max: 8 }) }),
    (_fixtures, { count, index }) => {
      const spot = spotlightKeyframes(index % count, count);
      expect(spot.cycle).toBe(CARD.slot * count);
      expect(spot.delay).toBe((index % count) * CARD.slot);
      expect(spot.frames).toStartWith("0%{opacity:0}");
      expect(spot.frames).toContain("opacity:.75");
      expect(spot.frames).not.toContain("opacity:1");
      expect(Number(spot.sweep)).toBeCloseTo(100 / count, 1);
    },
  );
});

describe("projectCard", () => {
  const svg = projectCard(card);

  test("is an accessible SVG of the card size whose description names stack and registries", () => {
    expect(svg).toStartWith(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}"`,
    );
    expect(svg).toContain('<title id="t">geo-tools (docs)</title>');
    expect(svg).toContain("Stack: Python. Ships to PyPI, Conda.</desc>");
  });

  test("escapes text and draws the kind, chips and call to action", () => {
    expect(svg).toContain("Tools for &lt;maps&gt; &amp; &quot;rasters&quot;.");
    expect(svg).not.toContain("<maps>");
    expect(svg).toContain(">GEOSPATIAL</text>");
    for (const chip of ["Python", "PyPI", "Conda"]) expect(svg).toContain(`>${chip}</text>`);
    expect(svg).toContain('docs <tspan fill="#B9794D">→</tspan>');
  });

  test("tours with the spotlight and goes still for reduced motion", () => {
    expect(svg).toContain(`animation:spot ${CARD.slot * 3}s ease-in-out ${CARD.slot}s infinite`);
    expect(svg).toContain("@media (prefers-reduced-motion:reduce){*{animation:none!important}");
  });

  test("omits empty stack and registry clauses", () => {
    expect(projectCard({ ...card, stack: [], ships: [] })).toContain("rasters&quot;.</desc>");
  });
});

describe("terminal", () => {
  test("shownFrom fades in at its start and out at the clear", () => {
    expect(shownFrom("x", 0)).toBe(
      `@keyframes x{0%,0%{opacity:0}1.56%,${(100 * LOOP.hold) / LOOP.cycle}%{opacity:1}${(100 * LOOP.clear) / LOOP.cycle}%,100%{opacity:0}}`,
    );
  });

  test.prop(
    "typingKeyframes steps one character at a time to the full width, then resets",
    (fc) => ({ chars: fc.integer({ min: 1, max: 40 }), width: fc.integer({ min: 10, max: 500 }) }),
    (_fixtures, { chars, width }) => {
      const frames = typingKeyframes(chars, width);
      expect(frames.match(/translateX\(/g)?.length).toBe(chars + 3);
      expect(frames).toContain(`{transform:translateX(${width}px)}`);
      expect(frames).toEndWith("{transform:translateX(0)}}");
    },
  );

  test("terminalCard types the command, aligns the keys, and grows one row per line", () => {
    const svg = terminalCard(terminal);
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="728" height="170"');
    expect(svg).toContain('<title id="t">$ ./principles --show</title>');
    expect(svg).toContain(
      "lock: reproducible (lockfiles); enforce: machine-checked (linters). Lock it, ship it.",
    );
    expect(svg).toContain(">lock     </tspan>");
    expect(svg).toContain(">enforce  </tspan>");
    expect(svg).toContain("@keyframes l1{");
    expect(terminalCard({ ...terminal, lines: [...terminal.lines, terminal.lines[0] as never] })).toContain(
      'height="192"',
    );
  });
});
