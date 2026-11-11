import type { CommandContext } from "citty";
import {
  commandNames,
  createCli,
  discover,
  EXPECTED_FAILURES,
  failureCode,
  guard,
  isCommand,
  loadCommand,
} from "@/tools/lib/cli/discover.ts";
import { COMMANDS_DIR, ROOT } from "@/tools/lib/paths.ts";
import { CommandError } from "@/tools/lib/run.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

const context = { rawArgs: [], args: { _: [] }, cmd: {} } as unknown as CommandContext;

const commandDir = (tmpdir: { write: (name: string, content: string) => string; dir: string }) => {
  tmpdir.write("alpha.ts", `export default { meta: { name: "alpha" }, run: () => "ran" };\n`);
  tmpdir.write("types.d.ts", "export {};\n");
  tmpdir.write("broken.ts", "export default { name: 'not a command' };\n");
  return tmpdir.dir;
};

describe("commandNames", () => {
  test("lists command modules and skips declarations", async ({ tmpdir }) => {
    expect(await commandNames(commandDir(tmpdir))).toEqual(["alpha", "broken"]);
  });

  test("finds every real command in tools/commands", async () => {
    expect(await commandNames(COMMANDS_DIR)).toEqual([
      "agents",
      "capture",
      "check",
      "clients",
      "commitlint",
      "format",
      "hooks",
      "links",
      "lint",
      "pr",
      "readme",
      "refresh",
      "test",
    ]);
  });

  test("every real command default-exports a citty command", async () => {
    for (const name of await commandNames(COMMANDS_DIR)) {
      expect((await loadCommand(COMMANDS_DIR, name)).meta).toMatchObject({ name });
    }
  });
});

describe("loadCommand and discover", () => {
  test("rejects a module without a command default export", async ({ tmpdir }) => {
    await expect(loadCommand(commandDir(tmpdir), "broken")).rejects.toThrow(
      "tools/commands/broken.ts must `export default defineCommand",
    );
  });

  test("loaders import lazily and guard the command", async ({ tmpdir }) => {
    const loaders = await discover(commandDir(tmpdir));
    expect(Object.keys(loaders)).toEqual(["alpha", "broken"]);
    const alpha = await loaders.alpha?.();
    expect(await alpha?.run?.({ ...context, cmd: alpha } as CommandContext)).toBe("ran");
  });

  test("createCli attaches every command under the given meta", async ({ tmpdir }) => {
    const cli = await createCli(commandDir(tmpdir), { name: "tools", version: "1.0.0" });
    expect(cli.meta).toEqual({ name: "tools", version: "1.0.0" });
    expect(Object.keys(cli.subCommands as object)).toEqual(["alpha", "broken"]);
  });
});

test("isCommand accepts objects with run or subCommands", () => {
  expect(isCommand({ run() {} })).toBe(true);
  expect(isCommand({ subCommands: {} })).toBe(true);
  expect(isCommand({ meta: {} })).toBe(false);
  expect(isCommand(null)).toBe(false);
  expect(isCommand("run")).toBe(false);
});

const failure = (name: string, code?: unknown) =>
  Object.assign(new Error(`${name} happened`), { name, code });

test.prop(
  "failureCode maps expected failures to an exit code and bugs to undefined",
  (fc) => ({
    name: fc.oneof(
      fc.constantFrom(...EXPECTED_FAILURES),
      fc.constantFrom("TypeError", "RangeError", "Error"),
    ),
    code: fc.oneof(fc.integer({ min: -2, max: 255 }), fc.constant(undefined), fc.constant("3")),
  }),
  (_fixtures, { name, code }) => {
    const expected = EXPECTED_FAILURES.has(name)
      ? typeof code === "number" && code > 0
        ? code
        : 1
      : undefined;
    expect(failureCode(failure(name, code))).toBe(expected);
  },
);

test("failureCode ignores non-errors", () => {
  expect(failureCode("CommandError")).toBeUndefined();
});

test.scenario
  .prop("guard turns expected failures into one log line and an exit code", (fc) => ({
    code: fc.integer({ min: 1, max: 255 }),
  }))
  .given("a command whose child process fails", ({ logs, exitCode, code }) => ({
    err: logs.err as string[],
    exit: exitCode as { read: () => number | undefined },
    command: guard({
      run: () => {
        throw new CommandError(["tsc"], code);
      },
    }),
  }))
  .when("the guarded command runs", async ({ command }) => {
    await command.run?.(context);
    return {};
  })
  .then("the error is logged once and the exit code is the child's", ({ err, exit, code, expect }) => {
    expect(err).toEqual([`✖ \`tsc\` exited with code ${code}\n`]);
    expect(exit.read()).toBe(code);
  });

test("guard rethrows bugs and leaves commands without run untouched", async () => {
  const command = guard({
    run: () => {
      throw new TypeError("bug");
    },
  });
  await expect(Promise.resolve(command.run?.(context))).rejects.toThrow("bug");
  const parent = { subCommands: {} };
  expect(guard(parent)).toBe(parent);
});

test("every error class in tools/lib is an expected failure, so users see one line, not a stack", async () => {
  const sources = new Bun.Glob("tools/lib/**/*.ts").scan({ cwd: ROOT });
  const declared: string[] = [];
  for await (const path of sources) {
    if (path.includes("/clients/")) continue;
    const text = await Bun.file(`${ROOT}/${path}`).text();
    for (const match of text.matchAll(/class (\w+Error) extends Error/g)) declared.push(match[1] as string);
  }
  expect(declared.length).toBeGreaterThan(5);
  expect(declared.filter((name) => !EXPECTED_FAILURES.has(name))).toEqual([]);
});
