import { defineCommand, runMain } from "citty";
import { VERSION } from "./constants.ts";
import { command as generateTypes } from "./generate_types.ts";

const main = defineCommand({
    meta: {
        name: "i18n-cli",
        description: "Official CLI for @grammyjs/i18n",
        version: VERSION,
    },
    subCommands: {
        "generate-types": generateTypes,
    },
});

runMain(main, { rawArgs: Deno.args });
