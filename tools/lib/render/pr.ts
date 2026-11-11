/**
 * .github/PULL_REQUEST_TEMPLATE.md, rendered from templates/pr.ejs. The commit types come
 * from .commitlintrc.json and the coverage floor from codecov.yml, so the checklist cannot
 * drift from the gates that enforce it. `bun run tools pr` fills the rendered template.
 */
import ejs from "ejs";
import { healthTokens } from "@/tools/lib/render/health.ts";

export const PR_TEMPLATE = ".github/PULL_REQUEST_TEMPLATE.md";
/** The line `bun run tools pr --summary` replaces; the template must keep it verbatim. */
export const SUMMARY_PLACEHOLDER = "<!-- summary: one paragraph on what changed and why. -->";
/** Files the readme command renders, named in the checklist. */
export const RENDERED = ["README.md", "docs/README.md", PR_TEMPLATE, "assets/"];

export async function commitTypes(root: string): Promise<string[]> {
  const config = await Bun.file(`${root}/.commitlintrc.json`).json();
  return config.rules["type-enum"][2];
}

export async function renderPrTemplate(root: string): Promise<string> {
  return ejs.renderFile(
    `${root}/templates/pr.ejs`,
    {
      types: await commitTypes(root),
      coverage: (await healthTokens(root)).coverage,
      rendered: RENDERED,
      summary: SUMMARY_PLACEHOLDER,
    },
    { async: false },
  );
}
