/// <reference types="npm:@types/node@^25" />
// ^ todo: removable? ask someone who knows.

import { expect } from "@std/expect";
import { after, before, describe, it } from "node:test";
import { type Stub, stub } from "@std/testing/mock";
import * as fs from "node:fs";
import { normalize } from "node:path";
import type { NamespaceResolverFn, ResourceLoadable } from "./types.ts";
import {
    createNamespaceResolver,
    isValidLocale,
    loadLocalesDirectory,
    walk,
} from "./utilities.ts";

describe("locale string validation", () => {
    it("should be a string", () => {
        // @ts-expect-error only string is allowed type-wise.
        expect(isValidLocale(1)).toBe(false);
        // @ts-expect-error only string is allowed type-wise.
        expect(isValidLocale(null)).toBe(false);
        // @ts-expect-error only string is allowed type-wise.
        expect(isValidLocale(true)).toBe(false);
        // @ts-expect-error only string is allowed type-wise.
        expect(isValidLocale({})).toBe(false);
        // @ts-expect-error only string is allowed type-wise.
        expect(isValidLocale([])).toBe(false);
        expect(isValidLocale("en")).toBe(true);
    });

    it("should be valid", () => {
        const good = [
            "en",
            "fr-CA",
            "zh-Hant-TW",
            "de-AT",
            "sr-Cyrl",
            "es-419",
            "ja-JP-u-ca-japanese",
            "und",
            "ar-SA",
            "hi-IN",
            "pt-BR-abnt2",
            "x-pirate",
            "mul",
            "az-Latn-AZ",
            "sl-nedis",
            "en-US-u-em-emoji",
            "ku-Arab-IQ",
            "i-default",
            "de-CH-1901",
            "sgn-US",
            "zh-min-nan",
            "th-Thai",
            "el-Grek",
            "fr-x-verlan",
            "ru-RU-u-tz-moscow",
            "pa-Guru",
            "hy-Armn",
            "art-lojban",
            "it-x-lombard",
            "ps-Arab-AF",
            "zxx",
            "mn-Cyrl-MN",
            "nl-x-brabant",
            "qaa",
            "sr-Latn-RS",
            "en-GB-oxendict",
            "zh-Hans-CN",
            "es-MX",
            "he-Hebr",
            "ka-Geor",
            "tg-Cyrl-TJ",
            "fr-FR-u-hc-h12",
            "x-klingon",
            "uz-Latn-UZ",
            "sw-KE",
            "bn-BD",
            "pt-PT-u-va-posix",
        ];
        for (const locale of good) {
            expect(isValidLocale(locale)).toBe(true);
        }
    });

    it("should not be valid", () => {
        // not all of the following cases are covered.
        const bad = [
            "en-", // Trailing hyphen
            "-US", // Missing primary language
            // "123", // Numeric primary tag
            "en_GB", // Underscore instead of hyphen
            // "eng", // 3-letter primary tag (invalid for English)
            // "xx-YY", // Nonexistent language + region
            // "zh-ABCD", // Invalid script subtag
            // "de-DE-1901-1901", // Duplicate variant
            // "es-LATN", // Script in wrong case (must be titlecase)
            // "fr-CA-x", // Empty private-use extension
            "x-", // Empty private-use prefix
            // "i", // Incomplete grandfathered tag
            "en-US-u-", // Empty Unicode extension
            "zh-Hans-CN-", // Trailing hyphen
            // "sr-Cyrl-Latn", // Conflicting scripts
            // "en-emoji", // Invalid variant (no prefix)
            // "pt-BR-ABNT2", // Variant in wrong case (must be lowercase)
            "x-😊", // Non-ASCII private-use tag
            // "und-001", // Invalid region with 'und'
            // "mul-ZZ", // Invalid region with 'mul'
            // "en-US-u-xx-zzzz", // Invalid Unicode extension key
            "de-DE@euro", // Old-style locale syntax (invalid in BCP 47)
            // "en-GB-oxford", // Fake variant (not in registry)
            "ja-JP-u-ca-", // Incomplete Unicode extension
            // "x-EN-PIRATE", // Invalid private-use capitalization
        ];
        for (const locale of bad) {
            expect(isValidLocale(locale)).toBe(false);
        }
    });
});

describe("namespace resolver", () => {
    describe("strategy: directory", () => {
        it("returns undefined for top-level files", () => {
            const r = createNamespaceResolver({
                strategy: "directory",
            });
            expect(r("foo.ftl", "en")).toBe(undefined);
        });

        it("joins nested segments with separator", () => {
            const r = createNamespaceResolver({
                strategy: "directory",
            });
            expect(r("a/foo.ftl", "en")).toBe("a");
            expect(r("a/sub/foo.ftl", "en")).toBe("a/sub");
        });

        it("respects custom separator", () => {
            const r = createNamespaceResolver({
                strategy: "directory",
                separator: "->",
            });
            expect(r("a/sub/foo.ftl", "en")).toBe("a->sub");
        });

        it("allows single-level dir", () => {
            const r = createNamespaceResolver({
                strategy: "directory",
            });
            expect(r("a/foo.ftl", "en")).toBe("a");
        });
    });

    describe("strategy: file", () => {
        it("index file yields dir-only namespace", () => {
            const r = createNamespaceResolver({
                strategy: "file",
                indexFile: "index",
            });
            expect(r("a/index.json", "en")).toBe("a");
            expect(r("index.json", "en")).toBe(undefined);
        });

        it("non-index file appends filename", () => {
            const r = createNamespaceResolver({
                strategy: "file",
                indexFile: "index",
            });
            expect(r("a/foo.json", "en")).toBe("a/foo");
            expect(r("foo.json", "en")).toBe("foo");
        });

        it("1index file yields undefined", () => {
            const r = createNamespaceResolver({
                strategy: "file",
                indexFile: "index",
            });
            expect(r("index.ftl", "en")).toBe(undefined);
            expect(r("foo.ftl", "en")).toBe("foo");
        });

        it("uses custom resolveExtension", () => {
            const r = createNamespaceResolver({
                strategy: "file",
                indexFile: "index",
                resolveExtension: () => ".txt", // never matches -> basename untouched
            });
            expect(r("a/main.other", "en")).toBe("a/main.other");
        });
    });

    it("throws on invalid strategy", () => {
        expect(() =>
            createNamespaceResolver({
                // @ts-expect-error testing invalid strategy
                strategy: "damn",
                nesting: true,
            })
        ).toThrow("Invalid namespace resolver strategy");
    });

    it("locale matters", () => {
        const r: NamespaceResolverFn = (_relp, locale) => {
            return locale;
        };
        expect(r("a/main.other", "en")).toBe("en");
        expect(r("a/main.other", "kn")).toBe("kn");
    });
});

describe("walk", () => {
    it("should match extension", async () => {
        const itr = walk(".", [".ts"], {
            followSymlinks: false,
            ignoreDotFiles: true,
        });
        const files = await Array.fromAsync(itr);
        expect(files.toSorted((a, b) => a.filepath.localeCompare(b.filepath)))
            .toStrictEqual([
                {
                    filepath: "adapters/fluent/adapter_test.ts",
                    logicalPath: "adapters/fluent/adapter_test.ts",
                },
                {
                    filepath: "adapters/fluent/adapter.ts",
                    logicalPath: "adapters/fluent/adapter.ts",
                },
                {
                    filepath: "adapters/fluent/cli.ts",
                    logicalPath: "adapters/fluent/cli.ts",
                },
                {
                    filepath: "adapters/fluent/mod.ts",
                    logicalPath: "adapters/fluent/mod.ts",
                },
                { filepath: "adapters/mod.ts", logicalPath: "adapters/mod.ts" },
                {
                    filepath: "adapters/types.ts",
                    logicalPath: "adapters/types.ts",
                },
                {
                    filepath: "cli/config.ts",
                    logicalPath: "cli/config.ts",
                },
                {
                    filepath: "cli/constants.ts",
                    logicalPath: "cli/constants.ts",
                },
                {
                    filepath: "cli/generate_types.ts",
                    logicalPath: "cli/generate_types.ts",
                },
                { filepath: "cli/main.ts", logicalPath: "cli/main.ts" },
                {
                    filepath: "cli/utilities.ts",
                    logicalPath: "cli/utilities.ts",
                },
                {
                    filepath: "example/locales/types.d.ts",
                    logicalPath: "example/locales/types.d.ts",
                },
                { filepath: "example/main.ts", logicalPath: "example/main.ts" },
                {
                    filepath: "example/y18n.config.ts",
                    logicalPath: "example/y18n.config.ts",
                },
                { filepath: "mod.ts", logicalPath: "mod.ts" },
                { filepath: "plugin_test.ts", logicalPath: "plugin_test.ts" },
                { filepath: "plugin.ts", logicalPath: "plugin.ts" },
                { filepath: "types.ts", logicalPath: "types.ts" },
                {
                    filepath: "utilities_test.ts",
                    logicalPath: "utilities_test.ts",
                },
                { filepath: "utilities.ts", logicalPath: "utilities.ts" },
            ]);
    });

    it("should match extension-less files", async () => {
        const itr = walk(".", [""], {
            followSymlinks: false,
            ignoreDotFiles: true,
        });
        const files = await Array.fromAsync(itr);
        expect(files.toSorted()).toStrictEqual([{
            filepath: "LICENSE",
            logicalPath: "LICENSE",
        }]);
    });
});

// === Simple functions for mocking fs
const SEPARATOR = "/";

type Entry = EntryFile | EntrySymlink | EntryDir | EntryOther;
type EntryFile = string[];
type EntrySymlink = string;
type EntryOther = null;
type EntryDir = { [name: string]: Entry };
type ResolvedDirent =
    | { type: "dir"; content: EntryDir }
    | { type: "file"; content: string }
    | { type: "symlink"; linked: string }
    | { type: "unknown" };

function resolvePath(root: EntryDir, path: string) {
    if (path.trim() === "") {
        throw new Error("File or directory not found");
    }

    function recurse(
        root: EntryDir,
        current: EntryDir,
        segments: string[],
    ): ResolvedDirent {
        if (
            segments.length === 0 ||
            (segments.length === 1 && segments[0] === "")
        ) return { type: "dir", content: current };
        if (segments[0] === ".")
            return recurse(root, root, segments.slice(1));

        for (const entryName in current) {
            if (segments[0] !== entryName) continue;
            const entry = current[entryName];
            if (entry == null) {
                return { type: "unknown" };
            } else if (typeof entry === "string") {
                return { type: "symlink", linked: entry };
            } else if (Array.isArray(entry)) {
                if (entry.some((line) => typeof line !== "string"))
                    throw new Error("Invalid file content");
                return { type: "file", content: entry.join("\n") };
            } else if (typeof entry === "object") {
                return recurse(root, entry, segments.slice(1));
            } else {
                throw new Error("Invalid file system entry type");
            }
        }

        throw new Error("File or directory not found");
    }

    return recurse(root, root, normalize(path).split(SEPARATOR));
}

function exists(root: EntryDir, path: string) {
    try {
        resolvePath(root, path);
        return true;
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "File or directory not found"
        ) return false;
        throw error;
    }
}

function installFsStubs(root: EntryDir): Stub[] {
    return [
        // opendir
        // deno-lint-ignore require-await
        stub(fs.promises, "opendir", async (path) => {
            if (typeof path !== "string") throw new Error("unsupported");
            const resolved = resolvePath(root, path);
            if (resolved.type !== "dir")
                throw new Error("Not a directory");

            return {
                async *[Symbol.asyncIterator](): NodeJS.AsyncIterator<
                    fs.Dirent,
                    undefined
                > {
                    for (const entryName in resolved.content) {
                        const entry = resolvePath(
                            resolved.content,
                            entryName,
                        );
                        const dirent: fs.Dirent = {
                            name: entryName,

                            parentPath: path,
                            isFile: () => entry.type === "file",
                            isDirectory: () => entry.type === "dir",
                            isSymbolicLink: () => entry.type === "symlink",

                            isBlockDevice: () => entry.type === "unknown",
                            isCharacterDevice: () => entry.type === "unknown",
                            isFIFO: () => entry.type === "unknown",
                            isSocket: () => entry.type === "unknown",
                        };
                        yield Promise.resolve(dirent);
                    }
                },
                path: "",
                close: async () => {},
                closeSync: () => {},
                read: () => Promise.resolve(null),
                readSync: () => null,
                [Symbol.dispose]() {},
                async [Symbol.asyncDispose]() {},
            } satisfies fs.Dir;
        }),
        // realpath
        // deno-lint-ignore require-await
        stub(fs.promises, "realpath", async (path) => {
            if (typeof path !== "string") throw new Error("unsupported");
            const resolved = resolvePath(root, path);
            if (resolved.type === "symlink") {
                const linkedResolve = resolvePath(root, resolved.linked);
                if (linkedResolve.type === "symlink")
                    return fs.promises.realpath(resolved.linked);
                else return resolved.linked;
            } else {
                return path;
            }
        }),
        // lstat
        // deno-lint-ignore require-await
        stub(fs.promises, "lstat", async (path) => {
            if (typeof path !== "string") throw new Error("unsupported");
            const resolved = resolvePath(root, path);
            return {
                size: resolved.type === "file" ? resolved.content.length : 0,
                isFile: () => resolved.type === "file",
                isDirectory: () => resolved.type === "dir",
                isSymbolicLink: () => resolved.type === "symlink",

                isCharacterDevice: () => resolved.type === "unknown",
                isBlockDevice: () => resolved.type === "unknown",
                isFIFO: () => resolved.type === "unknown",
                isSocket: () => resolved.type === "unknown",
                atime: new Date(),
                mtime: new Date(),
                ctime: new Date(),
                birthtime: new Date(),
                uid: 0,
                atimeMs: 0,
                birthtimeMs: 0,
                blksize: 0,
                blocks: 0,
                ctimeMs: 0,
                dev: 0,
                gid: 0,
                ino: 0,
                mode: 0,
                mtimeMs: 0,
                nlink: 0,
                rdev: 0,
            } satisfies fs.Stats;
        }),
        // readFile
        // deno-lint-ignore require-await
        stub(fs.promises, "readFile", async (path, options) => {
            if (typeof path !== "string") throw new Error("unsupported");
            if (options !== "utf8") throw new Error("unsupported");
            let resolved = resolvePath(root, path);
            while (resolved.type === "symlink")
                resolved = resolvePath(root, resolved.linked);
            if (resolved.type !== "file")
                throw new Error("Not a file");
            return Promise.resolve(resolved.content);
        }),
    ];
}

describe("(internal) mock fs", () => {
    const localesDir: EntryDir = {
        "locales": {
            "en": {
                "main.ftl": [""],
            },
            "common.ftl": ["common = this is another common file"],
            "another-common.ftl": "locales/en/main.ftl",
        },
        "outside.ftl": [],
    };

    it("should resolve paths and check existence", () => {
        const paths: Record<string, ResolvedDirent["type"] | undefined> = {
            "": undefined,
            ".": "dir",
            "locales": "dir",
            "./locales": "dir",
            "./outside.ftl": "file",
            "outside.ftl": "file",
            "non-existent.ftl": undefined,
            "deep/non-existent.ftl": undefined,
            "locales/en": "dir",
            "locales/en/": "dir",
            "locales/en/main.ftl": "file",
            "locales/another-common.ftl": "symlink",
        };
        for (const path in paths) {
            if (exists(localesDir, path)) {
                const { type } = resolvePath(localesDir, path);
                expect(paths[path]).toBe(type);
            } else {
                expect(paths[path]).toBe(undefined);
            }
        }
    });
});

describe("(internal) fs stubs", () => {
    const stubs: Stub[] = [];

    before(() => {
        stubs.push(...installFsStubs({
            "locales": {
                ".dotfile": ["content"],
                "some-ignoreable-file": ["more content"],
                "en": {
                    "unknown-type": null,
                    "main.ftl": ["some = content"],
                    "other.ftl": "outside.ftl",
                },
                "invalid-name-": {
                    "main.ftl": [
                        "some = this dir will be ignored due to invalid name",
                    ],
                },
                "shared": {
                    "common.ftl": [
                        "common = this is another common file",
                    ],
                    "another-common.ftl": "outside.ftl",
                },
            },
            "outside.ftl": ["msg = nothing"],
        }));
    });

    after(() => {
        for (const stub of stubs) {
            stub.restore();
        }
    });

    it("stubbed opendir", async () => {
        await expect(fs.promises.opendir("outside.ftl"))
            .rejects.toThrow("Not a directory");

        const itr = await fs.promises.opendir("locales");
        const arr = await Array.fromAsync(itr);

        expect(arr.every((e) => e.parentPath === "locales")).toBe(true);

        expect(
            arr.map((a) => {
                return {
                    type: a.isFile()
                        ? "file"
                        : a.isDirectory()
                        ? "dir"
                        : a.isSymbolicLink()
                        ? "symlink"
                        : "unknown",
                    name: a.name,
                };
            }).sort((a, b) => a.name.localeCompare(b.name)),
        ).toEqual([
            { name: ".dotfile", type: "file" },
            { name: "en", type: "dir" },
            { name: "invalid-name-", type: "dir" },
            { name: "shared", type: "dir" },
            { name: "some-ignoreable-file", type: "file" },
        ]);
    });

    it("stubbed realpath", async () => {
        expect(await fs.promises.realpath("locales")).toBe("locales");

        expect(await fs.promises.realpath("locales/shared/common.ftl"))
            .toBe("locales/shared/common.ftl");

        expect(await fs.promises.realpath("locales/shared/another-common.ftl"))
            .toBe("outside.ftl");
    });

    it("stubbed lstat", async () => {
        const stat1 = await fs.promises.lstat("locales");
        expect(stat1.isDirectory()).toBe(true);

        const stat2 = await fs.promises.lstat("locales/shared/common.ftl");
        expect(stat2.isFile()).toBe(true);

        const stat3 = await fs.promises.lstat(
            "locales/shared/another-common.ftl",
        );
        expect(stat3.isSymbolicLink()).toBe(true);
    });

    it("stubbed readFile", async () => {
        await expect(fs.promises.readFile("locales", "utf8"))
            .rejects.toThrow("Not a file");

        // follows symlinks
        const content1 = await fs.promises.readFile(
            "locales/shared/another-common.ftl",
            "utf8",
        );
        expect(content1).toBe("msg = nothing");

        const content2 = await fs.promises.readFile(
            "locales/shared/common.ftl",
            "utf8",
        );
        expect(content2).toBe("common = this is another common file");

        const content3 = await fs.promises.readFile(
            "locales/en/main.ftl",
            "utf8",
        );
        expect(content3).toBe("some = content");
    });
});

describe("load locales directory", () => {
    describe(() => {
        const rootdir: EntryDir = {
            "locales": {
                ".dotfile": ["content"],
                "some-ignoreable-file": ["more content"],
                "en": {
                    "unknown-type": null,
                    "main.ftl": ["some = content"],
                    "other.ftl": "outside.ftl",
                },
                "invalid-name-": {
                    "main.ftl": [
                        "some = this dir will be ignored due to invalid name",
                    ],
                },
                "shared": {
                    "common.ftl": [
                        "common = this is another common file",
                    ],
                    "another-common.ftl": "outside.ftl",
                },
            },
            "outside.ftl": ["msg = nothing"],
        };

        const stubs: Stub[] = [];

        before(() => {
            stubs.push(...installFsStubs(rootdir));
        });

        after(() => {
            for (const stub of stubs) {
                stub.restore();
            }
        });

        it("load", async () => {
            const loaded: { locale: string; content: string }[] = [];
            const fake: ResourceLoadable<undefined> & {
                locales: Set<string>;
            } = {
                locales: new Set(),
                loadResource: (locale, content) => {
                    fake.locales.add(locale);
                    loaded.push({ locale, content });
                },
            };
            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
                ignoreDotFiles: true,
                followSymlinks: true,
            });

            // Only "en" is a valid locale name
            expect(Array.from(fake.locales.values())).toStrictEqual(["en"]);

            // "invalid-name-" directory is ignored due to invalid locale name
            expect(fake.locales.has("invalid-name-")).toBe(false);

            // Exactly one locale was discovered
            expect(fake.locales.size).toBe(1);

            const enLoads = loaded.filter((e) => e.locale === "en");
            const contents = enLoads.map((e) => e.content);

            // main.ftl content is loaded
            expect(contents).toContain("some = content");

            // main.ftl
            expect(contents.filter((c) => c === "some = content").length).toBe(
                1,
            );

            // other.ftl (symlink -> outside.ftl), and another-common.ftl (common symlink -> outside.ftl)
            expect(contents.filter((c) => c === "msg = nothing").length).toBe(
                2,
            );

            // common.ftl at the root is loaded as a common source for all locales
            expect(contents).toContain("common = this is another common file");

            // .dotfile content never appears
            expect(contents).not.toContain("content");
        });

        it("loads shared directory before locales when configured", async () => {
            const loaded: { locale: string; content: string }[] = [];
            const fake: ResourceLoadable<undefined> = {
                loadResource: (locale, content) => {
                    loaded.push({ locale, content });
                },
            };
            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
                sharedDirectoryLoading: "before-locales",
            });

            const sharedIdx = loaded.findIndex((e) =>
                e.content === "common = this is another common file"
            );
            const enIdx = loaded.findIndex((e) =>
                e.content === "some = content"
            );
            expect(sharedIdx).toBeLessThan(enIdx);
        });

        it("treats 'shared' as a normal locale when shared loading is disabled", async () => {
            const loaded: { locale: string; content: string }[] = [];
            const fake: ResourceLoadable<undefined> = {
                loadResource: (locale, content) => {
                    loaded.push({ locale, content });
                },
            };
            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
                sharedDirectoryLoading: "disabled",
            });

            // "shared" is a valid locale-name-shaped dir, so it falls through
            // to being loaded as its own locale once shared handling is off.
            expect(loaded.some((e) => e.locale === "shared")).toBe(true);
        });

        it("throws on unknown sharedDirectoryLoading value", async () => {
            const fake: ResourceLoadable<undefined> = {
                loadResource: () => {},
            };
            await expect(
                loadLocalesDirectory(fake, "locales", {
                    extensions: [".ftl"],
                    // @ts-expect-error testing invalid value
                    sharedDirectoryLoading: "later",
                }),
            ).rejects.toThrow(
                "Unknown value for shared directory loading preference: 'later'",
            );
        });

        it("stops recognizing 'shared' dir when sharedDirectoryName differs", async () => {
            const loaded: { locale: string; content: string }[] = [];
            const fake: ResourceLoadable<undefined> = {
                loadResource: (locale, content) => {
                    loaded.push({ locale, content });
                },
            };
            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
                sharedDirectoryName: "common",
            });
            expect(loaded.some((e) => e.locale === "shared")).toBe(true);
        });

        it("passes resolved namespace and resourceOptions to loadResource", async () => {
            const calls: {
                locale: string;
                content: string;
                namespace: string | undefined;
                resourceOptions: { tag: string } | undefined;
            }[] = [];
            const fake: ResourceLoadable<{ tag: string }> = {
                loadResource: (locale, content, namespace, resourceOptions) => {
                    calls.push({ locale, content, namespace, resourceOptions });
                },
            };
            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
                followSymlinks: true,
                resolveNamespace: createNamespaceResolver({
                    strategy: "file",
                    indexFile: "main",
                }),
                resourceOptions: { tag: "x" },
            });

            // main.ftl is the index file -> no namespace
            const enMain = calls.find((c) =>
                c.locale === "en" && c.content === "some = content"
            );
            expect(enMain?.namespace).toBe(undefined);
            expect(enMain?.resourceOptions).toStrictEqual({ tag: "x" });

            // other.ftl -> filename becomes the namespace
            const enOther = calls.find((c) =>
                c.locale === "en" && c.namespace === "other"
            );
            expect(enOther?.content).toBe("msg = nothing");
        });
    });

    it("ignores non-directory entries at the locales root", async () => {
        const localStubs = installFsStubs({
            "locales": {
                "README.txt": ["not a locale dir"],
                "en": { "main.ftl": ["some = content"] },
            },
        });
        try {
            const loaded: string[] = [];
            const fake: ResourceLoadable<undefined> = {
                loadResource: (_locale, content) => loaded.push(content),
            };
            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
            });
            expect(loaded).toStrictEqual(["some = content"]);
        } finally {
            for (const s of localStubs) s.restore();
        }
    });

    it("follows a symlinked directory at the locales root", async () => {
        const localStubs = installFsStubs({
            "locales": {
                "en": {
                    "main.ftl": ["some = content"],
                },
                "en-linked": "locales/en", // symlink pointing at a real locale dir
            },
        });

        try {
            const loaded: { locale: string; content: string }[] = [];
            const fake: ResourceLoadable<undefined> = {
                loadResource: (locale, content) =>
                    loaded.push({ locale, content }),
            };

            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
                followSymlinks: true,
            });

            // "en-linked" resolves (via realpath) to the real "en" dir,
            // and its name is itself a valid-looking locale tag, so it's
            // walked and loaded as its own locale too.
            expect(loaded).toStrictEqual([{
                locale: "en",
                content: "some = content",
            }, {
                locale: "en-linked",
                content: "some = content",
            }]);
        } finally {
            for (const s of localStubs) s.restore();
        }
    });

    it("follows a symlinked invalid-locale-name directory at the locales root", async () => {
        const localStubs = installFsStubs({
            "locales": {
                "en": { "main.ftl": ["some = content"] },
                "invalid-link-": "locales/en",
            },
        });
        try {
            const loaded: { locale: string; content: string }[] = [];
            const fake: ResourceLoadable<undefined> = {
                loadResource: (locale, content) =>
                    loaded.push({ locale, content }),
            };
            await loadLocalesDirectory(fake, "locales", {
                extensions: [".ftl"],
                followSymlinks: true,
            });
            // symlink resolves to a real dir but the name is invalid, so it's
            // walked into (hits the followSymlinks && isSymbolicLink branch),
            // but never added as a locale.
            expect(loaded).toStrictEqual([{
                locale: "en",
                content: "some = content",
            }]);
        } finally {
            for (const s of localStubs) s.restore();
        }
    });
});
