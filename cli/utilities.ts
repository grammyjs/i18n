import { bold, cyan, dim, magenta, red } from "@std/fmt/colors";
import { resolve, toFileUrl } from "@std/path";
import type { AdapterCliConfig } from "../adapters/mod.ts";
import { ADAPTER_CONFIG_SCHEMA_VERSIONS } from "./constants.ts";
import type { CliOptions } from "./config.ts";

class Logger {
    quiet: boolean = false;
    info(...data: unknown[]) {
        !this.quiet && console.error(...data);
    }
    error(...data: unknown[]) {
        console.error(red(bold("error:")), ...data);
    }
}

export const log = new Logger();

export function makeIndent(width: number): (level: number) => string {
    const baseIndent = " ".repeat(width);
    return (level: number) => baseIndent.repeat(level);
}

export function isValidString(str: string | undefined): str is string {
    return typeof str === "string" && str.trim().length > 0;
}

export async function loadCliConfig(src: string): Promise<CliOptions> {
    log.info(dim("Reading configuration: " + src));

    const resolved = URL.canParse(src) ? src : toFileUrl(resolve(src)).href;

    try {
        const cliConfigModule = await import(resolved);
        const config = cliConfigModule.default as CliOptions;
        if (config == null || typeof config !== "object")
            cliErr(
                "No default import found in the specified configuration file",
            );

        return config;
    } catch (error) {
        if (error instanceof TypeError && "code" in error) {
            if (error.code === "ERR_MODULE_NOT_FOUND")
                cliErr(`Specified configuration not found: ${src}`);
        }

        console.error(error);
        if (error instanceof Error) log.error(error.message);
        else log.error("Failed to load the configuration");
        Deno.exit(1);
    }
}

export async function loadAdapterConfig(
    moduleSrc: string,
): Promise<AdapterCliConfig> {
    log.info("Reading adapter configuration:", dim(moduleSrc));

    const resolved = URL.canParse(moduleSrc)
        ? moduleSrc
        : toFileUrl(resolve(moduleSrc)).href;

    try {
        const adapterModule = await import(resolved);
        const adapterConfig = adapterModule.default as AdapterCliConfig;
        if (adapterConfig == null || typeof adapterConfig !== "object")
            cliErr("No default import found in the specified adapter module");
        if (!ADAPTER_CONFIG_SCHEMA_VERSIONS.includes(adapterConfig.version))
            cliErr("Unknown version of adapter config; try updating");

        log.info(
            "Loaded configuration:",
            magenta(`v${adapterConfig.version}`),
            "(" + cyan(Object.keys(adapterConfig.features).join(", ")) + ")",
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

export function isDefined<T>(a: T): a is NonNullable<T> {
    return a != null;
}

export async function failHard<T>(
    promise: Promise<T>,
    message: string,
): Promise<T> {
    try {
        return await promise;
    } catch (error) {
        console.error(error);
        log.error(message);
        if (error instanceof Error) {
            log.error(error.message);
        }
        Deno.exit(1);
    }
}

export class CliError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export function cliErr(message: string): never {
    throw new CliError(message);
}

export type Paths<T> = {
    [K in keyof T & string]:
        | K
        | (T[K] extends infer V ? V extends readonly unknown[] ? never
            : V extends object ? `${K}.${Paths<V>}`
            : never
            : never);
}[keyof T & string];
