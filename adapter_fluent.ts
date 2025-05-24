import {
    FluentBundle,
    FluentResource,
    type Message,
} from "npm:@fluent/bundle@0.19.1";
import { createDebug } from "jsr:@grammyjs/debug@0.2.1";
import { isValidLocale } from "./utilities.ts";
import type {
    FormatAdapter,
    Locales,
    LocalesTypings,
    MessageKey,
    Messages,
    ResourceLoadable,
} from "./types.ts";

const debug = createDebug("grammy:i18n-fluent");

export type FluentPattern = Message["attributes"][string];
export type FluentBundleOptions = ConstructorParameters<typeof FluentBundle>[1];
export interface ResourceOptions {
    allowOverrides?: boolean;
    bundleOptions?: Partial<FluentBundleOptions>;
}
export interface FluentMessageKey {
    id: string;
    attr?: string;
}

const DEFAULT_ALLOW_OVERRIDES = false;

/**
 * Official {@link FormatAdapter} for the Fluent syntax by Mozilla. This adapter
 * also supports loading resources; hence this can be plugged in with the
 * locales directory loading utilities for convenience.
 *
 * @see https://projectfluent.org/fluent/guide Syntax guide for Fluent syntax.
 */
export class FluentAdapter<LT extends LocalesTypings = LocalesTypings>
    implements FormatAdapter<LT>, ResourceLoadable<ResourceOptions> {
    // While FluentBundle-s are capable of being the carrier of more than one
    // locales at a time, here each bundle can carry only one locale.
    #bundles: Map<string, FluentBundle>;

    #locales: string[];

    constructor(
        private options?: {
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
        },
    ) {
        this.#bundles = new Map<string, FluentBundle>();
        this.#locales = [];
    }

    get locales(): string[] {
        return this.#locales;
    }

    loadResource(
        locale: string,
        source: string,
        resourceOptions?: ResourceOptions,
    ): Error[] {
        if (!isValidLocale(locale))
            throw new Error(`The locale ${locale} seems invalid.`);

        let bundle: FluentBundle | undefined = this.#bundles.get(locale);
        if (bundle == null || !(bundle instanceof FluentBundle)) {
            // todo: should allow multiple locales per bundle? Seems useless in
            //  this case. if we do, need to change Map<locale, bundle> to array
            bundle = new FluentBundle(locale, {
                ...this.options?.bundleOptions,
                ...resourceOptions?.bundleOptions,
            });
            debug(`Creating a bundle for the locale '${locale}'`);
            this.#bundles.set(locale, bundle);

            for (const locale of bundle.locales)
                if (!this.#locales.includes(locale))
                    this.#locales.push(locale);
        }

        const resource = new FluentResource(source);
        const errors = bundle.addResource(resource, {
            allowOverrides: resourceOptions?.allowOverrides ??
                DEFAULT_ALLOW_OVERRIDES,
        });
        // todo: do something better with this
        return errors;
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
        const bundle = this.#bundles.get(locale);
        if (bundle == null) return; // todo: throw or log?
        const pattern = getPattern(bundle, messageKey);
        if (pattern == null) return;
        return formatPattern(bundle, pattern, variables);
    }
}

function getPattern(
    bundle: FluentBundle,
    messageKey: string,
): FluentPattern | null | undefined {
    const key = parseMessageKey(messageKey);
    const message = bundle.getMessage(key.id);
    if (message == null)
        return undefined;
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
    for (const error of errors)
        console.error(error); // todo: handle this
    return formatted;
}

export function parseMessageKey(key: string): FluentMessageKey {
    const segments = key.trim().split(".");
    if (
        segments.length > 2 ||
        segments.some((s) => s.trim().length === 0)
    ) {
        throw new Error(`Invalid message key segments in key: '${key}'`);
    }
    return { id: segments[0], attr: segments[1] };
}
