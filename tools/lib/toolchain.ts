/**
 * Executables provided by pixi (pixi.toml, conda-forge) rather than npm: actionlint and
 * zizmor (workflow linters) and lychee (link checker). Bun itself comes from the same
 * environment, pinned to package.json's `packageManager`.
 *
 * Commands name these tools bare; `resolveCommand` swaps in the copy from
 * `.pixi/envs/default` when it exists, so git hooks work without `pixi shell`. Otherwise
 * the name runs from PATH (an activated shell, or CI's setup-pixi), and if it is on
 * neither, the error says how to install it.
 */
import { ROOT } from "@/tools/lib/paths.ts";

export const PIXI_ENV = ".pixi/envs/default";
export const PIXI_TOOLS = ["actionlint", "zizmor", "lychee"] as const;
export type PixiTool = (typeof PIXI_TOOLS)[number];

/** A pixi-provided executable is neither installed in the environment nor on PATH. */
export class ToolchainError extends Error {
  constructor(tool: string) {
    super(
      `${tool} is not installed: run \`pixi install\` (pixi.toml provides bun, actionlint, zizmor and lychee).`,
    );
    this.name = "ToolchainError";
  }
}

export const isPixiTool = (name: string | undefined): name is PixiTool =>
  (PIXI_TOOLS as readonly (string | undefined)[]).includes(name);

/** Where conda puts an executable: `bin/` on Unix, `Library/bin/*.exe` on Windows. */
export const pixiBin = (tool: string, root: string = ROOT, platform: string = process.platform): string =>
  platform === "win32" ? `${root}/${PIXI_ENV}/Library/bin/${tool}.exe` : `${root}/${PIXI_ENV}/bin/${tool}`;

/** Swap a pixi tool's name at the head of a command line for the environment's copy. */
export async function resolveCommand(
  command: string[],
  root: string = ROOT,
  /** Search path for the fallback; Bun.which uses the process PATH when omitted. */
  path?: string,
): Promise<string[]> {
  const [head, ...rest] = command;
  if (!isPixiTool(head)) return command;
  const local = pixiBin(head, root);
  if (await Bun.file(local).exists()) return [local, ...rest];
  if (Bun.which(head, path === undefined ? undefined : { PATH: path })) return command;
  throw new ToolchainError(head);
}

/** Indirection so tests can stub resolution, like `runner` for spawning. */
export const toolchain = { resolve: resolveCommand };
