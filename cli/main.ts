import { VERSION } from "./constants.ts";
import { default as generateTypes } from "./generate_types.ts";
import { cli } from "cleye";

cli({
    name: "i18n-cli",
    version: VERSION,
    strictFlags: true,
    help: {
        description: "Official CLI for @grammyjs/i18n.",
    },
    commands: [
        generateTypes,
    ],
}, (argv) => {
    argv.showHelp();
});
