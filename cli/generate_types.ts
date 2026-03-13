import { dim, yellow } from "@std/fmt/colors";
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
import { defineCommand, type ParsedArgs } from "citty";
import { isValidLocale, walk } from "../utilities.ts";
import { OUTPUT_PREFIX } from "./constants.ts";
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
        await generateTypes(ctx.args);
    },
});

type NonFunction<T> = T extends (...args: unknown[]) => unknown ? never : T;
type X = NonFunction<Awaited<NonNullable<typeof command["args"]>>>;

async function generateTypes({ _: pathArgs, ...args }: ParsedArgs<X>) {
    let source: SourceConfig;

    if (isValidString(args["locales-dir"])) {
        if (isValidString(args.fallback)) {
            source = {
                mode: "locales-dir",
                dirpath: args["locales-dir"],
                fallback: args.fallback,
            };
            if (pathArgs.length > 0) {
                log.info(
                    "Path arguments and --locales-dir cannot be used together. Ignoring path arguments...",
                );
                pathArgs.splice(0, pathArgs.length);
            }
        } else {
            log.error(
                "--fallback must be specified when --locale-dir is used.",
            );
            Deno.exit(1);
        }
    } else if (isValidString(args.fallback)) {
        log.error("--locales-dir must be specified when --fallback is used.");
        Deno.exit(1);
    } else if (
        pathArgs.length === 0 ||
        pathArgs.every((arg) => !isValidString(arg))
    ) {
        log.error("Specify at least one file/directory path to read from.");
        Deno.exit(1);
    } else {
        source = {
            mode: "explicit",
            paths: pathArgs,
        };
    }

    log.info("Reading adapter configuration:", dim(args.adapter));

    const config = await loadAdapterConfig(args.adapter)
        .then((config) => config)
        .catch((error) => {
            console.error(error);
            if (error instanceof Error) log.error(error.message);
            else log.error("Failed to load the configuration");
            Deno.exit(1);
        });

    if (
        !("type-gen" in config.features) ||
        typeof config.features["type-gen"] !== "function"
    )
        throw new Error("Type-gen is not supported by this adapter");

    const generateTypes = config.features["type-gen"];

    const sources = new Set<string>();

    const watchpaths: string[] = [];

    const locales = new Set<string>();
    if (source.mode === "locales-dir") {
        const localesDir = await resolvePath(
            source.dirpath,
            args["follow-symlinks"],
        );
        if (!localesDir.dir) {
            log.error("--locales-dir is not a directory");
            Deno.exit(1);
        }
        for await (const dirent of Deno.readDir(localesDir.path)) {
            if (dirent.isDirectory) {
                locales.add(dirent.name);
            } else if (
                dirent.isFile &&
                config.extensions.includes(extname(dirent.name))
            ) {
                const filepath = resolve(localesDir.path, dirent.name);
                sources.add(filepath);
            } else if (dirent.isSymlink) {
                // todo: if directory, watch the realpath, else: source the file
            }
        }
        if (!locales.has(source.fallback)) {
            log.error("Could not find --fallback inside --locales-dir");
            Deno.exit(1);
        }

        log.info(
            yellow(args.watch ? `watching` : `reading`),
            localesDir.path,
            "files and files inside",
            join(localesDir.path, source.fallback),
        );

        for await (
            const file of walk(
                join(localesDir.path, source.fallback),
                config.extensions,
                {
                    followSymlinks: args["follow-symlinks"],
                    ignoreDotFiles: args["ignore-dot-files"],
                },
            )
        ) {
            sources.add(file);
        }

        watchpaths.push(localesDir.path);
    } else {
        for (const arg of pathArgs) {
            const resolved = await resolvePath(arg, args["follow-symlinks"]);
            log.info(
                yellow(args.watch ? `watching` : `reading`),
                resolved.path,
            );
            for await (
                const file of walk(
                    resolved.path,
                    config.extensions,
                    {
                        followSymlinks: args["follow-symlinks"],
                        ignoreDotFiles: args["ignore-dot-files"],
                    },
                )
            ) {
                sources.add(file);
            }
            watchpaths.push(resolved.path);
        }
    }

    await writeGenerated(locales, await generateTypes(sources), args.output);
    if (!args.watch)
        Deno.exit(0);

    log.info("starting file watcher");

    using watcher = Deno.watchFs(watchpaths, { recursive: true });
    function closeWatcher() {
        log.info("closing the file watcher");
        watcher.close();
    }

    const resolvedLocalesDirpath = source.mode === "locales-dir"
        ? resolve(source.dirpath)
        : undefined;

    for await (const event of watcher) {
        const filepath = event.paths[0];

        if (event.paths.length !== 1)
            continue;
        if (
            event.kind !== "create" && event.kind !== "modify" &&
            event.kind !== "remove"
        ) {
            continue;
        }

        if (
            source.mode === "locales-dir" &&
            dirname(filepath) === resolvedLocalesDirpath
        ) {
            const localeName = basename(filepath);
            try {
                const stat = await Deno.stat(
                    args["follow-symlinks"]
                        ? await Deno.realPath(filepath)
                        : filepath,
                );

                if (stat.isDirectory) {
                    if (isValidLocale(localeName)) {
                        locales.add(localeName);
                        await writeGenerated(
                            locales,
                            await generateTypes(sources),
                            args.output,
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
                    if (localeName === args.fallback) {
                        log.error(
                            "Fallback locale directory no longer exists. Exiting...",
                        );
                        closeWatcher();
                        Deno.exit(1);
                    }
                    locales.delete(localeName);
                    await writeGenerated(
                        locales,
                        await generateTypes(sources),
                        args.output,
                    );
                } else {
                    log.error("Some error occurred:");
                    console.error(error);
                }
            }

            continue;
        }

        if (!config.extensions.includes(extname(filepath)))
            continue;

        if (source.mode === "locales-dir") {
            const parent = resolve(source.dirpath, source.fallback);
            const relativePath = relative(filepath, parent);
            if (
                (isAbsolute(relativePath) ||
                    relativePath.split(SEPARATOR)
                        .some((part) => part !== "..")) &&
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
        }

        await writeGenerated(
            locales,
            await generateTypes(sources),
            args.output,
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

    const output = `${OUTPUT_PREFIX}
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
