/**
 * Typed configuration read from the environment at the boundary (PCC-S06).
 * Library code receives an `Env` object and never touches `process.env` itself.
 */
export type Env = {
  /** Raises the GitHub API rate limit; optional for public data. */
  githubToken?: string;
  /** True on CI runners, where git identity for bot commits is configured. */
  ci: boolean;
  /** fast-check examples per property scenario in the test suite. */
  fcNumRuns?: number;
};

const positiveInt = (value: string | undefined): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return {
    githubToken: source.GITHUB_TOKEN || source.GH_TOKEN || undefined,
    ci: source.CI === "true",
    fcNumRuns: positiveInt(source.FC_NUM_RUNS),
  };
}
