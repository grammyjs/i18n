import { createDebug } from "@grammyjs/debug";
import type { Context, HearsContext, MiddlewareFn } from "@grammyjs/grammy";
import type {
    FormatAdapter,
    Locales,
    LocalesTypings,
    MessageKey,
    Messages,
    MessageVariables,
} from "./types.ts";
import { isValidLocale } from "./utilities.ts";

const debug = createDebug("grammy:i18n");

// https://github.com/grammyjs/grammY/blob/b1eec64eef5aaa903606d3b07c69f34d12b5ff85/src/context.ts#L116
type Trigger = string | RegExp; // todo: will grammY export it?

export type NegotiatorResult = string | undefined;
export type LocaleNegotiator<C extends Context> = (
    ctx: C,
) => NegotiatorResult | Promise<NegotiatorResult>;

export type TranslateFunction<LT extends LocalesTypings> = <
    MK extends MessageKey<LT, Messages<LT>>,
>(
    messageKey: MK,
    ...args: MessageVariables<LT, Messages<LT>, MK>
) => string;

/**
 * Context flavor for the outside middleware tree. Installs `ctx.translate` and
 * `ctx.i18n` that can be used for translating and handling the i18n instance of
 * the current update.
 */
export type I18nFlavor<
    C extends Context,
    LT extends LocalesTypings = LocalesTypings,
> = C & {
    /**
     * `I18n` context namespace object.
     */
    i18n: {
        /** The format adapter in use. */
        adapter: FormatAdapter<LT>;
        /**
         * Uses the locale specified to be used in rest of the translations.
         *
         * @param locale Locale to use in rest of the translations.
         */
        useLocale: (locale: string) => void;
        /**
         * Returns the locale currently set for translations.
         *
         * @returns The current locale.
         */
        getLocale: () => string;
        /**
         * Calls the locale negotiator and sets the negotiated locale.
         *
         * @returns The locale returned by the locale negotiator.
         */
        negotiateLocale: () => Promise<NegotiatorResult>;
    };
    /**
     * Formats and returns a message string using the adapter. Fallback
     * mechanism is also triggered by this.
     *
     * @param locale Locale to use when translating.
     * @param messageKey Message key to be used.
     * @param args Variables to be passed for formatting the message data.
     *
     * @returns The translated string.
     */
    translate: TranslateFunction<LT>;
};

/**
 * Details about the missing key event, such as which locale and key were it and
 * whether it was called upon falling back to the set fallback locale.
 */
export type MissingKeyEvent = {
    /** The locale the translate function originally requested */
    requestedLocale: string;
    /** The locale it negotiated into, i.e., the locale currently in use */
    currentLocale: string;
    /** The requested message key */
    messageKey: string;
    /** Whether the translation was called for the fallback locale set */
    fallback: boolean;
};

/**
 * Locale negotiator used by i18n if one isn't set. It reads the language code
 * of user in the current update, which can be undefined.
 */
export function defaultLocaleNegotiator<C extends Context>(
    ctx: C,
): string | undefined {
    return ctx.from?.language_code;
}

/**
 * The core class for enabling internationalization in bots.
 *
 * Wraps a {@link FormatAdapter} and exposes translation utilities both
 * directly (via {@link I18n.translate}) and as grammY middleware (via
 * {@link I18n.middleware}), which installs `ctx.translate` and `ctx.i18n`
 * onto every update's context.
 */
export class I18n<
    C extends Context = Context,
    LT extends LocalesTypings = LocalesTypings,
> {
    constructor(
        /**
         * Configuration options for the i18n plugin.
         */
        private options: {
            /**
             * Adapter for parsing and managing translation sources. You can
             * plug in one of the official adapters or a custom one.
             */
            adapter: FormatAdapter<LT>;
            /**
             * Fallback (default) locale of the instance. This must be set in
             * order to prevent panicking if the requested locale has no message
             * of that key. An error will be thrown in case there was no bundle
             * registered for this fallback locale.
             */
            fallbackLocale: Locales<LT>;
            /**
             * Custom locale negotiator for utilising external sources or
             * databases for choosing the best possible locale for the user.
             *
             * The default locale negotiator reads the `language_code` of the
             * user from the incoming update. This default behavior can be
             * overriden by defining a custom locale negotiator. If the locale
             * negotiator does not return a string, the set fallback locale is
             * used instead.
             */
            localeNegotiator?: LocaleNegotiator<C>;
            /**
             * Handle when a key is missing. You can utilise this to throw
             * errors or print warnings. Handler should either return a string
             * or nothing.
             *
             * If this does not return a string, an error is thrown after
             * invoking the handler (if the locale was the set fallback locale),
             * to ensure the user don't accidentally reference a key that is not
             * in at least the fallback locale. This behavior can be overridden
             * by returning a translation-missing message from the handler to
             * show as the result.
             *
             * @param event Details about the event, such as which locale, key
             * and whether it was called upon falling back to the set fallback
             * locale.
             *
             * @returns Either a string or nothing. If string is returned, the
             * string is returned as the result of `translate` instead of the
             * actual formatted string that maybe resolved later in the case of
             * non-fallback locales.
             */
            onMissingKey?: (event: MissingKeyEvent) => string | void;
        },
    ) {
        if (!isValidLocale(options.fallbackLocale))
            throw new Error("Must set a valid fallback (default) locale.");

        options.localeNegotiator ??= defaultLocaleNegotiator;
    }

    /** The format adapter in use. */
    get adapter(): FormatAdapter<LT> {
        return this.options.adapter;
    }

    /**
     * Fallback (default) locale of the adapter.
     */
    get fallbackLocale(): string {
        return this.options.fallbackLocale;
    }

    /**
     * Get the list of locales registered in the adapter.
     */
    get locales(): string[] {
        return this.options.adapter.locales;
    }

    /**
     * Formats and returns a message string using the adapter. Locale
     * negotiation and fallbacks are handled by this function bound to the i18n
     * instance.
     *
     * @param locale Locale to use when translating.
     * @param messageKey Message key to be used.
     * @param args Variables to be passed for formatting the message data.
     */
    translate<
        L extends Locales<LT>,
        MK extends MessageKey<LT, Messages<LT>>,
    >(
        locale: L,
        messageKey: MK,
        ...args: MessageVariables<LT, Messages<LT>, MK>
    ): string {
        debug(`Translating message '${messageKey}' in locale '${locale}'`);

        const negotiatedLocales = this.options.adapter.negotiateLocales(locale);
        for (const negotiatedLocale of negotiatedLocales) {
            debug(`Translating using '${negotiatedLocale}' (from '${locale}')`);
            const tr = this.options.adapter.translate(
                negotiatedLocale,
                messageKey,
                ...args,
            );
            if (tr != null) return tr;

            debug(`Message ${messageKey} not found in ${negotiatedLocale}`);
            const result = this.options?.onMissingKey?.({
                fallback: false,
                requestedLocale: locale,
                currentLocale: negotiatedLocale,
                messageKey: messageKey,
            });
            if (typeof result === "string") return result;
            else continue;
        }

        // falls back
        debug(`Falling back to '${this.fallbackLocale}'`);
        const tr = this.options.adapter.translate(
            this.fallbackLocale,
            messageKey,
            ...args,
        );
        if (tr != null) return tr;

        const result = this.options?.onMissingKey?.({
            fallback: true,
            requestedLocale: locale,
            currentLocale: this.fallbackLocale,
            messageKey: messageKey,
        });
        if (typeof result === "string") return result;

        throw new Error(
            `Couldn't find the message '${messageKey}' in the fallback locale '${this.fallbackLocale}'. ` +
                `The fallback locale must have all the messages you reference.`,
        );
    }

    /**
     * Predicate middleware for filtering messages that contains the message
     * translated using the locale negotiated for the user. This takes in the
     * message key and the variables (if any) as arguments.
     *
     * This is very useful when custom keyboards are present in the bot, as the
     * translated messages may be inconvenient to be hard-coded and handled
     * manually.
     *
     * @param messageKey Message key to be used.
     * @param args Variables to be passed for formatting the message data.
     *
     * @example
     * ```ts
     * // A bug report button.
     * bot.use(i18n.hears("feedback.report-button"), async (ctx) => {
     *     await ctx.send(ctx.translate("feedback.report-choose-category"));
     *     // ...
     * });
     *
     * // Or specific messages with specific values for variables.
     * bot.use(i18n.hears("remind", { target: "me" }), (ctx) => {});
     * ```
     */
    hears<MK extends MessageKey<LT, Messages<LT>>, T extends Trigger>(
        messageKey: MK,
        ...args: MessageVariables<LT, Messages<LT>, MK>
    ): <FC extends I18nFlavor<C, LT>>(ctx: FC) => ctx is HearsContext<FC, T> {
        return <FC extends I18nFlavor<C, LT>>(
            ctx: FC,
        ): ctx is HearsContext<FC, T> => {
            const expected = ctx.translate(messageKey, ...args);
            return ctx.hasText(expected);
        };
    }

    /**
     * Middleware for the i18n plugin.
     *
     * This middleware installs the `translate` function to the context object
     * of the current update bounded to the locale negotiated. It is important
     * that you install this middleware before you install any other middleware
     * that calls the `translate` function.
     */
    middleware(): MiddlewareFn<I18nFlavor<C, LT>> {
        const {
            fallbackLocale,
            localeNegotiator,
            adapter,
        } = this.options;

        const withLocale = (locale: string) =>
            this.translate.bind(this, locale) as TranslateFunction<LT>;

        return async function (ctx, next): Promise<void> {
            let currentLocale: string = fallbackLocale;
            let boundTranslate: TranslateFunction<LT>;

            function useLocale(locale: string) {
                if (!isValidLocale(locale)) {
                    throw new Error(
                        "Cannot use an invalid locale for translations.",
                    );
                }
                debug(`Using locale '${locale}' for translating`);
                currentLocale = locale;
                boundTranslate = withLocale(locale);
            }
            function getLocale(): string {
                return currentLocale;
            }
            async function negotiateLocale(): Promise<NegotiatorResult> {
                const negotiated = await localeNegotiator?.(ctx);
                debug(
                    negotiated == null
                        ? `Could not negotiate a valid language. Falling back to '${fallbackLocale}'`
                        : `Negotiated locale: '${negotiated}'`,
                );
                useLocale(negotiated ?? fallbackLocale);
                return negotiated; // todo: decide whether to have `?? fallbackLocale`
            }

            Object.defineProperty(ctx, "i18n", {
                writable: true,
                value: {
                    adapter: adapter,
                    useLocale: useLocale,
                    getLocale: getLocale,
                    negotiateLocale: negotiateLocale,
                } satisfies I18nFlavor<Context>["i18n"],
            });

            ctx.translate = function <
                MK extends MessageKey<LT, Messages<LT>>,
            >(
                messageKey: MK,
                ...args: Messages<LT>[MK] extends never ? []
                    : Messages<LocalesTypings>[string] extends Messages<LT>[MK]
                        ? [variables?: Messages<LT>[MK]]
                    : [variables: Messages<LT>[MK]]
            ): string {
                return boundTranslate(messageKey, ...args);
            };

            await negotiateLocale(); // initial negotiation
            await next();
        };
    }
}
