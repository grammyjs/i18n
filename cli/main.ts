import { log } from "./common.ts";
import { VERSION } from "./common.ts";
import generateTypes from "./generate_types.ts";

const HELP_MESSAGE = `\
grammY i18n CLI ${VERSION}`;

const SUBCOMMAND_HANDLERS: Record<
    string,
    (args: string[]) => void | Promise<void>
> = {
    "help": () => console.log(HELP_MESSAGE),
    "generate-types": generateTypes,
};

const [subcommand, ...subcommandArgs] = Deno.args;

if (subcommand == null) {
    SUBCOMMAND_HANDLERS["help"]?.([]);
} else if (subcommand in SUBCOMMAND_HANDLERS) {
    const handler = SUBCOMMAND_HANDLERS[subcommand];
    await handler(subcommandArgs);
} else {
    log.error("Unknown command:", subcommand);
    Deno.exit(1);
}
