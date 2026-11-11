/** Repository root, resolved from this file so tools work from any working directory. */
export const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

/** Directory scanned for `bun run tools <cmd>` commands. */
export const COMMANDS_DIR = `${ROOT}/tools/commands`;
