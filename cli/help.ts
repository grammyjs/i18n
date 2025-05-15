import { VERSION } from "./deps.ts";

export const HELP_MESSAGE = `\
grammY i18n CLI ${VERSION}`;

export default function help() {
    console.log(HELP_MESSAGE);
}
