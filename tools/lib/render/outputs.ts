/**
 * Write rendered outputs, or report which committed files are stale.
 * An SVG in a generated directory that no longer has a source is an orphan and counts as stale.
 */
import { readdir, unlink } from "node:fs/promises";

export const BADGE_DIR = "assets/badges";
export const CARD_DIR = "assets/cards";
/** Directories whose every SVG is rendered; anything else in them is an orphan. */
export const GENERATED_DIRS = [BADGE_DIR, CARD_DIR];

export async function orphans(root: string, outputs: Map<string, string>): Promise<string[]> {
  const found = await Promise.all(
    GENERATED_DIRS.map(async (dir) =>
      (await readdir(`${root}/${dir}`).catch(() => [] as string[]))
        .filter((name) => name.endsWith(".svg"))
        .map((name) => `${dir}/${name}`),
    ),
  );
  return found
    .flat()
    .filter((path) => !outputs.has(path))
    .sort();
}

export async function staleOutputs(root: string, outputs: Map<string, string>): Promise<string[]> {
  const stale = await orphans(root, outputs);
  for (const [path, content] of outputs) {
    const file = Bun.file(`${root}/${path}`);
    if (!(await file.exists()) || (await file.text()) !== content) stale.push(path);
  }
  return stale;
}

export async function writeOutputs(
  root: string,
  outputs: Map<string, string>,
): Promise<{ written: number; removed: string[] }> {
  const removed = await orphans(root, outputs);
  for (const [path, content] of outputs) await Bun.write(`${root}/${path}`, content);
  for (const path of removed) await unlink(`${root}/${path}`);
  return { written: outputs.size, removed };
}
