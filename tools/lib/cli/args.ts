/** Arguments shared by several commands in tools/commands/. */
import { ROOT } from "@/tools/lib/paths.ts";

export const rootArg = {
  type: "string",
  description: "Repository root to operate on",
  default: ROOT,
  valueHint: "dir",
} as const;
