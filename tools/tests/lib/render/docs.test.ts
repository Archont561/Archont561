import { ROOT } from "@/tools/lib/paths.ts";
import {
  cell,
  commandEntries,
  DOCS_INDEX,
  DocsError,
  describeDoc,
  docSections,
  renderDocsIndex,
} from "@/tools/lib/render/docs.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

describe("describeDoc", () => {
  test.prop(
    "takes the title and the first sentence of the lead paragraph, skipping non-prose blocks",
    (fc) => ({
      title: fc.stringMatching(/^[A-Z][a-z ]{0,20}[a-z]$/),
      first: fc.stringMatching(/^[A-Z][a-z ,`]{0,40}[a-z]$/),
      rest: fc.stringMatching(/^[A-Z][a-z ]{0,30}\.$/),
      preamble: fc.subarray(["<!-- note -->", "> quoted", "- item", "| a | b |", "```sh\nbun\n```"]),
    }),
    (_fixtures, { title, first, rest, preamble }) => {
      const markdown = [`# ${title}`, ...preamble, `${first}.\n${rest}`, "## Next", "More."].join("\n\n");
      // Both land in table cells, which are single-spaced.
      expect(describeDoc("x.md", markdown)).toEqual({ title: cell(title), summary: cell(`${first}.`) });
    },
  );

  test("needs a title and a lead paragraph", () => {
    expect(() => describeDoc("a.md", "No heading.")).toThrow(
      new DocsError("a.md", "needs a `# Title` heading"),
    );
    expect(() => describeDoc("b.md", "# Title\n\n## Straight to a section\n")).toThrow(
      "b.md: needs a lead paragraph under its title for the docs index",
    );
    expect(describeDoc("c.md", "# T\n\nNo full stop")).toEqual({ title: "T", summary: "No full stop" });
  });

  test.prop(
    "cell output never breaks a Markdown table row",
    (fc) => ({ text: fc.string({ maxLength: 40 }) }),
    (_fixtures, { text }) => {
      const out = cell(text);
      expect(out).not.toMatch(/\n/);
      expect(out.replace(/\\\|/g, "")).not.toContain("|");
    },
  );
});

test("docSections orders guides, then concepts, then other sections alphabetically", async ({ tmpdir }) => {
  for (const path of ["zeta/z.md", "concepts/c.md", "alpha/a.md", "guides/g2.md", "guides/g1.md"]) {
    tmpdir.write(`docs/${path}`, `# ${path}\n\nAbout ${path}.\n`);
  }
  tmpdir.write("docs/README.md", "# Index is not listed in itself\n");
  const sections = await docSections(tmpdir.dir);
  expect(sections.map((section) => section.title)).toEqual(["Guides", "Concepts", "Alpha", "Zeta"]);
  expect(sections[0]?.docs.map((doc) => doc.path)).toEqual(["guides/g1.md", "guides/g2.md"]);
});

test("commandEntries reads each command's meta description", async ({ tmpdir }) => {
  tmpdir.write(
    "one.ts",
    `export default { meta: { name: "one", description: "Does | one thing" }, run() {} };\n`,
  );
  tmpdir.write("two.ts", "export default { run() {} };\n");
  tmpdir.write("three.ts", `export default { meta: async () => ({ description: "Lazy" }), run() {} };\n`);
  expect(await commandEntries(tmpdir.dir)).toEqual([
    { name: "one", description: "Does \\| one thing" },
    { name: "three", description: "Lazy" },
    { name: "two", description: "" },
  ]);
});

test("the committed docs index matches its template, documents, and commands", async () => {
  const rendered = await renderDocsIndex(ROOT);
  expect(rendered).toBe(await Bun.file(`${ROOT}/${DOCS_INDEX}`).text());
  expect(rendered).toContain("| `capture` |");
  expect(rendered).toContain("(guides/development-setup.md)");
});
