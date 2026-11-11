import { existsSync } from "node:fs";
import {
  BADGE_DIR,
  CARD_DIR,
  GENERATED_DIRS,
  orphans,
  staleOutputs,
  writeOutputs,
} from "@/tools/lib/render/outputs.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

const svgName = (fc: typeof import("fast-check").default) => fc.stringMatching(/^[a-z][a-z-]{0,10}$/);

test.scenario
  .prop("writeOutputs makes the tree match the outputs and removes orphan badges", (fc) => ({
    kept: fc.uniqueArray(svgName(fc), { maxLength: 4 }),
    orphaned: fc.uniqueArray(
      svgName(fc).map((name) => `old-${name}`),
      { maxLength: 3 },
    ),
    body: fc.string({ maxLength: 20 }),
  }))
  .given("a tree with stale files and orphan badges", async ({ tmpdir, kept, orphaned, body }) => {
    const outputs = new Map<string, string>([["README.md", `# ${body}\n`]]);
    for (const name of kept) outputs.set(`${BADGE_DIR}/${name}.svg`, `<svg>${name}</svg>`);
    for (const name of orphaned) tmpdir.write(`${BADGE_DIR}/${name}.svg`, "<svg/>");
    tmpdir.write(`${BADGE_DIR}/notes.txt`, "not a badge");
    return { dir: tmpdir.dir as string, outputs };
  })
  .when("the outputs are written", async ({ dir, outputs }) => ({
    staleBefore: await staleOutputs(dir, outputs),
    result: await writeOutputs(dir, outputs),
  }))
  .then(
    "orphans are gone, everything is current, and other files survive",
    async ({ dir, outputs, orphaned, staleBefore, result, expect }) => {
      const orphanPaths = orphaned.map((name) => `${BADGE_DIR}/${name}.svg`).sort();
      expect(staleBefore).toEqual([...orphanPaths, ...outputs.keys()]);
      expect(result).toEqual({ written: outputs.size, removed: orphanPaths });
      for (const path of orphanPaths) expect(existsSync(`${dir}/${path}`)).toBe(false);
      expect(existsSync(`${dir}/${BADGE_DIR}/notes.txt`)).toBe(true);
      expect(await staleOutputs(dir, outputs)).toEqual([]);
    },
  );

test("orphans is empty without the generated directories", async ({ tmpdir }) => {
  expect(await orphans(tmpdir.dir, new Map())).toEqual([]);
});

test("orphan cards count as stale like orphan badges, sorted across both directories", async ({ tmpdir }) => {
  expect(GENERATED_DIRS).toEqual([BADGE_DIR, CARD_DIR]);
  tmpdir.write(`${CARD_DIR}/retired.svg`, "<svg/>");
  tmpdir.write(`${CARD_DIR}/kept.svg`, "<svg/>");
  tmpdir.write(`${BADGE_DIR}/old.svg`, "<svg/>");
  const outputs = new Map([[`${CARD_DIR}/kept.svg`, "<svg/>"]]);
  expect(await orphans(tmpdir.dir, outputs)).toEqual([`${BADGE_DIR}/old.svg`, `${CARD_DIR}/retired.svg`]);
});
