import { log } from "./deps.ts";

import help, { HELP_MESSAGE } from "./help.ts";
import generateTypes from "./generate_types.ts";

const SUBCOMMAND_HANDLERS: Record<
    string,
    (args: string[]) => void | Promise<void>
> = {
    "help": help,
    "generate-types": generateTypes,
};

const [subcommand, ...subcommandArgs] = Deno.args;

if (subcommand == null) {
    console.log(HELP_MESSAGE);
} else if (subcommand in SUBCOMMAND_HANDLERS) {
    const handler = SUBCOMMAND_HANDLERS[subcommand];
    await handler(subcommandArgs);
} else {
    log.error("Unknown command:", subcommand);
    Deno.exit(1);
}
