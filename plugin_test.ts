import { Api, Composer, Context } from "@grammyjs/grammy";
import type { Update, UserFromGetMe } from "@grammyjs/grammy/types";
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, spy } from "@std/testing/mock";
import {
    defaultLocaleNegotiator,
    I18n,
    type I18nFlavor,
    type MissingKeyEvent,
} from "./plugin.ts";
import type {
    FormatAdapter,
    Locales,
    LocalesTypings,
    MessageKey,
    Messages,
} from "./types.ts";

class CustomAdapter<LT extends LocalesTypings> implements FormatAdapter<LT> {
    #locales: string[] = [];
    #messages: Record<string, Record<string, string>> = {};

    get locales(): string[] {
        return this.#locales;
    }

    setMessage(locale: string, key: string, message: string) {
        if (!this.#locales.includes(locale)) {
            this.#locales.push(locale);
        }
        this.#messages[locale] ??= {};
        this.#messages[locale][key] = message;
    }

    #getMessage(locale: string, key: string) {
        return this.#messages[locale]?.[key];
    }

    #format<M extends Messages<LT>, MK extends MessageKey<LT, M>>(
        message: string,
        variables?: M[MK],
    ): string {
        let start: number | null = null;
        let end: number | null = null;

        for (let i = 0; i <= message.length; i++) {
            if (start === i - 1) {
                if (message[i] === "%") {
                    start = null;
                    continue;
                }
            }
            if (message[i] === "%") {
                start = i;
                continue;
            }
            if (
                start != null && message.charCodeAt(i) >= 97 &&
                message.charCodeAt(i) <= 122
            ) {
                end = i;
                continue;
            }
            if (start != null && end != null && variables != null) {
                const varname = message.slice(start + 1, end + 1);
                if (varname in variables && variables[varname] != null) {
                    const pre = message.slice(0, start) + variables[varname];
                    message = pre + message.slice(end + 1);
                    i = pre.length - 1;
                }
                start = null, end = null;
            }
        }
        return message;
    }

    translate<
        L extends Locales<LT>,
        M extends Messages<LT>,
        MK extends MessageKey<LT, M>,
    >(
        locale: L,
        messageKey: MK,
        ...args: M[MK] extends never ? []
            : Messages<LocalesTypings>[string] extends M[MK]
                ? [variables?: M[MK]]
            : [variables: M[MK]]
    ): string | undefined {
        const variables = args[0];
        const message = this.#getMessage(locale, messageKey);
        if (message == null) return;
        return this.#format(message, variables);
    }
}

describe("format adapters", () => {
    it("custom adapter", () => {
        const adapter = new CustomAdapter();

        expect(adapter.translate("en", "msg")).toBe(undefined);

        adapter.setMessage("en", "msg", "message");
        expect(adapter.translate("en", "msg")).toBe("message");
        expect(adapter.translate("de", "msg")).toBe(undefined);

        adapter.setMessage("en", "hello", "hello %name");
        expect(adapter.translate("en", "hello")).toBe("hello %name");

        adapter.setMessage("en", "hello", "hello %%name");
        expect(adapter.translate("en", "hello")).toBe("hello %%name");

        adapter.setMessage("en", "hello", "hello %%name");
        expect(adapter.translate("en", "hello", { name: "durov" }))
            .toBe("hello %%name");

        adapter.setMessage("en", "hello", "hello %name");
        expect(adapter.translate("en", "hello", { name: "durov" }))
            .toBe("hello durov");
    });
});

describe("i18n", () => {
    it("should throw when fallback locale is invalid", () => {
        expect(() =>
            new I18n({
                adapter: new CustomAdapter(),
                fallbackLocale: "en-",
            })
        ).toThrow("Must set a valid fallback (default) locale.");

        expect(() =>
            // @ts-expect-error intentional for test
            new I18n({
                adapter: new CustomAdapter(),
            })
        ).toThrow("Must set a valid fallback (default) locale.");
    });

    it("should set fallback locale correctly", () => {
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
        });
        expect(i18n.fallbackLocale).toBe("en");
    });

    type TestContext = I18nFlavor<Context>;
    function mkctx(languageCode: string): TestContext;
    function mkctx(update: Omit<Update, "update_id">): TestContext;
    function mkctx(arg: string | Omit<Update, "update_id">): TestContext {
        if (typeof arg === "string") {
            return mkctx({
                message: { from: { language_code: arg } },
            } as Update);
        } else {
            return new Context(
                arg as Update,
                new Api("dummy"),
                {} as UserFromGetMe,
            ) as TestContext;
        }
    }
    const next = () => Promise.resolve();

    // fallback
    it("should handle translations and falling back", () => {
        const adapter = new CustomAdapter();
        adapter.setMessage("en", "key", "value in en");
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
        });
        expect(i18n.translate("en", "key")).toBe("value in en");
        expect(i18n.translate("de", "key")).toBe("value in en");

        adapter.setMessage("de", "key", "value in de");
        expect(i18n.translate("de", "key")).toBe("value in de");

        // should support falling back to related locales
        // de-US (absent) -> de -> en
        expect(i18n.translate("de-US", "key")).toBe("value in de");

        adapter.setMessage("de-US", "key", "value in de-US");
        // should support direct
        expect(i18n.translate("de-US", "key")).toBe("value in de-US");

        // de -> de-US
        adapter.setMessage("de-US", "key-1", "value-1 in de-US");
        expect(i18n.translate("de", "key-1")).toBe("value-1 in de-US");
    });

    // translation

    // locale negotiation
    it("should use default locale negotiation", async () => {
        const defaultNegotiatorSpy = spy(defaultLocaleNegotiator);
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
            localeNegotiator: defaultNegotiatorSpy,
        });

        const composer = new Composer<TestContext>();
        composer.use(i18n.middleware());

        await composer.middleware()(mkctx("ml"), next);

        assertSpyCalls(defaultNegotiatorSpy, 1);
        assertSpyCall(defaultNegotiatorSpy, 0, { returned: "ml" });

        await composer.middleware()(mkctx("es"), next);
        assertSpyCalls(defaultNegotiatorSpy, 2);
        assertSpyCall(defaultNegotiatorSpy, 1, { returned: "es" });
    });

    it("should use custom locale negotiation", async () => {
        const map = ["fr", "zh", "nl"];
        const custom = spy((ctx: TestContext) => {
            return ctx.from?.id != null && map.length > ctx.from.id
                ? map[ctx.from.id]
                : "ro";
        });
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
            localeNegotiator: custom,
        });

        const composer = new Composer<TestContext>();
        composer.use(i18n.middleware());

        for (const [index, lang] of map.entries()) {
            const ctx = mkctx({
                message: { from: { id: index, language_code: lang } },
            } as Update);
            await composer.middleware()(ctx, next);
            assertSpyCall(custom, index, { returned: lang });
        }

        assertSpyCalls(custom, map.length);

        const ctx = mkctx({
            message: { from: { language_code: "de" } },
        } as Update);
        await composer.middleware()(ctx, next);
        assertSpyCall(custom, map.length, { returned: "ro" });

        assertSpyCalls(custom, map.length + 1);
    });

    it("should not let negotiator set invalid locale", async () => {
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
            localeNegotiator: () => {
                return "kk-*"; // something invalid
            },
        });
        const composer = new Composer<TestContext>();
        composer.use(i18n.middleware());

        const ctx = mkctx({} as Update);
        await expect(composer.middleware()(ctx, next))
            .rejects.toThrow("Cannot use an invalid locale for translations.");
    });

    it("should use fallback locale if negotiator returns null", async () => {
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
            localeNegotiator: () => {
                return undefined; // nullish
            },
        });
        const composer = new Composer<TestContext>();
        composer.use(i18n.middleware());
        adapter.setMessage("en", "msg", "value");

        composer.use((ctx) => {
            throw new Error(ctx.translate("msg"));
        });

        const ctx = mkctx({} as Update);
        await expect(composer.middleware()(ctx, next))
            .rejects.toThrow("value");
    });

    // on missing keys
    it("should throw error on missing keys", () => {
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "de",
        });
        expect(() => i18n.translate("en", "key-1"))
            .toThrow(
                `Couldn't find the message 'key-1' in the fallback locale 'de'. ` +
                    "At least the fallback locale must have all the messages you reference.",
            );

        adapter.setMessage("de", "msg", "value in de");
        adapter.setMessage("de-US", "msg-1", "value in de-US");
        adapter.setMessage("de-IN", "msg-2", "value in de-IN");
        expect(i18n.translate("de", "msg-1")).toBe("value in de-US");
    });

    it("should use the missing key handler", () => {
        const handler = spy((_event: MissingKeyEvent) => {
            throw new Error("missed");
        });
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
            onMissingKey: handler,
        });
        expect(() => i18n.translate("en-US", "non-existent")).toThrow("missed");

        assertSpyCalls(handler, 1);
        assertSpyCall(handler, 0, {
            error: { Class: Error, msgIncludes: "missed" },
        });
    });

    it("should use the missing key handler", () => {
        const handler = spy((_event: MissingKeyEvent) => {
            return "fallback message to show instead";
        });
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
            onMissingKey: handler,
        });
        // fallback
        adapter.setMessage("ab-CD", "msg", "value");
        adapter.setMessage("ab-XY", "msg", "value");
        adapter.setMessage("ab", "msg-1", "value");

        expect(i18n.translate("ab", "msg"))
            .toBe("fallback message to show instead");

        expect(i18n.translate("en", "non-existent"))
            .toBe("fallback message to show instead");

        assertSpyCalls(handler, 2);
        assertSpyCall(handler, 1, {
            returned: "fallback message to show instead",
        });
    });

    it("should use the missing key handler", () => {
        const handler = spy((event: MissingKeyEvent) => {
            if (event.fallback) {
                return "fallback message to show instead";
            }
            return;
        });
        const adapter = new CustomAdapter();
        const i18n = new I18n({
            adapter: adapter,
            fallbackLocale: "en",
            onMissingKey: handler,
        });
        adapter.setMessage("en-US", "msg-1", "msg-1 value");
        adapter.setMessage("en-IN", "msg-2", "msg-2 value");
        adapter.setMessage("en-UK", "msg-3", "msg-3 value");

        expect(i18n.translate("en-IN", "msg"))
            .toBe("fallback message to show instead");

        assertSpyCalls(handler, 4);
        assertSpyCall(handler, 0, {
            args: [{
                currentLocale: "en-IN",
                fallback: false,
                messageKey: "msg",
                requestedLocale: "en-IN",
            }],
            returned: undefined,
        });
        assertSpyCall(handler, 1, {
            args: [{
                currentLocale: "en-US",
                fallback: false,
                messageKey: "msg",
                requestedLocale: "en-IN",
            }],
            returned: undefined,
        });
        assertSpyCall(handler, 2, {
            args: [{
                currentLocale: "en-UK",
                fallback: false,
                messageKey: "msg",
                requestedLocale: "en-IN",
            }],
            returned: undefined,
        });
        assertSpyCall(handler, 3, {
            args: [{
                currentLocale: "en",
                fallback: true,
                messageKey: "msg",
                requestedLocale: "en-IN",
            }],
            returned: "fallback message to show instead",
        });
    });

    // middleware
});
