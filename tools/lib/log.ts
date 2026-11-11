/**
 * The project's logger (PCC-S01: no debug printing in library code).
 *
 * Output goes through a swappable sink so tests can assert on it without touching
 * the real process streams.
 */
export type Sink = { out(text: string): void; err(text: string): void };

const stdio: Sink = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

let sink: Sink = stdio;

export const log = {
  info: (message: string) => sink.out(`${message}\n`),
  step: (message: string) => sink.out(`▸ ${message}\n`),
  success: (message: string) => sink.out(`✔ ${message}\n`),
  warn: (message: string) => sink.err(`⚠ ${message}\n`),
  error: (message: string) => sink.err(`✖ ${message}\n`),
};

/** Route log output into `next` until the returned restore function is called. */
export function useSink(next: Sink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

/** Collect log lines in memory; handy for tests. */
export function recordLog(): { out: string[]; err: string[]; restore: () => void } {
  const out: string[] = [];
  const err: string[] = [];
  const restore = useSink({ out: (text) => out.push(text), err: (text) => err.push(text) });
  return { out, err, restore };
}
