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
    LT extends LocalesTypings = LocalesTypings,
> {
    /**
     * Fallback (default) locale of the adapter.
     */
    fallbackLocale: string;
    /**
     * Get the list of locales registered in the adapter.
     */
    getLocales(): string[];
    /**
     * Formats and returns a message string. Falling back of locale is also
     * handled by this function.
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
            : { readonly [variable: string]: unknown } extends Messages<LT>[MK]
                ? [variables?: Messages<LT>[MK]]
            : [variables: Messages<LT>[MK]]
    ): string;
}

/**
 * Context flavor for the outside middleware tree. Installs `ctx.translate` and
 * `ctx.i18n` that can be used for translating and handling the i18n instance of
 * the current update.
 */
export interface I18nFlavor<LT extends LocalesTypings = LocalesTypings> {
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
     * Formats and returns a message string using the adapter.
     *
     * @param locale Locale to use when translating.
     * @param messageKey Message key to be used.
     * @param args Variables to be passed for formatting the message data.
     *
     * @returns The translated string.
     */
    translate: TranslateFunction<LT>;
}

export class I18n<
    C extends Context = Context,
    LT extends LocalesTypings = LocalesTypings,
> {
    #localeNegotiator: LocaleNegotiator<C>;

    constructor(
        /**
         * Adapter for parsing and managing translation sources.
         */
        private adapter: FormatAdapter<LT>,
        /**
         * Optional options for the i18n plugin.
         */
        options?: {
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
        },
    ) {
        if (!isValidLocale(adapter.fallbackLocale)) {
            throw new Error("Must set a valid fallback (default) locale.");
        }

        this.#localeNegotiator = options?.localeNegotiator ??
            ((ctx) => ctx.from?.language_code);
    }

    /**
     * Fallback (default) locale of the adapter.
     */
    get fallbackLocale(): string {
        return this.adapter.fallbackLocale;
    }

    /**
     * Get the list of locales registered in the adapter.
     */
    getLocales(): string[] {
        return this.adapter.getLocales();
    }

    /**
     * Formats and returns a message string using the adapter.
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
            : { readonly [variable: string]: unknown } extends Messages<LT>[MK]
                ? [variables?: Messages<LT>[MK]]
            : [variables: Messages<LT>[MK]]
    ): string {
        return this.adapter.translate(locale, messageKey, ...args);
    }

    /**
     * Middleware for the i18n plugin.
     *
     * This middleware installs the `translate` function to the context object
     * of the current update bounded to the locale negotiated. It is important
     * that you install this middleware before you install any other middleware
     * that calls the `translate` function.
     */
    middleware(): MiddlewareFn<C & I18nFlavor<LT>> {
        const { fallbackLocale } = this.adapter;
        const localeNegotiator = this.#localeNegotiator;

        const withLocale = (locale: string) =>
            this.translate.bind(this, locale) as TranslateFunction<LT>;

        return async function (ctx, next): Promise<void> {
            let translate: TranslateFunction<LT>;

            function useLocale(locale: string) {
                if (!isValidLocale(locale)) {
                    throw new Error(
                        "Cannot use an invalid locale for translations.",
                    );
                }
                debug(`Using locale '${locale}' for translating`);
                translate = withLocale(locale);
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
                } satisfies I18nFlavor<LT>["i18n"],
            });

            ctx.translate = function <
                MK extends MessageKey<LT, Messages<LT>>,
            >(
                messageKey: MK,
                ...args: Messages<LT>[MK] extends never ? []
                    : { readonly [variable: string]: unknown } extends
                        Messages<LT>[MK] ? [variables?: Messages<LT>[MK]]
                    : [variables: Messages<LT>[MK]]
            ): string {
                return translate(messageKey, ...args);
            };

            await negotiateLocale(); // initial negotiation
            await next();
        };
    }
}
