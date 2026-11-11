/**
 * Test preload (bunfig.toml). `test.scenario.prop` does not expose fast-check
 * options, so the sample count is set once here: every scenario runs against
 * 25 generated examples (fast-check's default of 100 rebuilds each fixture 100 times).
 * Set FC_NUM_RUNS to explore more, e.g. FC_NUM_RUNS=500 bun run tools test.
 */
import fc from "fast-check";
import { readEnv } from "@/tools/lib/config/env.ts";

fc.configureGlobal({ numRuns: readEnv().fcNumRuns ?? 25 });
