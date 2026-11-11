import { reposListForUser } from "@/tools/lib/capture/clients/github/index.ts";
import { BASE_URLS, createClients, GraphQLError, graphql } from "@/tools/lib/capture/clients.ts";
import { createFetch } from "@/tools/lib/capture/http.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

const Probe = graphql(`query Probe($channel: String!) { channel(name: $channel) { name } }`);

test.prop(
  "the GitHub client authenticates exactly when a token is configured",
  (fc) => ({ githubToken: fc.option(fc.stringMatching(/^gh[a-z0-9]{4,10}$/), { nil: undefined }) }),
  async ({ httpMock }, { githubToken }) => {
    const auth: (string | null)[] = [];
    httpMock.get(/api\.github\.com/, (request: Request) => {
      auth.push(request.headers.get("Authorization"));
      return Response.json([]);
    });
    const clients = createClients({ fetch: createFetch({ retries: 1 }), githubToken });
    await reposListForUser({ client: clients.github, path: { username: "x" }, throwOnError: true });
    expect(auth).toEqual([githubToken ? `Bearer ${githubToken}` : null]);
  },
  { numRuns: 10 },
);

test("prefix posts the printed document with its variables", async ({ httpMock }) => {
  let sent: { query: string; variables: unknown } | undefined;
  httpMock.post(BASE_URLS.prefix, async (request: Request) => {
    sent = await request.json();
    return Response.json({ data: { channel: { name: "archont561" } } });
  });
  const clients = createClients({ fetch: createFetch({ retries: 1 }) });
  expect(await clients.prefix(Probe, { channel: "archont561/archont561" })).toEqual({
    channel: { name: "archont561" },
  });
  expect(sent?.query).toContain("query Probe($channel: String!)");
  expect(sent?.variables).toEqual({ channel: "archont561/archont561" });
});

test("prefix raises GraphQL errors", async ({ httpMock }) => {
  httpMock.post(BASE_URLS.prefix, () => Response.json({ errors: [{ message: "no such channel" }] }));
  const clients = createClients({ fetch: createFetch({ retries: 1 }) });
  const error = await clients.prefix(Probe, { channel: "x/y" }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(GraphQLError);
  expect((error as Error).message).toContain("no such channel");
});
