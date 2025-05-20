/// <reference types="npm:@types/node" />

import * as fs from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import type { ResourceLoadable } from "./types.ts";
import { createDebug } from "jsr:@grammyjs/debug@0.2.1";

const debug = createDebug("grammy:i18n");

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

/**
 * Utility function for finding and reading translation source files from a
 * standard locales directory. The contents of the files found are passed to the
 * specified adapter.
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
 * @param adapter Format adapter to assign the resources to.
 * @param dirpath Path to the locales directory.
 * @param options Additional options for loading the resource files. File
 * extension must be specified to filter out the files. Resource loading options
 * for the adapter can also be passed through here.
 */
export async function loadLocalesDirectory<T>(
    adapter: ResourceLoadable<T>,
    dirpath: string,
    options: {
        extension: string;
        resourceOptions?: T;
        includeCommonSources?: boolean;
        ignoreDotFiles?: boolean;
        followSymlinks?: boolean;
    },
) {
    dirpath = resolve(dirpath);
    options = {
        followSymlinks: false,
        ignoreDotFiles: true,
        includeCommonSources: true,
        ...options,
    };

    const data: {
        locales: string[];
        common: string[];
    } = { locales: [], common: [] };

    debug(`reading locales directory: ${dirpath}`);

    const dir = await fs.promises.opendir(dirpath);
    for await (const dirent of dir) {
        if (dirent.name.startsWith(".") && options.ignoreDotFiles)
            continue;

        const direntpath = join(dirpath, dirent.name);
        const filepath = options.followSymlinks && dirent.isSymbolicLink()
            ? await fs.promises.realpath(direntpath)
            : direntpath;
        const entry = await fs.promises.lstat(filepath);

        if (
            entry.isFile() && options.includeCommonSources &&
            extname(dirent.name) === options.extension && entry.size > 0
        ) {
            debug(`found common file: ${filepath}`);
            data.common.push(filepath);
        } else if (entry.isDirectory()) {
            if (isValidLocale(dirent.name)) {
                debug(`found locale directory: ${dirent.name}`);
                data.locales.push(dirent.name);
            } else {
                debug(`ignoring locale dir with invalid name ${dirent.name}`);
            }
        } else {
            // symbolic links are already handled, ignore the others
        }
    }

    for (const locale of data.locales) {
        const localeDirPath = join(dirpath, locale);
        debug(`reading locale directory: ${locale}`);

        const itr = walk(localeDirPath, options.extension, {
            followSymlinks: !!options.followSymlinks,
            ignoreDotFiles: !!options.ignoreDotFiles,
        });
        for await (const filepath of itr) {
            debug(`reading resource: ${relative(localeDirPath, filepath)}`);
            const content = await fs.promises.readFile(filepath, "utf8");
            adapter.loadResource(locale, content, options?.resourceOptions);
        }
    }

    if (options.includeCommonSources) {
        for (const filepath of data.common) {
            debug(`reading resource: ${filepath}`);
            const content = await fs.promises.readFile(filepath, "utf8");
            for (const locale of data.locales)
                adapter.loadResource(locale, content, options?.resourceOptions);
        }
    }
}

export async function* walk(
    path: string,
    extension: string,
    options: {
        ignoreDotFiles: boolean;
        followSymlinks: boolean;
    },
): AsyncGenerator<string> {
    const filename = basename(path);
    const stat = await fs.promises.lstat(path);

    if (stat.isFile() && extname(filename) === extension) {
        yield path;
    } else if (stat.isDirectory()) {
        const dir = await fs.promises.opendir(path);
        for await (const dirent of dir) {
            const resolved = join(path, dirent.name);
            if (dirent.name.startsWith(".") && options.ignoreDotFiles)
                continue;
            yield* walk(resolved, extension, options);
        }
    } else if (stat.isSymbolicLink() && options.followSymlinks) {
        const realpath = await fs.promises.realpath(path);
        yield* walk(realpath, extension, options);
    } else {
        // ignore
    }
}
