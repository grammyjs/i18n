import type { NamespaceResolverFn } from "@grammyjs/i18n";
import { debounce } from "@std/async/debounce";
import { blue, bold, cyan, dim, green, underline } from "@std/fmt/colors";
import {
    basename,
    common,
    dirname,
    extname,
    join,
    relative,
    resolve,
} from "@std/path";
import chokidar from "chokidar";
import { command } from "cleye";
import { oneOf } from "cleye/formats";
import type {
    AdapterCliConfig,
    GeneratedMessages,
    TypeGenSourceFile,
} from "../adapters/mod.ts";
import { createNamespaceResolver, isValidLocale, walk } from "../utilities.ts";
import type { CliOptions } from "./config.ts";
import { GENERATED_FILE_OUTPUT_PREFIX } from "./constants.ts";
import {
    cliErr,
    CliError,
    failHard,
    isDefined,
    isValidString,
    loadAdapterConfig,
    loadCliConfig,
    log,
    makeIndent,
    type Paths,
} from "./utilities.ts";

const NS_STRATEGIES = ["disabled", "file", "directory"] as const;

type SourceConfig = {
    mode: "locales-dir";
    dirpath: string;
    fallback: string;
    shared: {
        enabled: true;
        name: string;
        defer: boolean;
    } | {
        enabled: false;
    };
} | {
    mode: "explicit";
    rawPaths: string[];
};

type NsStrategy = typeof NS_STRATEGIES[number];

type ArgvOptions = {
    adapter?: string;
    rawPaths: string[];
    localesDirectory?: string;
    fallbackLocale?: string;
    followSymlinks?: boolean;
    ignoreDotFiles?: boolean;
    outputPath?: string;
    watchMode?: boolean;
    // namespaces
    nsStrategy?: NsStrategy;
    nsIndexFile?: string;
    nsSep?: string;
    // shared
    shared?: boolean;
    sharedDir?: string;
    deferShared?: boolean;
    arguments: string[];
};
type ResolvedConfig = {
    adapter: AdapterCliConfig;
    source: SourceConfig;
    namespaceResolverFn: NamespaceResolverFn | undefined;
    outputPath: string | undefined;
    watchMode: boolean;
    followSymlinks: boolean;
    ignoreDotFiles: boolean;
    featureArguments: string[];
};

type SourceFile = {
    namespace: string | undefined;
    path: string;
};
type GroupedSourceFiles = {
    fallback: SourceFile[];
    shared: SourceFile[];
};

export function configErr<Scope extends "argv" | "config">(
    scope: Scope,
    path: "config" extends Scope ? Paths<CliOptions> : Paths<ArgvOptions>,
    message: string,
): never {
    if (scope === "argv") {
        log.error(`${bold(path)}: ${message}`);
    } else {
        log.error(bold(path), dim("(configuration file)\n\t"), message);
    }
    throw new CliError("invalid input configuration, aborting...");
}

async function resolveConfig(
    argv: ArgvOptions,
    config?: CliOptions,
): Promise<ResolvedConfig> {
    let adapterConfig: AdapterCliConfig;

    if (isValidString(argv.adapter)) {
        adapterConfig = await failHard(
            loadAdapterConfig(argv.adapter),
            "Failed to load the configuration",
        );
    } else if (isDefined(config?.adapter)) {
        if (typeof config?.adapter === "string") {
            adapterConfig = await failHard(
                loadAdapterConfig(config.adapter),
                "Failed to load the configuration",
            );
        } else if (typeof config?.adapter === "object") {
            adapterConfig = config.adapter;
        } else {
            configErr(
                "config",
                "adapter",
                "invalid value, expected an adapter configuration or a module src",
            );
        }
    } else {
        cliErr(
            "format adapter not specified in neither cli arguments nor in configuration file",
        );
    }

    let sourceConfig: SourceConfig;

    if (isValidString(argv.localesDirectory)) {
        if (!isValidString(argv.fallbackLocale))
            configErr("argv", "fallbackLocale", "required");

        if (argv.shared) {
            if (!isValidString(argv.sharedDir))
                configErr(
                    "argv",
                    "sharedDir",
                    "required when shared is enabled",
                );
        }

        sourceConfig = {
            mode: "locales-dir",
            dirpath: resolve(argv.localesDirectory),
            fallback: argv.fallbackLocale,
            shared: argv.shared == null || argv.shared
                ? {
                    enabled: true,
                    name: argv.sharedDir ?? "shared",
                    defer: argv.deferShared ?? true,
                }
                : { enabled: false },
        };
        if (argv.rawPaths.length > 0) {
            log.info(
                "Path arguments and locales directory cannot be used together.",
            );
            log.info("Ignoring path arguments...");
            argv.rawPaths.splice(0, argv.rawPaths.length);
        }
    } else if (isValidString(argv.fallbackLocale)) {
        configErr(
            "argv",
            "fallbackLocale",
            "locales directory must be specified",
        );
    } else if (argv.rawPaths.length > 0) {
        if (argv.rawPaths.some((rawPath) => !isValidString(rawPath)))
            configErr(
                "argv",
                "rawPaths",
                "Specify at least one file/directory path to read from.",
            );
        sourceConfig = { mode: "explicit", rawPaths: argv.rawPaths };
    } else if (isDefined(config?.sources)) {
        if (Array.isArray(config.sources)) {
            sourceConfig = { mode: "explicit", rawPaths: config.sources };
        } else if (typeof config.sources === "object") {
            if (!isValidString(config.sources.path))
                configErr(
                    "config",
                    "sources.path",
                    "invalid value, expected path",
                );
            if (!isValidString(config.sources.fallbackLocale))
                configErr(
                    "config",
                    "sources.fallbackLocale",
                    "invalid value, expected string",
                );

            if (
                isDefined(config.sources.shared) &&
                typeof config.sources.shared !== "boolean" &&
                !isValidString(config.sources.shared)
            )
                configErr(
                    "config",
                    "sources.shared",
                    "invalid value, expected either string or boolean",
                );

            if (
                isDefined(config.sources.deferShared) &&
                typeof config.sources.deferShared !== "boolean"
            )
                configErr(
                    "config",
                    "sources.deferShared",
                    "invalid value, expected boolean",
                );

            sourceConfig = {
                mode: "locales-dir",
                dirpath: resolve(config.sources.path),
                fallback: config.sources.fallbackLocale,
                shared: typeof config.sources.shared === "boolean" &&
                        config.sources.shared == false
                    ? { enabled: false }
                    : {
                        enabled: true,
                        name: typeof config.sources.shared === "string"
                            ? config.sources.shared
                            : "shared",
                        defer: config.sources.deferShared ?? true,
                    },
            };
        } else {
            configErr(
                "config",
                "sources",
                "invalid value, expected an array of paths or a locales dir configuration",
            );
        }
    } else {
        cliErr("no source files or a locales dir was specified");
    }

    let namespaceResolverFn: NamespaceResolverFn | undefined;

    if (isDefined(argv.nsStrategy)) {
        if (argv.nsStrategy === "file") {
            namespaceResolverFn = createNamespaceResolver({
                strategy: "file",
                indexFile: argv.nsIndexFile ?? "index",
                separator: argv.nsSep ?? "/",
            });
        } else if (argv.nsStrategy === "directory") {
            namespaceResolverFn = createNamespaceResolver({
                strategy: "directory",
                separator: argv.nsSep,
            });
        } else if (argv.nsStrategy === "disabled") {
            namespaceResolverFn = undefined;
        } else {
            configErr(
                "argv",
                "nsStrategy",
                "invalid value, expected one of 'disabled', 'file', 'directory' if specified",
            );
        }
    } else if (isDefined(config?.resolveNamespace)) {
        namespaceResolverFn = config.resolveNamespace;
    }

    let outputPath: string | undefined;
    if (isValidString(argv.outputPath)) {
        outputPath = argv.outputPath;
    } else if (isDefined(config?.types)) {
        if (!isValidString(config.types.out))
            configErr("config", "types.out", "invalid value, expected path");
        outputPath = config.types.out;
    }

    let featureArguments: string[] = [];
    if (Array.isArray(argv.arguments)) {
        featureArguments = argv.arguments;
    } else if (isDefined(config?.types?.args)) {
        if (
            !Array.isArray(config.types.args) ||
            config.types.args.some((arg) => typeof arg !== "string")
        ) {
            configErr(
                "config",
                "types.args",
                "invalid value, expected array of string",
            );
        }
        featureArguments = config.types.args;
    }

    return {
        adapter: adapterConfig,
        source: sourceConfig,
        namespaceResolverFn: namespaceResolverFn,
        outputPath: outputPath,
        watchMode: argv.watchMode ?? false,
        followSymlinks: argv.followSymlinks ?? config?.followSymlinks ?? false,
        ignoreDotFiles: argv.ignoreDotFiles ?? config?.ignoreDotFiles ?? true,
        featureArguments: featureArguments,
    };
}

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
        "[adapter]",
        "[output]",
        "[paths...]",
        "--",
        "[arguments...]",
    ],
    flags: {
        config: {
            type: String,
            alias: "c",
            description: "Path to the configuration file.",
            placeholder: dim("y18n.config.ts"),
        },
        localesDir: {
            type: String,
            alias: "d",
            description: "Path to the locales directory.",
            placeholder: "<DIR>",
        },
        fallback: {
            type: String,
            description:
                "The fallback locale inside the locales directory. Required in locales directory mode.",
            alias: "f",
            placeholder: "<locale>",
        },
        watch: {
            type: Boolean,
            alias: "w",
            description:
                "Run in watch mode (useful for development). (default: false)",
        },
        followSymlinks: {
            type: Boolean,
            description: "Follow symlinks. (default: true)",
        },
        ignoreDotFiles: {
            type: Boolean,
            description: "Ignore dot (hidden) files. (default: true)",
        },
        nsStrategy: {
            type: oneOf(...NS_STRATEGIES),
            description:
                'Namespace resolution strategy to be used. If unspecified, namespaces are not activated. (default: "disabled")',
        },
        nsSep: {
            type: String,
            description:
                'Separator to separate for nested entry path. (default: "/")',
            placeholder: dim("/"),
        },
        nsIndexFile: {
            type: String,
            description:
                'Only applied if namespace strategy is set to "file". Name of the index file to be used as root file when namespaces are active. (default: "index")',
            placeholder: dim("index"),
        },
        shared: {
            type: Boolean,
            description:
                "Whether to load shared directory or not. (default: true)",
        },
        sharedDir: {
            type: String,
            description:
                'Specify the name of the directory to consider as the shared directory. (default: "shared")',
            placeholder: dim("shared"),
        },
        deferShared: {
            type: Boolean,
            description:
                "If set to defer, shared directory will be loaded after loading the source files, instead of before (default: true)",
        },
    },
    booleanFlagNegation: true,
    strictFlags: true,
}, async (argv) => {
    try {
        let config: CliOptions | undefined = undefined;

        if (argv.flags.config != null)
            config = await loadCliConfig(argv.flags.config);

        const resolved = await resolveConfig({
            adapter: argv._.adapter,
            rawPaths: argv._.paths,
            localesDirectory: argv.flags.localesDir,
            fallbackLocale: argv.flags.fallback,
            followSymlinks: argv.flags.followSymlinks,
            ignoreDotFiles: argv.flags.ignoreDotFiles,
            outputPath: argv._.output,
            watchMode: argv.flags.watch,
            // namespaces
            nsStrategy: argv.flags.nsStrategy,
            nsIndexFile: argv.flags.nsIndexFile,
            nsSep: argv.flags.nsSep,
            // shared
            shared: argv.flags.shared,
            sharedDir: argv.flags.sharedDir,
            deferShared: argv.flags.deferShared,
            arguments: argv._.arguments,
        }, config);

        if (
            !("type-gen" in resolved.adapter.features) ||
            typeof resolved.adapter.features["type-gen"] !== "function"
        ) {
            cliErr("Feature not supported by adapter: type-gen");
        }

        if (resolved.outputPath == null && resolved.watchMode == true) {
            // todo: if output path is null => stdout. so, watch-mode is useless, rght?
            // so, should i throw like this, or change watch-mode to false?
            cliErr(
                "Watch-mode cannot be enabled when output path is unspecified",
            );
        }

        await generateTypes(resolved);

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

async function generateTypes(config: ResolvedConfig): Promise<void> {
    const featureFn = config.adapter.features["type-gen"];
    if (typeof featureFn !== "function")
        throw new Error("must be checked inside the config resolve fn");

    // Source files for passing to the adapter types generator
    const sources: GroupedSourceFiles = { fallback: [], shared: [] };
    // Initial set of watchpaths for the FS watcher
    const watchpaths: string[] = [];
    // Locales found under the locales directory
    const locales = new Set<string>();

    if (config.source.mode === "locales-dir") {
        const ld = config.source;
        const stat = config.followSymlinks
            ? await Deno.stat(ld.dirpath)
            : await Deno.lstat(ld.dirpath);

        if (!stat.isDirectory)
            cliErr("Specified locales directory is not a directory");

        watchpaths.push(ld.dirpath);

        for await (const dirent of Deno.readDir(ld.dirpath)) {
            const direntPath = join(ld.dirpath, dirent.name);

            if (dirent.isFile) {
                log.info(dim("ignoring root level file: " + direntPath));
                continue;
            }

            if (dirent.isSymlink) {
                if (!config.followSymlinks) {
                    log.info("not following symlink as configured");
                    continue;
                }
                const stat = await Deno.stat(direntPath);
                if (!stat.isDirectory) {
                    log.info("ignoring root level symlink (not points to dir)");
                    continue;
                }
            }

            if (config.ignoreDotFiles && dirent.name.startsWith("."))
                continue;

            // dirent is now either a dir or a symlink that points to a directory.

            if (
                ld.shared.enabled &&
                dirent.name === ld.shared.name
            ) {
                log.info(dim("found shared directory:" + direntPath));

                const itr = walk(direntPath, config.adapter.extensions, {
                    followSymlinks: config.followSymlinks,
                    ignoreDotFiles: config.ignoreDotFiles,
                });
                for await (const hit of itr) {
                    const relPath = relative(direntPath, hit.logicalPath);
                    const namespace = config.namespaceResolverFn?.(relPath);
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

        if (!locales.has(ld.fallback))
            cliErr("could not find fallback locale inside locales dir");

        const fallbackPath = join(
            ld.dirpath,
            ld.fallback,
        );
        const itr = walk(fallbackPath, config.adapter.extensions, {
            followSymlinks: config.followSymlinks,
            ignoreDotFiles: config.ignoreDotFiles,
        });
        for await (const hit of itr) {
            const relPath = relative(fallbackPath, hit.logicalPath);
            const namespace = config.namespaceResolverFn?.(relPath);
            sources.fallback.push({
                namespace: namespace,
                path: hit.logicalPath,
            });
        }
    } else {
        // explicit mode
        for (const rawPath of config.source.rawPaths) {
            const resolved = config.followSymlinks
                ? await Deno.stat(rawPath)
                : await Deno.lstat(rawPath);

            if (!config.followSymlinks && resolved.isSymlink) {
                log.info("ignoring entry as its a symlink", rawPath);
                continue;
            }

            log.info(config.watchMode ? `Watching` : `Reading`, rawPath);

            const itr = walk(rawPath, config.adapter.extensions, {
                followSymlinks: config.followSymlinks,
                ignoreDotFiles: config.ignoreDotFiles,
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
    log.info(bold(blue(`Found ${total} source files:`)));

    const cwd = Deno.cwd();
    function printFile(file: SourceFile, shared = false) {
        const relativePath = relative(cwd, file.path);
        const commonPrefix = common([cwd, file.path]);
        console.log(
            shared ? "  ~" : "  *",
            join(dim(commonPrefix), relativePath),
            file.namespace != null ? cyan(`(${file.namespace})`) : "",
        );
    }
    sources.fallback.forEach((f) => printFile(f));
    if (sources.shared.length > 0)
        sources.shared.forEach((f) => printFile(f, true));

    const generateAndWrite = async () => {
        const start = Date.now();

        const files = getFilesContentIterable(sources, {
            deferShared: config.source.mode === "locales-dir" &&
                config.source.shared.enabled && config.source.shared.defer,
        });

        log.info("Generating output file...");

        const generatedTypes = await featureFn(files, config.featureArguments);
        const content = generateOutputFileContent(locales, generatedTypes);
        if (config.outputPath != null) {
            await Deno.writeTextFile(config.outputPath, content);
            log.info(
                `Written to output file ${
                    underline(resolve(config.outputPath))
                }`,
            );
        } else {
            console.log(content);
        }

        log.info(green(
            `Done in ${Date.now() - start}ms, extracted ${
                Object.keys(generatedTypes.messages).length
            } messages`,
        ));
    };

    await generateAndWrite();

    if (!config.watchMode) return;

    /// === Watch Mode

    const debouncedGenerateAndWrite = debounce(generateAndWrite, 500); // todo: configurable wait?

    log.info("Starting file watcher");

    const watcher = chokidar.watch(watchpaths, {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: config.followSymlinks,
        ignored: (path, _stats) => {
            if (config.ignoreDotFiles && basename(path).startsWith("."))
                return true;

            return !!_stats?.isFile() &&
                !config.adapter.extensions.includes(extname(path));
        },
    });

    async function closeWatcher() {
        log.info(dim("Closing the file watcher"));
        await watcher.close();
    }
    Deno.addSignalListener("SIGINT", closeWatcher);
    Deno.addSignalListener("SIGTERM", closeWatcher);

    function matchesExtension(path: string) {
        return config.adapter.extensions.includes(extname(path));
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

    if (config.source.mode === "locales-dir") {
        const ld = config.source;

        const localesDirpath = resolve(ld.dirpath);
        const fallbackDirPath = join(localesDirpath, ld.fallback);
        const sharedDirPath = ld.shared.enabled
            ? join(localesDirpath, ld.shared.name)
            : undefined;

        watcher.on("addDir", (path) => {
            const name = basename(path);
            if (config.ignoreDotFiles && name.startsWith(".")) return;

            if (dirname(path) === localesDirpath) {
                if (ld.shared.enabled && name === ld.shared.name) {
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
            if (config.ignoreDotFiles && name.startsWith(".")) return;

            if (path.startsWith(fallbackDirPath)) {
                log.info("adding new fallback source file:", path);
                const relPath = relative(fallbackDirPath, path);
                const namespace = config.namespaceResolverFn?.(relPath);
                sources.fallback.push({ namespace: namespace, path: path });

                debouncedGenerateAndWrite();
            } else if (
                sharedDirPath != null && path.startsWith(sharedDirPath)
            ) {
                log.info("adding new shared source file:", path);
                const relPath = relative(sharedDirPath, path);
                const namespace = config.namespaceResolverFn?.(relPath);
                sources.shared.push({ namespace: namespace, path: path });

                debouncedGenerateAndWrite();
            } else {
                // ignorable, as only fallback + shared matters for type generation.
            }
        });

        watcher.on("change", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (config.ignoreDotFiles && name.startsWith(".")) return;

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
            if (config.ignoreDotFiles && name.startsWith(".")) return;

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
            if (config.ignoreDotFiles && name.startsWith(".")) return;

            // concerned only if child of the locales directory
            if (dirname(path) === localesDirpath) {
                if (ld.shared.enabled && ld.shared.name === name) {
                    log.info("shared directory removed");
                    sources.shared = [];

                    debouncedGenerateAndWrite();
                } else if (name === ld.fallback) {
                    cliErr("fallback gone! it must be present.");
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
            if (config.ignoreDotFiles && name.startsWith(".")) return;

            log.info("adding file:", path);
            sources.fallback.push({ namespace: undefined, path: path });

            debouncedGenerateAndWrite();
        });

        watcher.on("change", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (config.ignoreDotFiles && name.startsWith(".")) return;

            log.info("changes detected:", path);
            debouncedGenerateAndWrite();
        });

        watcher.on("unlink", (path) => {
            if (!matchesExtension(path)) return;
            const name = basename(path);
            if (config.ignoreDotFiles && name.startsWith(".")) return;

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

function generateOutputFileContent(
    locales: Set<string>,
    generatedOutput: {
        messages: GeneratedMessages;
        namespaces: Set<string>;
        additional: string | null;
    },
): string {
    const indent = makeIndent(4);

    function stringUnion(values: string[], perLine: number = 5): string {
        return values
            .map((value) => `"${value}"`)
            .reduce((p, value) => {
                if (p[p.length - 1].length === perLine) {
                    p.push([value]);
                    return p;
                }
                p[p.length - 1].push(value);
                return p;
            }, [[]] as string[][])
            .map((line) => line.join(" | "))
            .join(`\n${indent(1)}| `);
    }

    const availableLocales: string = locales.size > 0
        ? stringUnion(Array.from(locales))
        : "string";

    const availableNamespaces: string = generatedOutput.namespaces.size > 0
        ? stringUnion(Array.from(generatedOutput.namespaces))
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

    return `${GENERATED_FILE_OUTPUT_PREFIX}
${additionalContent}\

type AvailableLocales = ${availableLocales};

type AvailableNamespaces = ${availableNamespaces};

type AvailableMessages = {\n${availableMessages}\n};

export type GeneratedLocalesTypings = {
    locales: AvailableLocales;
    namespaces: AvailableNamespaces;
    messages: AvailableMessages;
};\n`;
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
