import { CommandError, run, runAll, runner } from "@/tools/lib/run.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

describe("runner (real processes)", () => {
  test("exec resolves to the exit code", async () => {
    expect(await runner.exec(["true"])).toBe(0);
    expect(await runner.exec(["false"])).toBe(1);
  });

  test("capture collects trimmed stdout and honours stdin, env, and cwd", async () => {
    expect(await runner.capture(["echo", "  hi  "])).toEqual({ code: 0, stdout: "hi" });
    expect((await runner.capture(["cat"], { stdin: "piped" })).stdout).toBe("piped");
    expect((await runner.capture(["sh", "-c", "echo $PROBE"], { env: { PROBE: "set" } })).stdout).toBe("set");
    expect((await runner.capture(["pwd"], { cwd: "/" })).stdout).toBe("/");
  });
});

test.scenario
  .prop("run logs the command and fails exactly on a non-zero exit", (fc) => ({
    command: fc.array(fc.stringMatching(/^[a-z.-]{1,8}$/), { minLength: 1, maxLength: 4 }),
    code: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 255 })),
  }))
  .given("a child that exits with some code", ({ proc, logs, code }) => {
    proc.exec.mockResolvedValue(code);
    return { spawned: proc, out: logs.out as string[] };
  })
  .when("run executes it", async ({ command }) => ({
    error: await run(command, { cwd: "/tmp" }).then(
      () => undefined,
      (caught: unknown) => caught,
    ),
  }))
  .then(
    "the step is logged and a failure carries command and code",
    ({ spawned, out, command, code, error, expect }) => {
      expect(out).toEqual([`▸ ${command.join(" ")}\n`]);
      expect(spawned.exec).toHaveBeenCalledWith(command, { cwd: "/tmp" });
      if (code === 0) {
        expect(error).toBeUndefined();
        return;
      }
      expect(error).toBeInstanceOf(CommandError);
      expect(error).toMatchObject({
        command,
        code,
        message: `\`${command.join(" ")}\` exited with code ${code}`,
      });
    },
  );

test.scenario
  .prop("runAll stops at the first failure", (fc) => ({
    codes: fc.array(fc.nat(2), { minLength: 1, maxLength: 6 }),
  }))
  .given("children with some exit codes", ({ proc, logs, codes }) => {
    let call = 0;
    proc.exec.mockImplementation(async () => codes[call++] ?? 0);
    return { spawned: proc, quiet: logs };
  })
  .when("runAll executes them", async ({ codes }) => ({
    failed: await runAll(codes.map((_, index) => [`step${index}`])).then(
      () => false,
      () => true,
    ),
  }))
  .then("everything up to and including the first failure ran", ({ spawned, codes, failed, expect }) => {
    const firstFailure = codes.findIndex((code) => code !== 0);
    expect(failed).toBe(firstFailure !== -1);
    expect(spawned.exec).toHaveBeenCalledTimes(firstFailure === -1 ? codes.length : firstFailure + 1);
  });
