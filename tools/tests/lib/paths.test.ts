import { existsSync } from "node:fs";
import { COMMANDS_DIR, ROOT } from "@/tools/lib/paths.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

test("ROOT is the repository root and COMMANDS_DIR holds the commands", () => {
  expect(existsSync(`${ROOT}/package.json`)).toBe(true);
  expect(ROOT.endsWith("/")).toBe(false);
  expect(COMMANDS_DIR).toBe(`${ROOT}/tools/commands`);
  expect(existsSync(`${COMMANDS_DIR}/capture.ts`)).toBe(true);
});
