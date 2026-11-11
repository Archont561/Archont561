import { log, type recordLog, useSink } from "@/tools/lib/log.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

const LEVELS = {
  info: ["out", ""],
  step: ["out", "▸ "],
  success: ["out", "✔ "],
  warn: ["err", "⚠ "],
  error: ["err", "✖ "],
} as const;

test.scenario
  .prop("each level prefixes its message and picks its stream", (fc) => ({
    level: fc.constantFrom(...(Object.keys(LEVELS) as (keyof typeof LEVELS)[])),
    message: fc.string({ maxLength: 30 }),
  }))
  .given("log output is recorded", ({ logs }) => ({ recorded: logs as ReturnType<typeof recordLog> }))
  .when("a message is logged", ({ level, message }) => {
    log[level](message);
    return {};
  })
  .then("exactly one prefixed line lands on the level's stream", ({ recorded, level, message, expect }) => {
    const [stream, prefix] = LEVELS[level];
    expect(recorded[stream]).toEqual([`${prefix}${message}\n`]);
    expect(recorded[stream === "out" ? "err" : "out"]).toEqual([]);
  });

test("useSink restores the previous sink", ({ logs }) => {
  const inner: string[] = [];
  const restore = useSink({ out: (text) => inner.push(text), err: (text) => inner.push(text) });
  log.info("inner");
  restore();
  log.info("outer");
  expect(inner).toEqual(["inner\n"]);
  expect(logs.out).toEqual(["outer\n"]);
});

test("the default sink writes to the process streams", ({ stdio }) => {
  log.info("to stdout");
  log.error("to stderr");
  expect(stdio.stdout()).toBe("to stdout\n");
  expect(stdio.stderr()).toBe("✖ to stderr\n");
});
