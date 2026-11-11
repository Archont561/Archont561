import { readEnv } from "@/tools/lib/config/env.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

test.prop(
  "GITHUB_TOKEN wins over GH_TOKEN and empty values count as unset",
  (fc) => ({
    github: fc.option(fc.stringMatching(/^[a-z0-9]{0,6}$/), { nil: undefined }),
    gh: fc.option(fc.stringMatching(/^[a-z0-9]{0,6}$/), { nil: undefined }),
  }),
  (_fixtures, { github, gh }) => {
    expect(readEnv({ GITHUB_TOKEN: github, GH_TOKEN: gh }).githubToken).toBe(github || gh || undefined);
  },
);

test.prop(
  "FC_NUM_RUNS accepts positive integers only",
  (fc) => ({ value: fc.oneof(fc.integer({ min: -5, max: 500 }).map(String), fc.string({ maxLength: 4 })) }),
  (_fixtures, { value }) => {
    const parsed = Number(value);
    const expected = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    expect(readEnv({ FC_NUM_RUNS: value }).fcNumRuns).toBe(expected);
  },
);

test("CI is true only for the literal string, and the default source is process.env", ({ env }) => {
  expect(readEnv({ CI: "true" }).ci).toBe(true);
  expect(readEnv({ CI: "1" }).ci).toBe(false);
  env.set("CI", "true");
  env.set("GITHUB_TOKEN", "from-env");
  expect(readEnv()).toMatchObject({ ci: true, githubToken: "from-env" });
});
