/**
 * Command discovery for `bun run tools <cmd>`.
 *
 * Every `tools/commands/<name>.ts` default-exports `defineCommand(...)` and becomes
 * the subcommand `<name>`. Modules load lazily, so `bun run tools capture` imports
 * only the capture command. Shared logic belongs in tools/lib/, not in commands.
 */
import { type CommandDef, type CommandMeta, defineCommand } from "citty";
import { log } from "@/tools/lib/log.ts";

// biome-ignore lint/suspicious/noExplicitAny: citty subcommands carry heterogeneous argument shapes.
export type AnyCommand = CommandDef<any>;
export type Loader = () => Promise<AnyCommand>;

export function isCommand(value: unknown): value is AnyCommand {
  return typeof value === "object" && value !== null && ("run" in value || "subCommands" in value);
}

/** Command names found in `dir`, sorted. */
export async function commandNames(dir: string): Promise<string[]> {
  const names: string[] = [];
  for await (const file of new Bun.Glob("*.ts").scan({ cwd: dir })) {
    if (!file.endsWith(".d.ts")) names.push(file.slice(0, -".ts".length));
  }
  return names.sort();
}

/** Import one command module and verify its default export is a citty command. */
export async function loadCommand(dir: string, name: string): Promise<AnyCommand> {
  const module = await import(`${dir}/${name}.ts`);
  if (!isCommand(module.default)) {
    throw new TypeError(`tools/commands/${name}.ts must \`export default defineCommand({ ... })\``);
  }
  return module.default;
}

/** Errors that report a failed check or call, not a bug; they print one line instead of a stack. */
export const EXPECTED_FAILURES = new Set([
  "CommandError",
  "StaleOutputError",
  "HttpError",
  "GraphQLError",
  "LintError",
  "PrError",
  "DocsError",
  "ToolchainError",
]);

/** Exit code for an expected failure (a child's own code when it has one), or undefined for bugs. */
export function failureCode(error: unknown): number | undefined {
  if (!(error instanceof Error) || !EXPECTED_FAILURES.has(error.name)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" && code > 0 ? code : 1;
}

/** Wrap a command so expected failures log one line and set the exit code; bugs still throw. */
export function guard(command: AnyCommand): AnyCommand {
  const { run } = command;
  if (!run) return command;
  return {
    ...command,
    async run(context) {
      try {
        return await run(context);
      } catch (error) {
        const code = failureCode(error);
        if (code === undefined) throw error;
        log.error((error as Error).message);
        process.exitCode = code;
      }
    },
  };
}

export async function discover(dir: string): Promise<Record<string, Loader>> {
  const names = await commandNames(dir);
  return Object.fromEntries(names.map((name) => [name, async () => guard(await loadCommand(dir, name))]));
}

/** The root `tools` command with every discovered subcommand attached. */
export async function createCli(dir: string, meta: CommandMeta): Promise<AnyCommand> {
  return defineCommand({ meta, subCommands: await discover(dir) });
}
