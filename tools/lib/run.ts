/**
 * Process runner for tools that delegate to other CLIs (Biome, Vale, Alint, git, ...).
 *
 * `runner` is an object so tests can replace `exec`/`capture` with `spyOn` and assert
 * on the exact command lines a tool would execute.
 */
import { log } from "@/tools/lib/log.ts";
import { ROOT } from "@/tools/lib/paths.ts";

export type ExecOptions = {
  cwd?: string;
  /** Extra variables merged over the inherited environment. */
  env?: Record<string, string>;
  /** Text piped to the child's stdin. */
  stdin?: string;
};

export class CommandError extends Error {
  constructor(
    readonly command: string[],
    readonly code: number,
  ) {
    super(`\`${command.join(" ")}\` exited with code ${code}`);
    this.name = "CommandError";
  }
}

const spawnOptions = (options: ExecOptions) => ({
  cwd: options.cwd ?? ROOT,
  env: options.env ? { ...process.env, ...options.env } : undefined,
  stdin: options.stdin === undefined ? ("inherit" as const) : new Response(options.stdin),
});

export const runner = {
  /** Run with inherited output; resolves to the exit code. */
  async exec(command: string[], options: ExecOptions = {}): Promise<number> {
    const child = Bun.spawn(command, { ...spawnOptions(options), stdout: "inherit", stderr: "inherit" });
    return await child.exited;
  },
  /** Run and collect stdout; resolves to the exit code and trimmed output. */
  async capture(command: string[], options: ExecOptions = {}): Promise<{ code: number; stdout: string }> {
    const child = Bun.spawn(command, { ...spawnOptions(options), stdout: "pipe", stderr: "inherit" });
    const stdout = await new Response(child.stdout).text();
    return { code: await child.exited, stdout: stdout.trim() };
  },
};

/** Run one command, logging it first; throws CommandError on a non-zero exit. */
export async function run(command: string[], options: ExecOptions = {}): Promise<void> {
  log.step(command.join(" "));
  const code = await runner.exec(command, options);
  if (code !== 0) throw new CommandError(command, code);
}

/** Run commands in order, stopping at the first failure. */
export async function runAll(commands: string[][], options: ExecOptions = {}): Promise<void> {
  for (const command of commands) await run(command, options);
}
