import { bold, cyan, dim, magenta, red } from "@std/fmt/colors";
import { resolve, toFileUrl } from "@std/path";
import type { AdapterCliConfig } from "../adapters/mod.ts";
import { ADAPTER_VERSIONS } from "./constants.ts";

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

export function isValidString(str: string | undefined): str is string {
    return str != null && str.trim().length > 0;
}

export async function loadAdapterConfig(moduleSrc: string) {
    const resolved = URL.canParse(moduleSrc)
        ? moduleSrc
        : toFileUrl(resolve(moduleSrc)).href;

    try {
        const adapterModule = await import(resolved);
        const adapterConfig = adapterModule.default as AdapterCliConfig;
        if (adapterConfig == null || typeof adapterConfig !== "object")
            throw new Error(
                "No default import found in the specified adapter module",
            );
        if (!ADAPTER_VERSIONS.includes(adapterConfig.version)) {
            throw new Error("Unknown version of adapter config");
        }

        log.info(
            "Loaded configuration:",
            magenta(`version ${adapterConfig.version}`),
        );
        log.info(
            "Configuration features:",
            cyan(Object.keys(adapterConfig.features).join(", ")),
        );
        return adapterConfig;
    } catch (error) {
        if (error instanceof TypeError && "code" in error) {
            if (error.code === "ERR_MODULE_NOT_FOUND")
                throw new Error(
                    `Specified adapter module not found: ${moduleSrc}`,
                );
        }
        throw error;
    }
}
