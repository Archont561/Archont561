import { spyOn } from "bun:test";
import { createFetch, HttpError, isTransient, sleep, USER_AGENT } from "@/tools/lib/capture/http.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

const URL_ = "https://registry.test/pkg";

test.scenario
  .prop("createFetch retries transient failures and stops on the first answer or permanent error", (fc) => ({
    statuses: fc.array(fc.constantFrom(200, 404, 410, 429, 500, 503), { minLength: 1, maxLength: 5 }),
    retries: fc.integer({ min: 1, max: 4 }),
  }))
  .given("an upstream answering with a sequence of statuses", ({ statuses, retries }) => {
    const seen: Request[] = [];
    const waits: number[] = [];
    const send = createFetch({
      retries,
      delay: async (ms) => {
        waits.push(ms);
      },
      fetcher: async (request) => {
        seen.push(request);
        const status = statuses[seen.length - 1] ?? 200;
        return new Response(status === 200 ? "ok" : "nope", { status });
      },
    });
    return { send, seen, waits };
  })
  .when("one POST request is sent", async ({ send }) => ({
    outcome: await send(URL_, { method: "POST", body: "payload" }).then(
      (response) => response.status,
      (caught: unknown) => caught,
    ),
  }))
  .then(
    "attempts, backoff and outcome follow the retry policy",
    async ({ statuses, retries, seen, waits, outcome, expect }) => {
      // The upstream answers 200 once its scripted statuses run out.
      const statusAt = (attempt: number) => statuses[attempt - 1] ?? 200;
      let attempts = 1;
      while (attempts < retries && (statusAt(attempts) === 429 || statusAt(attempts) >= 500)) attempts++;
      const last = statuses[attempts - 1] ?? 200;
      expect(seen).toHaveLength(attempts);
      expect(waits).toEqual(Array.from({ length: attempts - 1 }, (_, index) => 1000 * (index + 1)));
      for (const request of seen) expect(await request.text()).toBe("payload");
      if (last === 200) expect(outcome).toBe(200);
      else
        expect(outcome).toMatchObject({
          name: "HttpError",
          status: last,
          url: URL_,
          message: `HTTP ${last} from ${URL_}: nope`,
        });
    },
  );

test("isTransient treats network errors, 429 and 5xx as retryable", () => {
  expect(isTransient(new TypeError("socket hang up"))).toBe(true);
  expect(isTransient(new HttpError(URL_, 429, ""))).toBe(true);
  expect(isTransient(new HttpError(URL_, 502, ""))).toBe(true);
  expect(isTransient(new HttpError(URL_, 404, ""))).toBe(false);
});

test("sends the project User-Agent unless the caller set one, through the global fetch", async ({
  networkGuard,
  httpMock,
}) => {
  const agents: (string | null)[] = [];
  httpMock.get(URL_, (request: Request) => {
    agents.push(request.headers.get("User-Agent"));
    return new Response("ok");
  });
  const send = createFetch();
  await send(URL_);
  await send(URL_, { headers: { "User-Agent": "custom" } });
  expect(agents).toEqual([USER_AGENT, "custom"]);
  expect(networkGuard.calls()).toEqual([]);
  expect(typeof send.preconnect).toBe("function");
});

test("sleep waits, and preconnect delegates to whichever global fetch is current", async () => {
  const started = performance.now();
  await sleep(5);
  expect(performance.now() - started).toBeGreaterThanOrEqual(4);
  const preconnect = spyOn(fetch, "preconnect").mockImplementation(() => {});
  createFetch().preconnect("https://registry.test");
  expect(preconnect).toHaveBeenCalledWith("https://registry.test");
  preconnect.mockRestore();
});
