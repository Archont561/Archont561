import { ROOT } from "@/tools/lib/paths.ts";
import {
  isPixiTool,
  PIXI_ENV,
  PIXI_TOOLS,
  pixiBin,
  resolveCommand,
  ToolchainError,
} from "@/tools/lib/toolchain.ts";
import { describe, expect, test } from "@/tools/tests/fixtures.ts";

describe("resolveCommand", () => {
  test("prefers the pixi environment's copy, so hooks work without `pixi shell`", async ({ tmpdir }) => {
    const root = tmpdir.dir as string;
    await Bun.write(pixiBin("zizmor", root), "#!/bin/sh\n");
    expect(await resolveCommand(["zizmor", "--offline", ".github"], root, "")).toEqual([
      `${root}/${PIXI_ENV}/bin/zizmor`,
      "--offline",
      ".github",
    ]);
  });

  test("falls back to PATH when the environment is activated elsewhere", async ({ tmpdir }) => {
    const bin = tmpdir.path("bin/lychee");
    await Bun.write(bin, "#!/bin/sh\n");
    await Bun.$`chmod +x ${bin}`.quiet();
    expect(await resolveCommand(["lychee", "README.md"], tmpdir.path("empty"), tmpdir.path("bin"))).toEqual([
      "lychee",
      "README.md",
    ]);
  });

  test("names the fix when a tool is on neither", async ({ tmpdir }) => {
    const error = await resolveCommand(["actionlint"], tmpdir.dir as string, tmpdir.path("none")).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ToolchainError);
    expect((error as Error).message).toBe(
      "actionlint is not installed: run `pixi install` (pixi.toml provides bun, actionlint, zizmor and lychee).",
    );
  });

  test("leaves npm CLIs alone", async () => {
    expect(await resolveCommand(["biome", "check", "."], "/nowhere", "")).toEqual(["biome", "check", "."]);
    expect(await resolveCommand([], "/nowhere", "")).toEqual([]);
    expect(isPixiTool("vale")).toBe(false);
  });
});

test("conda layouts differ on Windows", () => {
  expect(pixiBin("lychee", "/r", "linux")).toBe("/r/.pixi/envs/default/bin/lychee");
  expect(pixiBin("lychee", "C:/r", "win32")).toBe("C:/r/.pixi/envs/default/Library/bin/lychee.exe");
});

test("pixi.toml pins every pixi tool, and its Bun is package.json's packageManager", async () => {
  const pixi = Bun.TOML.parse(await Bun.file(`${ROOT}/pixi.toml`).text()) as {
    dependencies: Record<string, string>;
  };
  const pkg = await Bun.file(`${ROOT}/package.json`).json();
  for (const tool of [...PIXI_TOOLS, "bun"]) expect(pixi.dependencies[tool]).toMatch(/^==\d+\.\d+\.\d+$/);
  expect(`bun@${pixi.dependencies.bun?.slice(2)}`).toBe(pkg.packageManager);
  expect(Object.keys(pixi).sort()).toEqual(["dependencies", "workspace"]);
});
