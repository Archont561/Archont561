import { rootArg } from "@/tools/lib/cli/args.ts";
import { ROOT } from "@/tools/lib/paths.ts";
import { expect, test } from "@/tools/tests/fixtures.ts";

test("rootArg is a string option defaulting to the repository root", () => {
  expect(rootArg).toMatchObject({ type: "string", default: ROOT, valueHint: "dir" });
});
