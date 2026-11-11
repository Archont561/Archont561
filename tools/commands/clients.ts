import { defineCommand } from "citty";
import { generateClients } from "@/tools/lib/capture/codegen.ts";
import { rootArg } from "@/tools/lib/cli/args.ts";
import { log } from "@/tools/lib/log.ts";

export default defineCommand({
  meta: {
    name: "clients",
    description: "Regenerate the typed registry clients (Hey API for REST, gql.tada for prefix.dev GraphQL)",
  },
  args: { root: rootArg },
  async run({ args }) {
    await generateClients(args.root);
    log.success("Registry clients regenerated under tools/lib/capture/clients/.");
  },
});
