/**
 * docs/README.md, rendered from templates/docs.ejs. Nothing in the index is typed by
 * hand: documents come from docs/<section>/*.md (title = first `# ` heading, purpose =
 * first sentence of the lead paragraph) and the command table from each command's
 * citty `meta.description`.
 */
import ejs from "ejs";
import { commandNames, loadCommand } from "@/tools/lib/cli/discover.ts";
import { COMMANDS_DIR } from "@/tools/lib/paths.ts";

export const DOCS_INDEX = "docs/README.md";

export type DocEntry = { section: string; path: string; title: string; summary: string };
export type DocSection = { name: string; title: string; docs: DocEntry[] };
export type CommandEntry = { name: string; description: string };

/** A block that is not prose: headings, tables, lists, code fences, quotes, comments. */
const NOT_PROSE = /^(#|\||[-*+] |\d+\. |```|>|<!--)/;

export class DocsError extends Error {
  constructor(path: string, problem: string) {
    super(`${path}: ${problem}`);
    this.name = "DocsError";
  }
}

/** Title and one-sentence purpose of a Markdown document. */
export function describeDoc(path: string, markdown: string): { title: string; summary: string } {
  const blocks = markdown.split(/\n\s*\n/).map((block) => block.trim());
  const heading = blocks.findIndex((block) => block.startsWith("# "));
  if (heading === -1) throw new DocsError(path, "needs a `# Title` heading");
  const title = (blocks[heading] as string).split("\n")[0]?.slice(2).trim() as string;
  const lead = blocks.slice(heading + 1).find((block) => block && !NOT_PROSE.test(block));
  if (!lead) throw new DocsError(path, "needs a lead paragraph under its title for the docs index");
  const text = lead.replace(/\s+/g, " ");
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
  return { title: cell(title), summary: cell(sentence) };
}

const sectionTitle = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

/** Task-oriented guides first, then explanations, then any other section alphabetically. */
export const SECTION_ORDER = ["guides", "concepts"];
const rank = (name: string): number => {
  const index = SECTION_ORDER.indexOf(name);
  return index === -1 ? SECTION_ORDER.length : index;
};

/** Text safe inside a Markdown table cell. */
export const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** Every docs/<section>/*.md, grouped by section and sorted by path. */
export async function docSections(root: string): Promise<DocSection[]> {
  const sections = new Map<string, DocEntry[]>();
  const paths = await Array.fromAsync(new Bun.Glob("*/*.md").scan({ cwd: `${root}/docs` }));
  for (const path of paths.sort()) {
    const [section] = path.split("/") as [string];
    const entry = {
      section,
      path,
      ...describeDoc(`docs/${path}`, await Bun.file(`${root}/docs/${path}`).text()),
    };
    sections.set(section, [...(sections.get(section) ?? []), entry]);
  }
  return [...sections]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, docs]) => ({ name, title: sectionTitle(name), docs }));
}

/** Name and description of every discovered command. */
export async function commandEntries(dir: string = COMMANDS_DIR): Promise<CommandEntry[]> {
  const entries: CommandEntry[] = [];
  for (const name of await commandNames(dir)) {
    const raw = (await loadCommand(dir, name)).meta;
    // citty lets meta be a value, a promise, or a function returning either.
    const meta = typeof raw === "function" ? await raw() : await raw;
    entries.push({ name, description: cell(String(meta?.description ?? "")) });
  }
  return entries;
}

export async function renderDocsIndex(root: string, commandsDir: string = COMMANDS_DIR): Promise<string> {
  return ejs.renderFile(
    `${root}/templates/docs.ejs`,
    { sections: await docSections(root), commands: await commandEntries(commandsDir) },
    { async: false },
  );
}
