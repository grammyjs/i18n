import { yellow } from "@std/fmt/colors";
import {
    basename,
    dirname,
    extname,
    isAbsolute,
    join,
    relative,
    resolve,
    SEPARATOR,
} from "@std/path";
import { defineCommand } from "citty";
import type { AdapterCliConfig } from "../adapters/mod.ts";
import { isValidLocale, walk } from "../utilities.ts";
import { GENERATED_FILE_OUTPUT_PREFIX } from "./constants.ts";
import {
    isValidString,
    loadAdapterConfig,
    log,
    makeIndent,
} from "./utilities.ts";

type SourceConfig = {
    mode: "locales-dir";
    dirpath: string;
    fallback: string;
} | {
    mode: "explicit";
    paths: string[];
};

export const command = defineCommand({
    meta: {
        name: "generate-types",
        description:
            "Generate TypeScript types for i18n messages from locale files",
    },
    args: {
        adapter: {
            type: "string",
            description: "The i18n adapter to utilize",
            required: true,
            alias: "a",
            valueHint: "MODULE",
        },
        "locales-dir": {
            type: "string",
            description: "Path to the locales directory",
            required: false,
            alias: "d",
        },
        fallback: {
            type: "string",
            description:
                "The fallback locale inside the locales directory. Required in locales directory mode",
            required: false,
        },
        output: {
            type: "string",
            description: "Path to the output file",
            required: true,
            alias: "o",
        },
        watch: {
            type: "boolean",
            required: false,
            description: "Run in watch mode (useful for development)",
            alias: "w",
            default: false,
        },
        "follow-symlinks": {
            type: "boolean",
            description: "Follow symlinks",
            required: false,
            default: false,
        },
        "ignore-dot-files": {
            type: "boolean",
            description: "Ignore dot (hidden) files",
            negativeDescription: "Do not ignore dot (hidden) files",
            required: false,
            default: true,
        },
    },
    run: async function (ctx) {
        const adapterConfig = await loadAdapterConfig(ctx.args.adapter)
            .then((config) => config)
            .catch((error) => {
                console.error(error);
                if (error instanceof Error) log.error(error.message);
                else log.error("Failed to load the configuration");
                Deno.exit(1);
            });

        if (
            !("type-gen" in adapterConfig.features) ||
            typeof adapterConfig.features["type-gen"] !== "function"
        ) {
            log.error("Feature not supported by adapter: type-gen");
            Deno.exit(1);
        }

        await generateTypes(adapterConfig, {
            rawPaths: ctx.args._,
            localesDirectory: ctx.args["locales-dir"],
            fallbackLocale: ctx.args["fallback"],
            followSymlinks: ctx.args["follow-symlinks"],
            ignoreDotFiles: ctx.args["ignore-dot-files"],
            outputPath: ctx.args.output,
            watchMode: ctx.args.watch,
        });
    },
});

async function generateTypes(adapterConfig: AdapterCliConfig, args: {
    rawPaths: string[];
    localesDirectory?: string;
    fallbackLocale?: string;
    outputPath: string;
    watchMode: boolean;
    ignoreDotFiles: boolean;
    followSymlinks: boolean;
}): Promise<void> {
    const featureFn = adapterConfig.features["type-gen"];
    if (typeof featureFn !== "function")
        throw new Error("must be checked inside the run fn");

    let source: SourceConfig;

    if (isValidString(args.localesDirectory)) {
        if (isValidString(args.fallbackLocale)) {
            source = {
                mode: "locales-dir",
                dirpath: args.localesDirectory,
                fallback: args.fallbackLocale,
            };
            if (args.rawPaths.length > 0) {
                log.info(
                    "Path arguments and locales directory cannot be used together.",
                );
                log.info("Ignoring path arguments...");
                args.rawPaths.splice(0, args.rawPaths.length);
            }
        } else {
            log.error(
                "Fallback locale must be specified when locales directory is specified.",
            );
            Deno.exit(1);
        }
    } else if (isValidString(args.fallbackLocale)) {
        log.error(
            "Locales directory must be specified when fallback is specified.",
        );
        Deno.exit(1);
    } else if (
        args.rawPaths.length === 0 ||
        args.rawPaths.every((arg) => !isValidString(arg))
    ) {
        log.error("Specify at least one file/directory path to read from.");
        Deno.exit(1);
    } else {
        source = {
            mode: "explicit",
            paths: args.rawPaths,
        };
    }

    // Source message files for passing to adapter type generator
    const sources = new Set<string>();
    // Initial set of watchpaths for the FS watcher
    const watchpaths: string[] = [];
    // Locales found under the locales directory
    const locales = new Set<string>();

    if (source.mode === "locales-dir") {
        const localesDir = await resolvePath(
            source.dirpath,
            args.followSymlinks,
        );
        if (!localesDir.dir) {
            log.error("Specified locales directory is not a directory");
            Deno.exit(1);
        }
        for await (const dirent of Deno.readDir(localesDir.path)) {
            if (dirent.isDirectory) {
                locales.add(dirent.name);
            } else if (
                dirent.isFile &&
                adapterConfig.extensions.includes(extname(dirent.name))
            ) {
                const filepath = resolve(localesDir.path, dirent.name);
                sources.add(filepath);
            } else if (dirent.isSymlink) {
                // todo: if directory, watch the realpath, else: source the file
            }
        }
        if (!locales.has(source.fallback)) {
            log.error(
                "Could not find the specified fallback locale inside the locales directory",
            );
            Deno.exit(1);
        }

        log.info(
            yellow(args.watchMode ? `watching` : `reading`),
            localesDir.path,
            "files and files inside",
            join(localesDir.path, source.fallback),
        );

        for await (
            const file of walk(
                join(localesDir.path, source.fallback),
                adapterConfig.extensions,
                {
                    followSymlinks: args.followSymlinks,
                    ignoreDotFiles: args.ignoreDotFiles,
                },
            )
        ) {
            sources.add(file);
        }

        watchpaths.push(localesDir.path);
    } else {
        for (const arg of args.rawPaths) {
            const resolved = await resolvePath(arg, args.followSymlinks);
            log.info(
                yellow(args.watchMode ? `watching` : `reading`),
                resolved.path,
            );
            for await (
                const file of walk(
                    resolved.path,
                    adapterConfig.extensions,
                    {
                        followSymlinks: args.followSymlinks,
                        ignoreDotFiles: args.ignoreDotFiles,
                    },
                )
            ) {
                sources.add(file);
            }
            watchpaths.push(resolved.path);
        }
    }

    await writeGenerated(locales, await featureFn(sources), args.outputPath);
    if (!args.watchMode) Deno.exit(0);

    /// === Watcher Mode

    log.info("starting file watcher");

    using watcher = Deno.watchFs(watchpaths, { recursive: true });
    function closeWatcher() {
        log.info("closing the file watcher");
        watcher.close();
    }
    Deno.addSignalListener("SIGINT", closeWatcher);
    Deno.addSignalListener("SIGTERM", closeWatcher);

    const resolvedLocalesDirpath = source.mode === "locales-dir"
        ? resolve(source.dirpath)
        : undefined;

    for await (const event of watcher) {
        if (event.paths.length !== 1)
            continue;
        if (
            event.kind !== "create" && event.kind !== "modify" &&
            event.kind !== "remove" && event.kind !== "rename"
        ) {
            continue;
        }

        const filepath = event.paths[0];

        // Locales directory mode: a locale dir was created/deleted
        if (
            source.mode === "locales-dir" &&
            dirname(filepath) === resolvedLocalesDirpath
        ) {
            const localeName = basename(filepath);
            try {
                const realpath = args.followSymlinks
                    ? await Deno.realPath(filepath)
                    : filepath;
                const stat = await Deno.stat(realpath);

                if (stat.isDirectory) {
                    if (isValidLocale(localeName)) {
                        locales.add(localeName);
                        await writeGenerated(
                            locales,
                            await featureFn(sources),
                            args.outputPath,
                        );
                    } else {
                        log.error(
                            "Found changes in",
                            filepath,
                            "but ignoring because the directory name seems invalid for a locale",
                        );
                    }
                }
            } catch (error) {
                if (error instanceof Deno.errors.NotFound) {
                    if (localeName === args.fallbackLocale) {
                        log.error(
                            "Fallback locale directory no longer exists. Exiting...",
                        );
                        closeWatcher();
                        Deno.exit(1);
                    }
                    locales.delete(localeName);
                    await writeGenerated(
                        locales,
                        await featureFn(sources),
                        args.outputPath,
                    );
                } else {
                    log.error("Some error occurred:");
                    console.error(error);
                }
            }

            continue;
        }

        // Directories have been handled, now need to handle file events

        if (!adapterConfig.extensions.includes(extname(filepath)))
            continue;

        if (source.mode === "locales-dir") {
            // We only want to watch the files underneath the fallback locale directory & the common files
            const parent = resolve(source.dirpath, source.fallback);
            const relativePath = relative(filepath, parent);
            if (
                // If its in some other locale directory, ignore.
                (isAbsolute(relativePath) ||
                    relativePath.split(SEPARATOR)
                        .some((part) => part !== "..")) &&
                // If its not a common file, ignore.
                dirname(filepath) !== resolve(source.dirpath)
            ) {
                continue;
            }
        }

        switch (event.kind) {
            case "create": {
                if (sources.has(filepath))
                    continue;
                const info = await Deno.stat(filepath);
                if (info.isFile) {
                    sources.add(filepath);
                    log.info(yellow(`watching`), filepath);
                } else {
                    continue;
                }
                break;
            }
            case "modify":
                if (await isFile(filepath) && !sources.has(filepath)) {
                    sources.add(filepath);
                    log.info(yellow(`watching`), filepath);
                }
                break;
            case "remove":
                if (!sources.has(filepath))
                    continue;
                sources.delete(filepath);
                log.info(yellow(`stopped watching`), filepath);
                break;
            case "rename":
                if (await isFile(filepath) && !sources.has(filepath)) {
                    sources.add(filepath);
                    log.info(yellow(`watching`), filepath);
                }
                continue;
            default:
                throw new Error("unhandled event type");
        }

        await writeGenerated(
            locales,
            await featureFn(sources),
            args.outputPath,
        );
    }
}

async function writeGenerated(
    locales: Set<string>,
    generatedOutput: {
        messages: Record<string, Record<string, string>>;
        additional: string | null;
    },
    outputFile: string,
) {
    log.info("generating types");

    const indent = makeIndent(4);

    const availableLocales: string = locales.size > 0
        ? Array.from(locales)
            .map((locale) => `"${locale}"`)
            .reduce((p, locale) => {
                if (p[p.length - 1].length === 5) {
                    p.push([locale]);
                    return p;
                }
                p[p.length - 1].push(locale);
                return p;
            }, [[]] as string[][])
            .map((line) => line.join(" | "))
            .join(`\n${indent(1)}| `)
        : "string";

    const availableMessages: string = Object
        .entries(generatedOutput.messages)
        .map(([messageKey, variables]) => {
            const variableKeys = Object.keys(variables);
            const variableType = variableKeys.length === 0
                ? "never"
                : `{\n${
                    variableKeys.map((key) => {
                        return `${indent(2)}"${key}": ${variables[key]};`;
                    }).join("\n")
                }\n${indent(1)}}`;
            return `${indent(1)}"${messageKey}": ${variableType};`;
        })
        .join("\n");

    const additionalContent = generatedOutput.additional != null
        ? `\n${generatedOutput.additional}\n`
        : "";

    const output = `${GENERATED_FILE_OUTPUT_PREFIX}
${additionalContent}\

type AvailableLocales = ${availableLocales};

type AvailableMessages = {\n${availableMessages}\n};

export type GeneratedLocalesTypings = {
    locales: AvailableLocales;
    messages: AvailableMessages;
};\n`;

    await Deno.writeTextFile(outputFile, output);
    log.info(`written to output file ${resolve(outputFile)}`);
}

async function resolvePath(
    arg: string,
    followSymlinks: boolean,
): Promise<{ path: string; dir: boolean }> {
    const file = await Deno.lstat(arg);
    if (file.isFile || file.isDirectory)
        return { path: resolve(arg), dir: file.isDirectory };
    else if (file.isSymlink && followSymlinks) {
        const resolved = await Deno.readLink(arg);
        return resolvePath(resolved, followSymlinks);
    } else {
        console.error(`'${arg}' is not a file, directory, or symlink.`);
        Deno.exit(1);
    }
}

async function isFile(path: string): Promise<boolean> {
    try {
        const stat = await Deno.lstat(path);
        return stat.isFile;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound)
            return false;
        throw error;
    }
}
