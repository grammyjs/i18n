import type { AdapterCliConfig } from "../adapters/mod.ts";
import type { NamespaceResolverFn } from "../mod.ts";

export type CliOptions = {
    adapter?: string | AdapterCliConfig;
    sources?: string[] | {
        path: string;
        fallbackLocale: string;
        shared?: string | boolean;
        deferShared?: boolean;
    };
    resolveNamespace?: NamespaceResolverFn;
    followSymlinks?: boolean;
    ignoreDotFiles?: boolean;
    types?: {
        out?: string;
    };
};

export function defineConfig(config: CliOptions): CliOptions {
    return config;
}
