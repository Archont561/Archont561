import { ROOT } from "@/tools/lib/paths.ts";
import { healthTokens } from "@/tools/lib/render/health.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

test("healthTokens reads the facts from the files that enforce them", async () => {
  const pkgJson = await Bun.file(`${ROOT}/package.json`).json();
  const pin = (await Bun.file(`${ROOT}/vendor/clean-code-presets/UPSTREAM.pin`).text()).trim();
  expect(await healthTokens(ROOT)).toEqual({
    bun: pkgJson.packageManager.replace("bun@", ""),
    coverage: "90",
    pcc: pin,
  });
});
