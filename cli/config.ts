import type { AdapterCliConfig } from "../adapters/mod.ts";
import type { NamespaceResolverFn } from "../mod.ts";

/** i18n CLI options. */
export type CliOptions = {
    /**
     * Format adapter to use. Either link a module, or import and use the
     * adapter configuration itself.
     */
    adapter?: string | AdapterCliConfig;
    /**
     * Source locale files to read from. If you pass an array of paths, those
     * files will be considered as source files. If a locales directory
     * configuration is provided, it will be handled like that.
     */
    sources?: string[] | {
        /** Path to locales directory. */
        path: string;
        /**
         * Fallback locale to use. This must be present inside the locales
         * directory. This locale is considered as the main source to generate
         * types from.
         */
        fallbackLocale: string;
        /**
         * Whether to use shared directory or not. They are enabled by default,
         * and 'shared' directory inside the locales directory is considered as
         * shared directory. This can be changed by setting this to the name of
         * the directory.
         */
        shared?: string | boolean;
        /**
         * Whether to load the files in shared directory after the locale source
         * files or not. This may be useful, when message overriding is needed.
         */
        deferShared?: boolean;
    };
    /**
     * Function for resolving path to namespace. Use the same one used for
     * loading locale directory resources in runtime.
     */
    resolveNamespace?: NamespaceResolverFn;
    /** Whether to follow symlinks or not. */
    followSymlinks?: boolean;
    /** Whether to ignore dot (hidden) files. */
    ignoreDotFiles?: boolean;
    /** Options related to type generation. */
    types?: {
        /** Where to write the output to. If not set, it will be written to stdout. */
        out?: string;
    };
};

export function defineConfig(config: CliOptions): CliOptions {
    return config;
}
