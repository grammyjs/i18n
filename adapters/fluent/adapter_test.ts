import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { FluentAdapter, parseMessageKey } from "../fluent/adapter.ts";

describe("parse message key", () => {
    it("message id only", () => {
        const parsed = parseMessageKey("id");
        expect(parsed).toStrictEqual({
            id: "id",
            attr: undefined,
            namespace: "",
        });
    });

    it("message id + attr", () => {
        const parsed = parseMessageKey("id.attr");
        expect(parsed).toStrictEqual({ id: "id", attr: "attr", namespace: "" });
    });

    it("invalid ones", () => {
        const keys = [
            "id.",
            "id..",
            ".attr",
            "...",
            ".",
            ".attr.",
            "id.attr.",
            "",
        ];
        for (const key of keys) {
            expect(() => parseMessageKey(key))
                .toThrow(`Invalid message key segments in key: '${key}'`);
        }
    });

    it("namespace + id", () => {
        expect(parseMessageKey("ns:id")).toStrictEqual({
            namespace: "ns",
            id: "id",
            attr: undefined,
        });
    });

    it("namespace + id + attr", () => {
        expect(parseMessageKey("ns:id.attr")).toStrictEqual({
            namespace: "ns",
            id: "id",
            attr: "attr",
        });
    });

    it("empty namespace before colon", () => {
        expect(parseMessageKey(":id")).toStrictEqual({
            namespace: "",
            id: "id",
            attr: undefined,
        });
    });

    it("trims surrounding whitespace", () => {
        expect(parseMessageKey("  id  ")).toStrictEqual({
            namespace: "",
            id: "id",
            attr: undefined,
        });
    });
});

describe("fluent adapter", () => {
    it("should register locales", () => {
        const adapter = new FluentAdapter();
        expect(adapter.locales).toStrictEqual([]);

        adapter.loadResource("en", "msg = message");
        expect(adapter.locales).toStrictEqual(["en"]);

        adapter.loadResource("de", "msg = message");
        expect(adapter.locales).toStrictEqual(["en", "de"]);
    });

    it("should not register invalid locale", () => {
        const adapter = new FluentAdapter();
        expect(adapter.loadResource("en", "source = message"))
            .toStrictEqual([]);
        expect(() => adapter.loadResource("de-", "source = message"))
            .toThrow(`The locale de- seems invalid.`);
    });

    it("should return resource errors", () => {
        const adapter = new FluentAdapter();
        const rt1 = adapter.loadResource("en", "msg = message");
        expect(rt1.length).toBe(0);
        const rt2 = adapter.loadResource("en", "msg = message");
        expect(rt2.length).toBe(1);
        expect(() => {
            throw rt2[0];
        }).toThrow(`Attempt to override an existing message: "msg"`);
        const rt3 = adapter.loadResource(
            "en",
            [
                "msg2 = message two",
                "   .attr = attr one",
                "   .attr = attr two",
            ].join("\n"),
        );
        expect(rt3.length).toBe(0); // for some reason
    });

    it("should not return errors with allow overriding", () => {
        const adapter = new FluentAdapter();
        const rt1 = adapter.loadResource("en", "msg = message");
        expect(rt1.length).toBe(0);
        const rt2 = adapter.loadResource("en", "msg = message", undefined, {
            allowOverrides: true,
        });
        expect(rt2.length).toBe(0);
    });

    it("shoud not override existing messages", () => {
        const adapter = new FluentAdapter();
        adapter.loadResource("en", "msg = message");
        adapter.loadResource("en", "msg1 = message 1");
        expect(adapter.translate("en", ":msg")).toBe("message");
    });

    const FSI = "\u2068", PDI = "\u2069";
    const v = (value: string) => FSI + value + PDI;

    it("should translate valid messages", () => {
        const adapter = new FluentAdapter();
        adapter.loadResource(
            "en",
            [
                "msg1 = message one",
                "msg2 = message two { $v }",
                "  .attr1 = attr one",
            ].join("\n"),
        );
        expect(adapter.translate("en", "msg1")).toBe("message one");
        expect(adapter.translate("en", "msg2"))
            .toBe(`message two ${v("{$v}")}`);
        expect(adapter.translate("en", "msg2", { v: 1 }))
            .toBe(`message two ${v("1")}`);
        expect(adapter.translate("en", "msg2.attr1"))
            .toBe("attr one");
    });

    it("should not try to validate invalid messages", () => {
        const adapter = new FluentAdapter();
        adapter.loadResource(
            "en",
            [
                "msg1 = message one",
                "msg2 = message two { $v }",
                "  .attr1 = attr one",
            ].join("\n"),
        );
        expect(adapter.translate("de", "msg1")).toBe(undefined);
        expect(adapter.translate("en", "non-existent")).toBe(undefined);
    });

    it("should respect bundle options (useIsolating)", () => {
        const adapter = new FluentAdapter({
            bundleOptions: {
                useIsolating: true,
            },
        });

        adapter.loadResource("en", "link1 = click here -> { $link }");
        expect(adapter.translate("en", "link1", { link: "https://grammy.dev" }))
            .toBe(`click here -> ${v("https://grammy.dev")}`);

        adapter.loadResource("de", "link2 = click here -> {$link}", undefined, {
            bundleOptions: {
                useIsolating: false,
            },
        });
        expect(adapter.translate("de", "link2", { link: "https://grammy.dev" }))
            .toBe(`click here -> https://grammy.dev`);
    });

    it("should return undefined for attr not found on existing message", () => {
        const adapter = new FluentAdapter();
        adapter.loadResource("en", "msg = message");
        expect(adapter.translate("en", "msg.missing")).toBe(undefined);
    });

    it("should return undefined for unregistered locale", () => {
        const adapter = new FluentAdapter();
        expect(adapter.translate("en", "msg")).toBe(undefined);
    });

    describe("negotiateLocales", () => {
        it("should return empty array when no locales are registered", () => {
            const adapter = new FluentAdapter();
            expect(adapter.negotiateLocales("en")).toStrictEqual([]);
        });

        it("should return exact match when available", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = message");
            adapter.loadResource("de", "msg = Nachricht");
            expect(adapter.negotiateLocales("en")).toStrictEqual(["en"]);
            expect(adapter.negotiateLocales("de")).toStrictEqual(["de"]);
        });

        it("should return empty array when no locale matches", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = message");
            adapter.loadResource("de", "msg = Nachricht");
            expect(adapter.negotiateLocales("fr")).toStrictEqual([]);
        });

        it("should match a region-specific locale to a base locale", () => {
            // e.g. "en-US" requested, but only "en" registered
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = message");
            expect(adapter.negotiateLocales("en-US")).toStrictEqual(["en"]);
        });

        it("should match a base locale to a region-specific registered locale", () => {
            // e.g. "en" requested, but only "en-US" registered
            const adapter = new FluentAdapter();
            adapter.loadResource("en-US", "msg = message");
            expect(adapter.negotiateLocales("en")).toStrictEqual(["en-US"]);
        });

        it("should prefer an exact locale over a partial match", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = message");
            adapter.loadResource("en-GB", "msg = message");
            const result = adapter.negotiateLocales("en-GB");
            expect(result[0]).toBe("en-GB");
            expect(result).toContain("en");
        });

        it("should return multiple matches when several locales are compatible", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en-US", "msg = message");
            adapter.loadResource("en-GB", "msg = message");
            adapter.loadResource("de", "msg = Nachricht");

            const result = adapter.negotiateLocales("en");
            expect(result).toContain("en-US");
            expect(result).toContain("en-GB");
            expect(result).not.toContain("de");
        });

        it("should return empty array for a completely unrelated locale", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = message");
            adapter.loadResource("de", "msg = Nachricht");
            adapter.loadResource("fr", "msg = message");
            expect(adapter.negotiateLocales("ja")).toStrictEqual([]);
        });
    });

    describe("namespaces", () => {
        it("should handle undefined and empty string as default namespaces", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = default ns");
            expect(adapter.translate("en", "msg")).toBe("default ns");
            const rt = adapter.loadResource("en", "msg = default ns", "");
            expect(rt.length).toBe(1);
            adapter.loadResource("en", "msg = default ns new", "", {
                allowOverrides: true,
            });
            expect(adapter.translate("en", "msg")).toBe("default ns new");
        });

        it("isolates messages by namespace", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = default ns");
            adapter.loadResource("en", "msg = other ns", "other");

            expect(adapter.translate("en", "msg")).toBe("default ns");
            expect(adapter.translate("en", ":msg")).toBe("default ns");
            expect(adapter.translate("en", "other:msg")).toBe("other ns");
        });

        it("should return undefined for unknown namespace", () => {
            const adapter = new FluentAdapter();
            adapter.loadResource("en", "msg = message");
            expect(adapter.translate("en", "missing:msg")).toBe(undefined);
        });

        it("does not error when same id used across namespaces", () => {
            const adapter = new FluentAdapter();
            const rt1 = adapter.loadResource("en", "msg = a", "ns1");
            const rt2 = adapter.loadResource("en", "msg = a", "ns1");
            const rt3 = adapter.loadResource("en", "msg = b", "ns2");
            expect(rt1.length).toBe(0);
            expect(rt2.length).toBe(1);
            expect(rt3.length).toBe(0);
        });
    });
});
