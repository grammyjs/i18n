import { bold, dim, red } from "jsr:@std/fmt@^1/colors";

export const VERSION = "0.1";

class Logger {
    quiet: boolean = false;
    info(...data: unknown[]) {
        !this.quiet && console.info(dim(new Date().toISOString()), ...data);
    }
    error(...data: unknown[]) {
        console.error(red(bold("error:")), ...data);
    }
}

export const log = new Logger();

export function makeIndent(width: number) {
    const baseIndent = " ".repeat(width);
    return (level: number) => baseIndent.repeat(level);
}
