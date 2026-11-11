/**
 * The transport under every generated client: a `fetch` that retries transient
 * failures and turns non-2xx responses into one `HttpError`. The underlying fetcher
 * defaults to the global `fetch`, looked up per call, so test fixtures that patch it
 * (bun-test-utils `httpMock`) intercept every registry request.
 */
export type Fetcher = (request: Request) => Promise<Response>;

export type HttpOptions = {
  fetcher?: Fetcher;
  retries?: number;
  delay?: (ms: number) => Promise<void>;
};

export const USER_AGENT = "archont561-profile-readme (+https://archont561.github.io/)";

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    detail: string,
  ) {
    // A scheduled run has no terminal, so the failing endpoint travels with the error.
    super(`HTTP ${status} from ${url}: ${detail}`);
    this.name = "HttpError";
  }
}

/** Network errors, rate limits and server errors may pass on retry; other client errors will not. */
export const isTransient = (error: unknown): boolean =>
  !(error instanceof HttpError) || error.status === 429 || error.status >= 500;

/** Default backoff wait between attempts. */
export const sleep = (ms: number): Promise<void> => Bun.sleep(ms);

export function createFetch(options: HttpOptions = {}): typeof fetch {
  const fetcher: Fetcher = options.fetcher ?? ((request) => fetch(request));
  const retries = options.retries ?? 3;
  const delay = options.delay ?? sleep;

  async function send(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init);
    if (!request.headers.has("User-Agent")) request.headers.set("User-Agent", USER_AGENT);
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetcher(request.clone());
        if (!response.ok) {
          throw new HttpError(request.url, response.status, (await response.text()).slice(0, 300));
        }
        return response;
      } catch (error) {
        if (attempt >= retries || !isTransient(error)) throw error;
        await delay(1000 * attempt);
      }
    }
  }

  // Delegate lazily: the global fetch may be swapped (e.g. by test fixtures) after creation.
  const preconnect = (...args: Parameters<typeof fetch.preconnect>) => fetch.preconnect?.(...args);
  return Object.assign(send, { preconnect });
}
