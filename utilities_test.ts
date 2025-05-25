import { afterAll, beforeAll, describe, it } from "jsr:@std/testing/bdd";
import { type Stub, stub } from "jsr:@std/testing/mock";
import { expect } from "jsr:@std/expect";
import { isValidLocale, loadLocalesDirectory, walk } from "./utilities.ts";
import * as fs from "node:fs";
import type { ResourceLoadable } from "./types.ts";
import { normalize } from "node:path";

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

describe("walk", () => {
    it("should match extension", async () => {
        const itr = walk(".", [".ts"], {
            followSymlinks: false,
            ignoreDotFiles: true,
        });
        const files = await Array.fromAsync(itr);
        expect(files.toSorted()).toStrictEqual([
            "adapter_fluent.ts",
            "adapter_fluent_test.ts",
            "cli/common.ts",
            "cli/generate_types.ts",
            "cli/generate_types_fluent.ts",
            "cli/main.ts",
            "example/locales.ts",
            "example/main.ts",
            "mod.ts",
            "plugin.ts",
            "plugin_test.ts",
            "types.ts",
            "utilities.ts",
            "utilities_test.ts",
        ]);
    });

    it("should match extension-less files", async () => {
        const itr = walk(".", [""], {
            followSymlinks: false,
            ignoreDotFiles: true,
        });
        const files = await Array.fromAsync(itr);
        expect(files.toSorted()).toStrictEqual(["LICENSE"]);
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

describe("load locales directory", () => {
    const rootdir: EntryDir = {
        "locales": {
            ".dotfile": ["content"],
            "en": {
                "unknown-type": null,
                "main.ftl": ["some = content"],
                "other.ftl": "locales/en/main.ftl",
            },
            "invalid-name-": {
                "main.ftl": [
                    "some = this dir will be ignored due to invalid name",
                ],
            },
            "common.ftl": [
                "common = this is another common file",
            ],
            "another-common.ftl": "locales/en/main.ftl",
        },
        "outside.ftl": [],
    };

    const stubs: Stub[] = [];

    beforeAll(() => {
        stubs.push(
            // opendir
            // deno-lint-ignore require-await
            stub(fs.promises, "opendir", async (path) => {
                if (typeof path !== "string") throw new Error("unsupported");
                const resolved = resolvePath(rootdir, path);
                if (resolved.type !== "dir")
                    throw new Error("Not a directory");

                return {
                    async *[Symbol.asyncIterator]() {
                        for (const entryName in resolved.content) {
                            const entry = resolvePath(
                                resolved.content,
                                entryName,
                            );
                            const dirent: fs.Dirent = {
                                name: entryName,
                                path: "",
                                parentPath: path,
                                isFile: () => entry.type === "file",
                                isDirectory: () => entry.type === "dir",
                                isSymbolicLink: () => entry.type === "symlink",

                                isBlockDevice: () => entry.type === "unknown",
                                isCharacterDevice: () =>
                                    entry.type === "unknown",
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
                } satisfies fs.Dir;
            }),
            // realpath
            // deno-lint-ignore require-await
            stub(fs.promises, "realpath", async (path) => {
                if (typeof path !== "string") throw new Error("unsupported");
                const resolved = resolvePath(rootdir, path);
                if (resolved.type === "symlink") {
                    const linkedResolve = resolvePath(rootdir, resolved.linked);
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
                const resolved = resolvePath(rootdir, path);
                return {
                    size: resolved.type === "file"
                        ? resolved.content.length
                        : 0,
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
                const resolved = resolvePath(rootdir, path);
                if (resolved.type !== "file")
                    throw new Error("Not a file");
                return Promise.resolve(resolved.content);
            }),
        );
    });

    afterAll(() => {
        stubs.forEach((stub) => stub.restore());
    });

    it("load", async () => {
        const fake: ResourceLoadable<undefined> & {
            locales: Set<string>;
        } = {
            locales: new Set(),
            // deno-lint-ignore no-unused-vars
            loadResource: (locale, source) => {
                fake.locales.add(locale);
            },
        };
        await loadLocalesDirectory(fake, "locales", {
            extensions: [".ftl"],
            ignoreDotFiles: true,
            followSymlinks: true,
        });

        expect(Array.from(fake.locales.values())).toStrictEqual(["en"]);

        // todo: complete
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
            { name: "another-common.ftl", type: "symlink" },
            { name: "common.ftl", type: "file" },
            { name: "en", type: "dir" },
            { name: "invalid-name-", type: "dir" },
        ]);
    });

    it("stubbed realpath", async () => {
        expect(await fs.promises.realpath("locales")).toBe("locales");

        expect(await fs.promises.realpath("locales/common.ftl"))
            .toBe("locales/common.ftl");

        expect(await fs.promises.realpath("locales/another-common.ftl"))
            .toBe("locales/en/main.ftl");
    });

    it("stubbed lstat", async () => {
        const stat1 = await fs.promises.lstat("locales");
        expect(stat1.isDirectory()).toBe(true);

        const stat2 = await fs.promises.lstat("locales/common.ftl");
        expect(stat2.isFile()).toBe(true);

        const stat3 = await fs.promises.lstat("locales/another-common.ftl");
        expect(stat3.isSymbolicLink()).toBe(true);
    });

    it("stubbed readFile", async () => {
        await expect(fs.promises.readFile("locales", "utf8"))
            .rejects.toThrow("Not a file");

        await expect(fs.promises.readFile("locales/another-common.ftl", "utf8"))
            .rejects.toThrow("Not a file");

        const content1 = await fs.promises.readFile(
            "locales/common.ftl",
            "utf8",
        );
        expect(content1).toBe("common = this is another common file");

        const content2 = await fs.promises.readFile(
            "locales/en/main.ftl",
            "utf8",
        );
        expect(content2).toBe("some = content");
    });
});
