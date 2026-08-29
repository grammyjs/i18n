import { bold, cyan, dim, green } from "@std/fmt/colors";
import {
    basename,
    common,
    dirname,
    extname,
    join,
    relative,
    resolve,
} from "@std/path";
import type { AdapterCliConfig } from "../adapters/mod.ts";
import { createNamespaceResolver, isValidLocale, walk } from "../utilities.ts";
import { GENERATED_FILE_OUTPUT_PREFIX } from "./constants.ts";
import {
    isValidString,
    loadAdapterConfig,
    log,
    makeIndent,
} from "./utilities.ts";
import { debounce } from "@std/async/debounce";
import type { NamespaceResolverFn } from "@grammyjs/i18n";
import chokidar from "chokidar";
import { command } from "cleye";
import { oneOf } from "cleye/formats";
import type {
    GeneratedMessages,
    TypeGenSourceFile,
} from "../adapters/types.ts";

type SourceConfig = {
    mode: "locales-dir";
    dirpath: string;
    fallback: string;
} | {
    mode: "explicit";
    paths: string[];
};

type SharedDirectoryConfig = {
    enabled: true;
    name: string;
    defer: boolean;
} | {
    enabled: false;
};

const NS_STRATEGIES = ["disabled", "file", "directory"] as const;

export default command({
    name: "generate-types",
    help: {
        description:
            "Generate TypeScript types for i18n messages from locale files.",
        // examples: [
        //     "jsr:@grammyjs/i18n/adapter-fluent/cli locales/types.d.ts -d locales -f en",
        // ],
    },
    parameters: [
        "<adapter>",
        "<output>",
        "[paths...]",
        "--",
        "[arguments...]",
    ],
    flags: {
        localesDir: {
            type: String,
            alias: "d",
            description: "Path to the locales directory",
            placeholder: "<DIR>",
        },
        fallback: {
            type: String,
            description:
                "The fallback locale inside the locales directory. Required in locales directory mode",
            alias: "f",
            placeholder: "<locale>",
        },
        watch: {
            type: Boolean,
            alias: "w",
            description: "Run in watch mode (useful for development)",
            default: false,
        },
        followSymlinks: {
            type: Boolean,
            description: "Follow symlinks",
            default: false,
        },
        ignoreDotFiles: {
            type: Boolean,
            description: "Ignore dot (hidden) files",
            default: true,
        },
        nsStrategy: {
            type: oneOf(...NS_STRATEGIES),
            description:
                "Namespace resolution strategy to be used. If unspecified, namespaces are not activated.",
        },
        nsSep: {
            type: String,
            description: "Separator to separate for nested entry path",
            default: "/",
        },
        nsIndexFile: {
            type: String,
            description:
                "Only applied if namespace strategy is set to 'file'. Name of the index file to be used as root file when namespaces are active",
            default: "index",
        },
        shared: {
            type: Boolean,
            description: "Whether to load shared directory or not",
            default: true,
        },
        sharedDir: {
            type: String,
            description:
                "Specify the name of the directory to consider as the shared directory",
            default: "shared",
        },
        deferShared: {
            type: Boolean,
            description:
                "If set to defer, shared directory will be loaded after loading the source files, instead of before",
            default: true,
        },
    },
    booleanFlagNegation: true,
    strictFlags: true,
}, async (argv) => {
    const adapterConfig = await loadAdapterConfig(argv._.adapter)
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

    try {
        await generateTypes(adapterConfig, {
            rawPaths: argv._.paths,
            localesDirectory: argv.flags.localesDir,
            fallbackLocale: argv.flags.fallback,
            followSymlinks: argv.flags.followSymlinks,
            ignoreDotFiles: argv.flags.ignoreDotFiles,
            outputPath: argv._.output,
            watchMode: argv.flags.watch,
            // namespaces
            nsStategy: argv.flags.nsStrategy ?? "disabled",
            nsIndexFile: argv.flags.nsIndexFile,
            nsSep: argv.flags.nsSep,
            // shared
            shared: argv.flags.shared,
            sharedDir: argv.flags.sharedDir,
            deferShared: argv.flags.deferShared,
        }, argv._.arguments);

        // all good
    } catch (error) {
        if (error instanceof CliError) {
            log.error(error.message);
            Deno.exit(1);
        }

        log.error("Unknown error occurred:");
        console.error(error);
        Deno.exit(1);
    }
});

class CliError extends Error {
    constructor(message: string) {
        super(message);
    }
}

type SourceFile = {
    namespace: string | undefined;
    path: string;
};

type GroupedSourceFiles = {
    fallback: SourceFile[];
    shared: SourceFile[];
};

async function generateTypes(adapterConfig: AdapterCliConfig, args: {
    rawPaths: string[];
    localesDirectory?: string;
    fallbackLocale?: string;
    outputPath: string;
    watchMode: boolean;
    ignoreDotFiles: boolean;
    followSymlinks: boolean;
    nsStategy: "disabled" | "file" | "directory";
    nsIndexFile: string;
    nsSep: string;
    shared: boolean;
    sharedDir: string;
    deferShared: boolean;
}, featureArguments: string[]): Promise<void> {
    const featureFn = adapterConfig.features["type-gen"];
    if (typeof featureFn !== "function")
        throw new Error("must be checked inside the run fn");

    // resolve proper configuration structures after validating arguments
    let source: SourceConfig;
    let namespaceResolverFn: NamespaceResolverFn | undefined = undefined;
    let shared: SharedDirectoryConfig;

    if (isValidString(args.localesDirectory)) {
        if (isValidString(args.fallbackLocale)) {
            source = {
                mode: "locales-dir",
                dirpath: resolve(args.localesDirectory),
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
            err("Fallback locale must be specified when locales directory is specified.");
        }
    } else if (isValidString(args.fallbackLocale)) {
        err("Locales directory must be specified when fallback is specified.");
    } else if (
        args.rawPaths.length === 0 ||
        args.rawPaths.every((arg) => !isValidString(arg))
    ) {
        err("Specify at least one file/directory path to read from.");
    } else {
        source = {
            mode: "explicit",
            paths: args.rawPaths,
        };
        log.info(
            "mode resolved to 'explicit', ignoring any shared or namespace configurations specified",
        );
    }

    if (args.nsStategy === "disabled") {
        // keep as-is
    } else if (args.nsStategy === "file") {
        // todo: add logs
        namespaceResolverFn = createNamespaceResolver({
            strategy: "file",
            indexFile: args.nsIndexFile ?? "index",
            separator: args.nsSep ?? "/",
        });
    } else if (args.nsStategy === "directory") {
        namespaceResolverFn = createNamespaceResolver({
            strategy: "directory",
            separator: args.nsSep ?? "/",
        });
    } else {
        err("unknown namespace strategy specified: " + args.nsStategy);
    }

    if (args.shared) {
        shared = {
            enabled: true,
            name: args.sharedDir ?? "shared",
            defer: args.deferShared,
        };
    } else {
        shared = {
            enabled: false,
        };
    }

    // Source files for passing to the adapter types generator
    const sources: GroupedSourceFiles = { fallback: [], shared: [] };
    // Initial set of watchpaths for the FS watcher
    const watchpaths: string[] = [];
    // Locales found under the locales directory
    const locales = new Set<string>();

    if (source.mode === "locales-dir") {
        const localesDir = args.followSymlinks
            ? await Deno.stat(source.dirpath)
            : await Deno.lstat(source.dirpath);

        if (!localesDir.isDirectory)
            err("Specified locales directory is not a directory");

        watchpaths.push(source.dirpath);

        for await (const dirent of Deno.readDir(source.dirpath)) {
            const direntPath = join(source.dirpath, dirent.name);

            if (dirent.isFile) {
                log.info(dim("ignoring root level file: " + direntPath));
                continue;
            }

            if (dirent.isSymlink) {
                if (!args.followSymlinks) {
                    log.info("not following symlink as configured");
                    continue;
                }
                const stat = await Deno.stat(direntPath);
                if (!stat.isDirectory) {
                    log.info("ignoring root level symlink (not points to dir)");
                    continue;
                }
            }

            if (args.ignoreDotFiles && dirent.name.startsWith("."))
                continue;

            // dirent is now either a dir or a symlink that points to a directory.

            if (shared.enabled && dirent.name === shared.name) {
                log.info("found shared directory:", direntPath);

                const itr = walk(direntPath, adapterConfig.extensions, {
                    followSymlinks: args.followSymlinks,
                    ignoreDotFiles: args.ignoreDotFiles,
                });
                for await (const hit of itr) {
                    const relPath = relative(direntPath, hit.logicalPath);
                    const namespace = namespaceResolverFn?.(relPath);
                    sources.shared.push({
                        namespace: namespace,
                        path: hit.logicalPath,
                    });
                }

                continue;
            }

            if (!isValidLocale(dirent.name)) {
                log.info("ignoring entry with invalid locale name");
                continue;
            }

            locales.add(dirent.name);
        }

        if (!locales.has(source.fallback))
            err("could not find fallback locale inside locales dir");

        const fallbackPath = join(source.dirpath, source.fallback);
        const itr = walk(fallbackPath, adapterConfig.extensions, {
            followSymlinks: args.followSymlinks,
            ignoreDotFiles: args.ignoreDotFiles,
        });
        for await (const hit of itr) {
            const relPath = relative(fallbackPath, hit.logicalPath);
            const namespace = namespaceResolverFn?.(relPath);
            sources.fallback.push({
                namespace: namespace,
                path: hit.logicalPath,
            });
        }
    } else {
        // explicit mode
        for (const rawPath of args.rawPaths) {
            const resolved = args.followSymlinks
                ? await Deno.stat(rawPath)
                : await Deno.lstat(rawPath);

            if (!args.followSymlinks && resolved.isSymlink) {
                log.info("ignoring entry as its a symlink", rawPath);
                continue;
            }

            log.info(args.watchMode ? `Watching` : `Reading`, rawPath);

            const itr = walk(rawPath, adapterConfig.extensions, {
                followSymlinks: args.followSymlinks,
                ignoreDotFiles: args.ignoreDotFiles,
            });
            for await (const hit of itr) {
                sources.fallback.push({
                    namespace: undefined,
                    path: hit.logicalPath,
                });
            }
            watchpaths.push(rawPath);
        }
    }

    const total = sources.fallback.length + sources.shared.length;
    console.log(bold(green(`Found ${total} source files`)));

    const cwd = Deno.cwd();
    function printFile(file: SourceFile) {
        const relativePath = relative(cwd, file.path);
        const commonPrefix = common([cwd, file.path]);
        console.log(
            "  *",
            join(dim(commonPrefix), relativePath),
            file.namespace != null ? cyan(`(${file.namespace})`) : "",
        );
    }
    console.log(`Exclusive files (${sources.fallback.length}):`);
    sources.fallback.forEach(printFile);
    if (shared.enabled) {
        console.log(`Shared files (${sources.shared.length}):`);
        sources.shared.forEach(printFile);
    }

    const generateAndWrite = async () => {
        const files = getFilesContentIterable(sources, {
            deferShared: shared.enabled && shared.defer,
        });
        await writeGenerated(
            locales,
            await featureFn(files, featureArguments),
            args.outputPath,
        );
    };

    await generateAndWrite();

    if (!args.watchMode) return;

    /// === Watch Mode

    const debouncedGenerateAndWrite = debounce(generateAndWrite, 500); // todo: configurable wait?

    log.info("Starting file watcher");

    const watcher = chokidar.watch(watchpaths, {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: args.followSymlinks,
        ignored: (path, _stats) => {
            if (args.ignoreDotFiles && basename(path).startsWith("."))
                return true;

            return !!_stats?.isFile() &&
                !adapterConfig.extensions.includes(extname(path));
        },
    });

    async function closeWatcher() {
        log.info("Closing the file watcher");
        await watcher.close();
        log.info("Closed the file watcher");
    }
    Deno.addSignalListener("SIGINT", closeWatcher);
    Deno.addSignalListener("SIGTERM", closeWatcher);

    function matchesExtension(path: string) {
        return adapterConfig.extensions.includes(extname(path));
    }

    watcher.on("error", (error) => {
        if (error instanceof CliError) {
            log.error(error.message);
            Deno.exit(1);
        }

        log.error("Unknown error occurred:");
        console.error(error);
        Deno.exit(1);
    });

    if (source.mode === "locales-dir") {
        const localesDirpath = resolve(source.dirpath);
        const fallbackDirPath = join(localesDirpath, source.fallback);
        const sharedDirPath = shared.enabled
            ? join(localesDirpath, shared.name)
            : undefined;

        watcher.on("addDir", (path) => {
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            if (dirname(path) === localesDirpath) {
                if (shared.enabled && name === shared.name) {
                    log.info("detected shared directory, watching for files");
                } else if (isValidLocale(name)) {
                    log.info("adding new locale:", name);
                    locales.add(name);

                    debouncedGenerateAndWrite(); // todo: could do progressive compilation, as only locales changed
                } else {
                    log.info(
                        "ignoring root level dir due to invalid locale name",
                        path,
                    );
                }
            } else {
                // ignorable, as any other dir that is involved will be a nested one;
                // which is not relevant unless if namespace strat is set to 'dir', but
                // they are handled via a different approach, not by presence of dir.
            }
        });

        watcher.on("add", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            if (path.startsWith(fallbackDirPath)) {
                log.info("adding new fallback source file:", path);
                const relPath = relative(fallbackDirPath, path);
                const namespace = namespaceResolverFn?.(relPath);
                sources.fallback.push({ namespace: namespace, path: path });

                debouncedGenerateAndWrite();
            } else if (
                sharedDirPath != null && path.startsWith(sharedDirPath)
            ) {
                log.info("adding new shared source file:", path);
                const relPath = relative(sharedDirPath, path);
                const namespace = namespaceResolverFn?.(relPath);
                sources.shared.push({ namespace: namespace, path: path });

                debouncedGenerateAndWrite();
            } else {
                // ignorable, as only fallback + shared matters for type generation.
            }
        });

        watcher.on("change", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            if (
                path.startsWith(fallbackDirPath) ||
                (sharedDirPath != null && path.startsWith(sharedDirPath))
            ) {
                log.info("changes detected:", path);
                debouncedGenerateAndWrite();
            }
        });

        watcher.on("unlink", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            if (path.startsWith(fallbackDirPath)) {
                log.info("removing fallback file:", path);
                const index = sources.fallback
                    .findIndex((file) => file.path === path);
                if (index >= 0) {
                    sources.fallback.splice(index, 1);

                    debouncedGenerateAndWrite();
                } else {
                    log.info(
                        "a weird case indeed. file removed, but not in sources? must debug",
                    );
                }
            } else if (
                sharedDirPath != null && path.startsWith(sharedDirPath)
            ) {
                log.info("removing source file:", path);
                const index = sources.shared
                    .findIndex((file) => file.path === path);
                if (index >= 0) {
                    sources.shared.splice(index, 1);

                    debouncedGenerateAndWrite();
                } else {
                    log.info(
                        "a weird case indeed. file removed, but not in sources? must debug",
                    );
                }
            }
        });

        watcher.on("unlinkDir", (path) => {
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            // concerned only if child of the locales directory
            if (dirname(path) === localesDirpath) {
                if (shared.enabled && shared.name === name) {
                    log.info("shared directory removed");
                    sources.shared = [];

                    debouncedGenerateAndWrite();
                } else if (name === source.fallback) {
                    err("fallback gone! it must be present.");
                } else if (locales.has(name)) {
                    log.info("removed locale:", name);
                    locales.delete(name);

                    debouncedGenerateAndWrite();
                }
            }
        });
    } else {
        watcher.on("add", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            log.info("adding file:", path);
            sources.fallback.push({ namespace: undefined, path: path });

            debouncedGenerateAndWrite();
        });

        watcher.on("change", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            log.info("changes detected:", path);
            debouncedGenerateAndWrite();
        });

        watcher.on("unlink", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (args.ignoreDotFiles && name.startsWith(".")) return;

            log.info("removing file:", path);
            const index = sources.fallback
                .findIndex((file) => file.path === path);
            if (index >= 0) {
                sources.fallback.splice(index, 1);

                debouncedGenerateAndWrite();
            } else {
                log.info(
                    "a weird case indeed. file removed, but not in sources? must debug",
                );
            }
        });
    }
}

async function writeGenerated(
    locales: Set<string>,
    generatedOutput: {
        messages: GeneratedMessages;
        additional: string | null;
    },
    outputFile: string,
) {
    log.info("Generating output file...");

    const indent = makeIndent(4);
    const LOCALES_PER_LINE = 5;

    const availableLocales: string = locales.size > 0
        ? Array.from(locales)
            .map((locale) => `"${locale}"`)
            .reduce((p, locale) => {
                if (p[p.length - 1].length === LOCALES_PER_LINE) {
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
    log.info(`Written to output file ${cyan(resolve(outputFile))}`);
}

async function* getFilesContentIterable(
    files: GroupedSourceFiles,
    options: {
        deferShared: boolean;
    },
): AsyncGenerator<TypeGenSourceFile> {
    const combined: SourceFile[] = files.shared.length > 0
        ? options.deferShared
            ? files.fallback.concat(files.shared)
            : files.shared.concat(files.fallback)
        : files.fallback;

    // const seen = new Set<string>(); todo:

    for (const { path, namespace } of combined) {
        try {
            const content = await Deno.readTextFile(path);
            yield { path, namespace, content };
        } catch (error) {
            log.error("failed to read file:", path);
            // these are known hanlded errors, but somehow not handled before reaching here.
            if (
                error instanceof Deno.errors.NotFound ||
                error instanceof Deno.errors.IsADirectory ||
                error instanceof Deno.errors.PermissionDenied
            ) {
                log.error(
                    "critical! must have caught this before. please report this issue", // todo: come back to this
                );
            } else {
                log.error("unhandled error");
                console.error(error);
                Deno.exit(1);
            }
        }
    }
}

function err(message: string): never {
    throw new CliError(message);
}
