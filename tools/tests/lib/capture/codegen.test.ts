import {
  CLIENTS_DIR,
  CRATES_SPEC,
  GITHUB_SPEC,
  generateClients,
  graphqlPlan,
  type OpenApiJob,
  openApiJobs,
  PREFIX_GRAPHQL,
} from "@/tools/lib/capture/codegen.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

test("openApiJobs pin GitHub, read crates.io's spec, and use local specs for the rest", () => {
  const jobs = openApiJobs("/repo");
  expect(jobs.map((job) => [job.input, job.output.path])).toEqual([
    [GITHUB_SPEC, `${CLIENTS_DIR}/github`],
    [CRATES_SPEC, `${CLIENTS_DIR}/crates`],
    ["/repo/tools/lib/capture/specs/npm.yaml", `${CLIENTS_DIR}/npm`],
    ["/repo/tools/lib/capture/specs/pypi.yaml", `${CLIENTS_DIR}/pypi`],
    ["/repo/tools/lib/capture/specs/nuget.yaml", `${CLIENTS_DIR}/nuget`],
    ["/repo/tools/lib/capture/specs/maven.yaml", `${CLIENTS_DIR}/maven`],
    ["/repo/tools/lib/capture/specs/runiverse.yaml", `${CLIENTS_DIR}/runiverse`],
  ]);
  expect(GITHUB_SPEC).toMatch(/\/[0-9a-f]{40}\//);
  expect(jobs[0]?.parser?.filters.operations.include).toEqual([
    "GET /users/{username}/repos",
    "GET /repos/{owner}/{repo}/contents/{path}",
  ]);
  expect(jobs[2]?.parser).toBeUndefined();
  for (const job of jobs) expect(job.plugins).toContain("@hey-api/sdk");
});

test("graphqlPlan introspects prefix.dev, then emits the typed introspection", () => {
  expect(graphqlPlan()).toEqual([
    ["gql.tada", "generate-schema", PREFIX_GRAPHQL, "--output", `${CLIENTS_DIR}/prefix/schema.graphql`],
    ["gql.tada", "generate-output"],
  ]);
});

test("generateClients runs the generator, then gql.tada in the root", async ({ proc, logs }) => {
  const seen: OpenApiJob[][] = [];
  await generateClients("/repo", async (jobs) => seen.push(jobs));
  expect(seen).toEqual([openApiJobs("/repo")]);
  expect(
    proc.exec.mock.calls.map(([command, options]: [string[], { cwd: string }]) => [command[1], options.cwd]),
  ).toEqual([
    ["generate-schema", "/repo"],
    ["generate-output", "/repo"],
  ]);
  expect(logs.out).toHaveLength(2);
});
