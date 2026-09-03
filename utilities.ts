import * as fs from "node:fs";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { createDebug } from "@grammyjs/debug";
import type {
    CreateNamespaceResolverOptions,
    LoadLocalesDirectoryConfig,
    NamespaceResolverFn,
    ResourceLoadable,
} from "./types.ts";

const debug = createDebug("grammy:i18n");

// todo: decide what is considered "valid", simply a non-empty string, or 100 % correct IETF tag?
/**
 * A basic IETF tag validator. Doesn't bother about lengths of the subtags, yet.
 *
 * @see https://en.wikipedia.org/wiki/IETF_language_tag#Syntax_of_language_tags
 */
export function isValidLocale(locale: string): boolean {
    if (typeof locale !== "string")
        return false;
    return locale.split("-")
        .map((subtag) => subtag.trim())
        .every((subtag) => subtag.length > 0 && !/[^a-zA-Z0-9]/.test(subtag));
}

const DEFAULT_NAMESPACE_NESTING_SEPARATOR = "/";

export function createNamespaceResolver(
    options: CreateNamespaceResolverOptions,
): NamespaceResolverFn {
    const separator = options.separator ?? DEFAULT_NAMESPACE_NESTING_SEPARATOR;

    if (options.strategy === "directory") {
        return (
            relativeFilepath: string,
            _locale?: string,
        ): string | undefined => {
            const segments = dirname(relativeFilepath).split(sep)
                .filter((s) => s !== ".");

            return segments.length === 0 ? undefined : segments.join(separator);
        };
    } else if (options.strategy === "file") {
        const resolveExtension = options.resolveExtension ?? extname;

        return (
            relativeFilepath: string,
            _locale?: string,
        ): string | undefined => {
            const segments = dirname(relativeFilepath).split(sep)
                .filter((s) => s !== ".");

            const extension = resolveExtension(relativeFilepath);
            const filename = basename(relativeFilepath, extension);

            if (filename !== options.indexFile)
                segments.push(filename);

            return segments.length === 0 ? undefined : segments.join(separator);
        };
    } else {
        throw new Error("Invalid namespace resolver strategy");
    }
}

/**
 * Utility function for finding, reading translation source files from a
 * standard locales directory, and passing the contents to the attached
 * adapter.
 *
 * A standard locales directory looks like this (using Fluent as example):
 *
 * ```asciiart
 * locales/
 * ├── de/
 * │   └── main.ftl
 * ├── en/
 * │   ├── nested/
 * │   │   └── buttons.ftl
 * │   ├── help.ftl
 * │   └── main.ftl
 * ├── ru/
 * │   └── main.ftl
 * ├── common.ftl
 * └── another-common.ftl
 * ```
 *
 * It should contain directories with corresponding locale names. Such locale
 * directories can have the translation sources split into multiple files if
 * needed. Nested directories are also supported.
 *
 * If you have common files that you need to have registered in all the locales,
 * regardless of the actual locale, then such files can be placed in the root of the directory.
 *
 * @param adapter Format adapter to assign the resources to.
 * @param dirpath Path to the locales directory.
 * @param options Additional options for loading the resource files. File
 * extension must be specified to filter out the files. Resource loading options
 * for the adapter can also be passed through here.
 */
export async function loadLocalesDirectory<T>(
    adapter: ResourceLoadable<T>,
    dirpath: string,
    options: LoadLocalesDirectoryConfig<T>,
): Promise<void> {
    options = {
        followSymlinks: false,
        ignoreDotFiles: true,
        ...options,
    };

    // defaults
    options.sharedDirectoryLoading ??= "after-locales";
    options.sharedDirectoryName ??= "shared";

    if (
        options.sharedDirectoryLoading !== "after-locales" &&
        options.sharedDirectoryLoading !== "before-locales" &&
        options.sharedDirectoryLoading !== "disabled"
    ) {
        throw new Error(
            `Unknown value for shared directory loading preference: '${options.sharedDirectoryLoading}'`,
        );
    }

    const data: {
        locales: string[];
        hasSharedDirectory: boolean;
    } = {
        locales: [],
        hasSharedDirectory: false,
    };

    debug(`reading locales directory: ${dirpath}`);

    const dir = await fs.promises.opendir(dirpath);
    for await (const dirent of dir) {
        if (dirent.name.startsWith(".") && options.ignoreDotFiles)
            continue;

        const direntpath = join(dirpath, dirent.name);
        const filepath = options.followSymlinks && dirent.isSymbolicLink()
            ? await fs.promises.realpath(direntpath)
            : direntpath;
        const stat = await fs.promises.lstat(filepath);

        if (!stat.isDirectory()) {
            debug(`ignoring non-dir root entry: ${filepath}`);
            continue;
        }

        if (
            options.sharedDirectoryLoading !== "disabled" &&
            dirent.name === options.sharedDirectoryName
        ) {
            debug(`found shared directory: ${dirent.name}`);
            data.hasSharedDirectory = true;
        } else if (isValidLocale(dirent.name)) {
            debug(`found locale directory: ${dirent.name}`);
            data.locales.push(dirent.name);
        } else {
            debug(`ignoring locale dir with invalid name ${dirent.name}`);
        }

        // symbolic links are already handled, ignore the others
    }

    async function walkResourcesIntoLocales(
        resourceDirPath: string,
        locales: string[],
    ): Promise<void> {
        debug(`reading directory: ${resourceDirPath}`);

        const itr = walk(resourceDirPath, options.extensions, {
            followSymlinks: !!options.followSymlinks,
            ignoreDotFiles: !!options.ignoreDotFiles,
        });

        for await (const { filepath, logicalPath } of itr) {
            debug(`reading resource: ${relative(resourceDirPath, filepath)}`);
            const content = await fs.promises.readFile(filepath, "utf8");
            const relativeLogicalPath = relative(resourceDirPath, logicalPath);
            debug({
                filepath,
                resourceDirPath,
                logicalPath,
                relativeLogicalPath,
            });
            const namespace = options?.resolveNamespace?.(relativeLogicalPath);

            for (const locale of locales) {
                debug(
                    `loading ${filepath}, locale: ${locale}, ns: ${namespace}`,
                );
                adapter.loadResource(
                    locale,
                    content,
                    namespace,
                    options?.resourceOptions,
                );
            }
        }
    }

    async function loadSharedDirectory(dirname: string) {
        const sharedPath = join(dirpath, dirname);
        debug(
            `loading shared directory: ${sharedPath} to locales:`,
            data.locales,
        );
        await walkResourcesIntoLocales(sharedPath, data.locales);
    }

    if (
        options.sharedDirectoryLoading === "before-locales" &&
        data.hasSharedDirectory
    ) {
        await loadSharedDirectory(options.sharedDirectoryName);
    }

    for (const locale of data.locales) {
        const localeDirPath = join(dirpath, locale);
        debug(`loading resources from ${localeDirPath} to locale ${locale}`);
        await walkResourcesIntoLocales(localeDirPath, [locale]);
    }

    if (
        options.sharedDirectoryLoading === "after-locales" &&
        data.hasSharedDirectory
    ) {
        await loadSharedDirectory(options.sharedDirectoryName);
    }
}

export async function* walk(
    path: string,
    extensions: string[],
    options: {
        ignoreDotFiles: boolean;
        followSymlinks: boolean;
    },
    logicalPath = path,
): AsyncGenerator<{ filepath: string; logicalPath: string }> {
    const filename = basename(logicalPath);
    const stat = await fs.promises.lstat(path);

    if (stat.isFile() && extensions.includes(extname(filename))) {
        yield {
            filepath: path,
            logicalPath: logicalPath,
        };
    } else if (stat.isDirectory()) {
        const dir = await fs.promises.opendir(path);
        for await (const dirent of dir) {
            if (dirent.name.startsWith(".") && options.ignoreDotFiles)
                continue;
            yield* walk(
                join(path, dirent.name),
                extensions,
                options,
                join(logicalPath, dirent.name),
            );
        }
    } else if (stat.isSymbolicLink() && options.followSymlinks) {
        const realpath = await fs.promises.realpath(path);
        yield* walk(realpath, extensions, options, logicalPath);
    } else {
        // ignore
    }
}

/// todo: global variable context?
