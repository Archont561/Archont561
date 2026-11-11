/**
 * Facts the health badges advertise, read from the files that enforce them. Shared by the
 * profile README and the pull request template, so it lives apart from both renderers.
 */

/** Values substituted for `{token}` placeholders in badges and route texts. */
export type Tokens = Record<string, string | number>;

/** Read the facts the health badges advertise from the files that enforce them. */
export async function healthTokens(root: string): Promise<Tokens> {
  const pkg = await Bun.file(`${root}/package.json`).json();
  const codecov = Bun.YAML.parse(await Bun.file(`${root}/codecov.yml`).text()) as {
    coverage: { status: { project: { default: { target: string } } } };
  };
  const pin = (await Bun.file(`${root}/vendor/clean-code-presets/UPSTREAM.pin`).text()).trim();
  return {
    bun: String(pkg.packageManager).replace(/^bun@/, ""),
    coverage: codecov.coverage.status.project.default.target.replace("%", ""),
    pcc: pin,
  };
}
