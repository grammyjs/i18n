import {
    FluentBundle,
    FluentResource,
    type Message,
} from "npm:@fluent/bundle@0.19.1";
import { negotiateLanguages } from "npm:@fluent/langneg@0.7.0";
import type { FormatAdapter } from "./i18n.ts";
import { isValidLocale } from "./utilities.ts";
import type {
    Locales,
    LocalesTypings,
    MessageKey,
    Messages,
    ResourceLoadable,
} from "./types.ts";
import { createDebug } from "jsr:@grammyjs/debug@0.2.1";

const debug = createDebug("grammy:i18n-fluent");

export type FluentPattern = Message["attributes"][string];
export type FluentBundleOptions = ConstructorParameters<typeof FluentBundle>[1];
export interface ResourceOptions {
    allowOverrides?: boolean;
    bundleOptions?: Partial<FluentBundleOptions>;
}
export interface Key {
    id: string;
    attr?: string;
}

const DEFAULT_ALLOW_OVERRIDES = false;

export class FluentAdapter<LT extends LocalesTypings = LocalesTypings>
    implements FormatAdapter<LT>, ResourceLoadable<ResourceOptions> {
    // While FluentBundle-s are capable of being the carrier of more than one
    // locales at a time, here each bundle can carry only one locale.
    #bundles: Map<string, FluentBundle>;

    constructor(
        private options: {
            /**
             * Fallback (default) locale of the instance. This must be set in
             * order to prevent panicking if the requested locale has no message
             * of that key. An error will be thrown in case there was no bundle
             * registered for this fallback locale.
             */
            fallbackLocale: string;
            /**
             * Bundle options to be used when creating a Fluent bundle. This
             * configuration is added to every bundle (each bundle is for each
             * registered locale). This can be overridden by passing a different
             * set of bundle options when loading a resource.
             *
             * One of the common usage of this option would be to load bundles
             * with `useIsolating` set to false by default, to globally disable
             * the Unicode Isolation done by Fluent, or to install custom Fluent
             * functions.
             */
            bundleOptions?: FluentBundleOptions;
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
             * @returns Either a string or nothing. If string is returned, the
             * string is returned as the result of `translate` instead of the
             * actual formatted string that maybe resolved later in the case of
             * non-fallback locales.
             */
            onMissingKey?: (event: {
                locale: string;
                messageKey: Key;
                fallback: boolean;
            }) => string | undefined;
        },
    ) {
        if (!isValidLocale(options.fallbackLocale)) {
            throw new Error("Must set a valid fallback (default) locale.");
        }

        this.#bundles = new Map<string, FluentBundle>();
        this.options.bundleOptions = options.bundleOptions;
    }

    get fallbackLocale() {
        return this.options.fallbackLocale;
    }

    loadResource(
        locale: string,
        source: string,
        resourceOptions?: ResourceOptions,
    ): Error[] {
        if (!isValidLocale(locale)) {
            throw new Error(`The locale ${locale} seems invalid.`);
        }

        let bundle: FluentBundle | undefined = this.#bundles.get(locale);
        if (bundle == null || !(bundle instanceof FluentBundle)) {
            // todo: should allow multiple locales per bundle? Seems useless in
            //  this case. if we do, need to change Map<locale, bundle> to array
            bundle = new FluentBundle(locale, {
                ...this.options.bundleOptions,
                ...resourceOptions?.bundleOptions,
            });
            debug(`Creating a bundle for the locale '${locale}'`);
            this.#bundles.set(locale, bundle);
        }

        const resource = new FluentResource(source);
        const errors = bundle.addResource(resource, {
            allowOverrides: resourceOptions?.allowOverrides ??
                DEFAULT_ALLOW_OVERRIDES,
        });
        // todo: do something better with this
        return errors;
    }

    getLocales(): string[] {
        const locales: string[] = [];
        for (const bundle of this.#bundles.values()) {
            locales.push(...bundle.locales);
        }
        return locales;
    }

    translate<
        L extends Locales<LT>,
        M extends Messages<LT>,
        MK extends MessageKey<LT, M>,
    >(
        locale: L,
        messageKey: MK,
        ...args: M[MK] extends never ? []
            : { readonly [variable: string]: unknown } extends M[MK]
                ? [variables?: M[MK]]
            : [variables: M[MK]]
    ): string {
        debug(`Translating message '${messageKey}' in locale '${locale}'`);
        const variables = args[0];

        if (this.#bundles.size == 0) {
            throw new Error(
                "There are no locales available for translating the message",
            );
        }

        const key = parseMessageKey(messageKey);
        const negotiatedLocales = negotiateLanguages(
            [locale],
            this.getLocales(),
            { strategy: "filtering" },
        );
        for (const negotiatedLocale of negotiatedLocales) {
            const bundle = this.#bundles.get(negotiatedLocale);
            if (bundle == null) continue; // todo: throw or log?
            const pattern = getPattern(bundle, key);
            if (pattern == null) {
                const result = this.options.onMissingKey?.({
                    fallback: false,
                    locale: locale,
                    messageKey: key,
                });
                if (typeof result === "string") return result;
                else continue;
            }
            debug(`Translating using '${negotiatedLocale}' (from '${locale}')`);
            return formatPattern(bundle, pattern, variables);
        }

        // falls back
        debug(`Falling back to '${this.fallbackLocale}'`);
        const bundle = this.#bundles.get(this.fallbackLocale);
        if (bundle == null) {
            throw new Error(
                "There are no resources available for the fallbackLocale: " +
                    this.fallbackLocale,
            );
        }
        const pattern = getPattern(bundle, key);
        if (pattern != null) {
            return formatPattern(bundle, pattern, variables);
        }

        // todo: fully decide whether `translate` should throw or return
        //  `messageKey` as string, or let the user handle it.
        const result = this.options.onMissingKey?.({
            fallback: true,
            locale: locale,
            messageKey: key,
        });
        if (typeof result === "string") return result;

        throw new Error(
            `Couldn't find the ` +
                (key.attr != null ? `attribute '${key.attr}' in the ` : "") +
                `message '${key.id}' in the fallback locale '${this.fallbackLocale}'. ` +
                `At least the fallback locale must have all the messages you reference.`,
        );
    }
}

function getPattern(
    bundle: FluentBundle,
    key: Key,
): FluentPattern | null | undefined {
    const message = bundle.getMessage(key.id);
    if (message == null) return undefined;
    return key.attr === undefined
        ? message?.value
        : message?.attributes[key.attr];
}

function formatPattern<
    LT extends LocalesTypings,
    M extends Messages<LT>,
    MK extends MessageKey<LT, M>,
>(
    bundle: FluentBundle,
    pattern: FluentPattern,
    variables?: M[MK],
): string {
    const errors: Error[] = [];
    const formatted = bundle.formatPattern(pattern, variables, errors);
    for (const error of errors) {
        console.error(error);
    }
    return formatted;
}

function parseMessageKey(key: string): Key {
    const segments = key.trim().split(".");
    if (
        segments.length > 2 ||
        segments.some((s) => s.trim().length === 0)
    ) {
        throw new Error(`Invalid message key segments in key: '${key}'`);
    }
    return { id: segments[0], attr: segments[1] };
}
