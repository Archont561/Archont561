/**
 * Code generation behind `bun run tools clients`. Hand-written HTTP code is limited
 * to the transport (./http.ts); request and response types come from the registries'
 * own descriptions:
 *
 * - Hey API generates fetch clients from OpenAPI for GitHub (pinned spec commit),
 *   crates.io (served spec), and npm, PyPI, NuGet, Maven Central and R-universe (local
 *   subset specs in ./specs/, as none publishes one), keeping only the operations
 *   `capture` calls.
 * - gql.tada introspects prefix.dev, which only offers GraphQL.
 *
 * The output is committed (generated code is reviewed like a lockfile) and excluded
 * from Biome, coverage and the PCC-R07 pairing.
 */
import { run } from "@/tools/lib/run.ts";

export const CLIENTS_DIR = "tools/lib/capture/clients";
export const SPECS_DIR = "tools/lib/capture/specs";

/** GitHub's official description, pinned to a commit of github/rest-api-description. */
export const GITHUB_SPEC =
  "https://raw.githubusercontent.com/github/rest-api-description/cff9ea6e1362fab34771b0af6b95d7fd2caf2813/descriptions/api.github.com/api.github.com.json";
export const CRATES_SPEC = "https://crates.io/api/openapi.json";
export const PREFIX_GRAPHQL = "https://prefix.dev/api/graphql";

export type OpenApiJob = {
  input: string;
  output: { path: string };
  parser?: { filters: { operations: { include: string[] } } };
  plugins: string[];
  logs: { file: false };
};

const PLUGINS = ["@hey-api/client-fetch", "@hey-api/typescript", "@hey-api/sdk"];

function job(name: string, input: string, operations?: string[]): OpenApiJob {
  return {
    input,
    output: { path: `${CLIENTS_DIR}/${name}` },
    ...(operations && { parser: { filters: { operations: { include: operations } } } }),
    plugins: PLUGINS,
    logs: { file: false },
  };
}

/** One Hey API job per REST registry, filtered to the operations `capture` uses. */
export function openApiJobs(root: string): OpenApiJob[] {
  return [
    job("github", GITHUB_SPEC, ["GET /users/{username}/repos", "GET /repos/{owner}/{repo}/contents/{path}"]),
    job("crates", CRATES_SPEC, ["GET /api/v1/users/{user}", "GET /api/v1/crates"]),
    job("npm", `${root}/${SPECS_DIR}/npm.yaml`),
    job("pypi", `${root}/${SPECS_DIR}/pypi.yaml`),
    job("nuget", `${root}/${SPECS_DIR}/nuget.yaml`),
    job("maven", `${root}/${SPECS_DIR}/maven.yaml`),
    job("runiverse", `${root}/${SPECS_DIR}/runiverse.yaml`),
  ];
}

/** gql.tada: introspect the schema, then emit the typed introspection the TS plugin reads. */
export const graphqlPlan = (): string[][] => [
  ["gql.tada", "generate-schema", PREFIX_GRAPHQL, "--output", `${CLIENTS_DIR}/prefix/schema.graphql`],
  ["gql.tada", "generate-output"],
];

export type Generator = (jobs: OpenApiJob[]) => Promise<unknown>;

/** Hey API is heavy (it embeds the TypeScript compiler), so it loads only when generating. */
export const heyApi: Generator = async (jobs) => {
  const { createClient } = await import("@hey-api/openapi-ts");
  return createClient(jobs as Parameters<typeof createClient>[0]);
};

export async function generateClients(root: string, generate: Generator = heyApi): Promise<void> {
  await generate(openApiJobs(root));
  for (const command of graphqlPlan()) await run(command, { cwd: root });
}
