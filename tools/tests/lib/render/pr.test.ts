import { ROOT } from "@/tools/lib/paths.ts";
import {
  commitTypes,
  PR_TEMPLATE,
  RENDERED,
  renderPrTemplate,
  SUMMARY_PLACEHOLDER,
} from "@/tools/lib/render/pr.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

test("the committed pull request template matches templates/pr.ejs", async () => {
  const rendered = await renderPrTemplate(ROOT);
  expect(rendered).toBe(await Bun.file(`${ROOT}/${PR_TEMPLATE}`).text());
  expect(rendered.split("\n")[0]).toBe(
    "<!-- Generated from templates/pr.ejs by `bun run tools readme`. Do not edit by hand. -->",
  );
  expect(rendered).toContain(SUMMARY_PLACEHOLDER);
  for (const path of RENDERED) expect(rendered).toContain(`\`${path}\``);
});

test.prop(
  "the checklist names exactly the commitlint types and the codecov floor",
  (fc) => ({
    types: fc.uniqueArray(fc.stringMatching(/^[a-z]{2,8}$/), { minLength: 1, maxLength: 6 }),
    coverage: fc.integer({ min: 50, max: 100 }),
  }),
  async ({ repo }, { types, coverage }) => {
    const config = await Bun.file(`${repo}/.commitlintrc.json`).json();
    config.rules["type-enum"][2] = types;
    await Bun.write(`${repo}/.commitlintrc.json`, JSON.stringify(config));
    const codecov = await Bun.file(`${repo}/codecov.yml`).text();
    await Bun.write(`${repo}/codecov.yml`, codecov.replace(/target: \S+/, `target: ${coverage}%`));

    expect(await commitTypes(repo)).toEqual(types);
    const rendered = await renderPrTemplate(repo);
    expect(rendered).toContain(`type one of ${types.map((type) => `\`${type}\``).join(", ")});`);
    expect(rendered).toContain(`at least ${coverage}% coverage`);
  },
);
