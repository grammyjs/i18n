import type {
    Context,
    MiddlewareFn,
} from "https://lib.deno.dev/x/grammy@1.x/mod.ts";
import type {
    LocaleNegotiator,
    Locales,
    LocalesTypings,
    MessageKey,
    Messages,
    NegotiatorResult,
    TranslateFunction,
} from "./types.ts";
import { isValidLocale } from "./utilities.ts";
import { negotiateLanguages } from "npm:@fluent/langneg@0.7.0";
import { createDebug } from "jsr:@grammyjs/debug@0.2.1";

const debug = createDebug("grammy:i18n");

/**
 * A format adapter is an abstraction that provides translate capabilities to
 * any localization format. Format adapters helps enable localization regardless
 * of the localization format used. Format adapters should manage the
 * translation resources and expose a translate function that can be called from
 * the i18n instance.
 */
export interface FormatAdapter<
    LT extends LocalesTypings,
> {
    /**
     * Get the list of locales registered in the adapter.
     */
    locales: string[];
    /**
     * Formats and returns a message string if the message exists.
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
        ...args: Messages<LT>[MK] extends never ? []
            : Messages<LocalesTypings>[string] extends Messages<LT>[MK]
                ? [variables?: Messages<LT>[MK]]
            : [variables: Messages<LT>[MK]]
    ): string | undefined;
}

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
     * I18n context namespace object.
     */
    i18n: {
        /**
         * Uses the locale specified to be used in rest of the translations.
         *
         * @param locale Locale to use in rest of the translations.
         */
        useLocale: (locale: string) => void;
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
            onMissingKey?: (event: {
                requestedLocale: string;
                currentLocale: string;
                messageKey: string;
                fallback: boolean;
            }) => string | undefined;
        },
    ) {
        if (!isValidLocale(options.fallbackLocale))
            throw new Error("Must set a valid fallback (default) locale.");

        options.localeNegotiator ??= (ctx) => ctx.from?.language_code;
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
        M extends Messages<LT>,
        MK extends MessageKey<LT, M>,
    >(
        locale: L,
        messageKey: MK,
        ...args: Messages<LT>[MK] extends never ? []
            : Messages<LocalesTypings>[string] extends Messages<LT>[MK]
                ? [variables?: Messages<LT>[MK]]
            : [variables: Messages<LT>[MK]]
    ): string {
        debug(`Translating message '${messageKey}' in locale '${locale}'`);

        const negotiatedLocales = negotiateLanguages(
            [locale],
            this.locales,
            { strategy: "filtering" },
        );
        for (const negotiatedLocale of negotiatedLocales) {
            debug(`Translating using '${negotiatedLocale}' (from '${locale}')`);
            const tr = this.options.adapter.translate(
                locale,
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
        const tr = this.options.adapter.translate(locale, messageKey, ...args);
        if (tr != null) return tr;

        // todo: fully decide whether `translate` should throw or return
        //  `messageKey` as string, or let the user handle it.

        const result = this.options?.onMissingKey?.({
            fallback: true,
            requestedLocale: locale,
            currentLocale: this.fallbackLocale,
            messageKey: messageKey,
        });
        if (typeof result === "string") return result;

        throw new Error(
            `Couldn't find the message '${messageKey}' in the fallback locale '${this.fallbackLocale}'. ` +
                `At least the fallback locale must have all the messages you reference.`,
        );
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
        } = this.options;

        const withLocale = (locale: string) =>
            this.translate.bind(this, locale) as TranslateFunction<LT>;

        return async function (ctx, next): Promise<void> {
            let boundTranslate: TranslateFunction<LT>;

            function useLocale(locale: string) {
                if (!isValidLocale(locale)) {
                    throw new Error(
                        "Cannot use an invalid locale for translations.",
                    );
                }
                debug(`Using locale '${locale}' for translating`);
                boundTranslate = withLocale(locale);
            }
            async function negotiateLocale() {
                const negotiated = await localeNegotiator?.(ctx);
                debug(
                    negotiated == null
                        ? `Could not negotiate a valid language. Falling back to '${fallbackLocale}'`
                        : `Negotiated locale: '${negotiated}'`,
                );
                useLocale(negotiated ?? fallbackLocale);
                return negotiated;
            }

            Object.defineProperty(ctx, "i18n", {
                writable: true,
                value: {
                    useLocale: useLocale,
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
