import { createDebug } from "@grammyjs/debug";
import { FluentBundle, FluentResource, type Message } from "@fluent/bundle";
import type {
    FormatAdapter,
    Locales,
    LocalesTypings,
    MessageKey,
    Messages,
    ResourceLoadable,
} from "../../types.ts";
import { isValidLocale } from "../../utilities.ts";
import { negotiateLanguages } from "@fluent/langneg";

const debug = createDebug("grammy:i18n-fluent");

export type FluentPattern = Message["attributes"][string];
export type FluentBundleOptions = ConstructorParameters<typeof FluentBundle>[1];
export interface ResourceOptions {
    allowOverrides?: boolean;
    bundleOptions?: Partial<FluentBundleOptions>;
}
export interface FluentMessageKey {
    namespace: string;
    id: string;
    attr?: string;
}

const DEFAULT_ALLOW_OVERRIDES = false;
const DEFAULT_NAMESPACE = "";

/**
 * Official {@link FormatAdapter} for the Fluent syntax by Mozilla. This adapter
 * also supports loading resources; hence this can be plugged in with the
 * locales directory loading utilities for convenience.
 *
 * @see https://projectfluent.org/fluent/guide Syntax guide for Fluent syntax.
 */
export class FluentAdapter<LT extends LocalesTypings = LocalesTypings>
    implements FormatAdapter<LT>, ResourceLoadable<ResourceOptions> {
    // Structured as, Locale -> Namespace -> Bundles.
    // While FluentBundle-s are capable of being the carrier of more than one
    // locales at a time, here each bundle can carry only one locale.
    #bundles: Map<string, Map<string, FluentBundle>>;

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
        this.#bundles = new Map<string, Map<string, FluentBundle>>();
        this.#locales = [];
    }

    get locales(): LT["locales"][] {
        return this.#locales;
    }

    loadResource(
        locale: LT["locales"],
        source: string,
        namespace: LT["namespaces"] = DEFAULT_NAMESPACE,
        resourceOptions?: ResourceOptions,
    ): Error[] {
        if (!isValidLocale(locale))
            throw new Error(`The locale ${locale} seems invalid.`);

        let namespaceMap = this.#bundles.get(locale);
        if (namespaceMap == null) {
            debug(`Creating a namespace map for the locale '${locale}'`);
            namespaceMap = new Map<string, FluentBundle>();
            this.#bundles.set(locale, namespaceMap);

            if (!this.#locales.includes(locale))
                this.#locales.push(locale);
        }

        let bundle = namespaceMap.get(namespace);
        if (bundle == null) {
            debug(
                `Creating namespace '${namespace}' for the locale '${locale}'`,
            );
            bundle = new FluentBundle(locale, {
                ...this.options?.bundleOptions,
                ...resourceOptions?.bundleOptions,
            });
            namespaceMap.set(namespace, bundle);
        }

        const resource = new FluentResource(source);
        const errors = bundle.addResource(resource, {
            allowOverrides: resourceOptions?.allowOverrides ??
                DEFAULT_ALLOW_OVERRIDES,
        });
        // todo: do something better with this
        return errors;
    }

    negotiateLocales(requestedLocale: string): string[] {
        const negotiatedLocales = negotiateLanguages(
            [requestedLocale],
            this.locales,
            { strategy: "filtering" },
        );
        return negotiatedLocales;
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
        const namespaceMap = this.#bundles.get(locale);
        if (namespaceMap == null) return;

        const parsedKey = parseMessageKey(messageKey);
        const variables = args[0];
        const bundle = namespaceMap.get(parsedKey.namespace);
        if (bundle == null) return;

        const pattern = getPattern(bundle, parsedKey);
        if (pattern == null) return;
        return formatPattern(bundle, pattern, variables);
    }
}

function getPattern(
    bundle: FluentBundle,
    key: FluentMessageKey,
): FluentPattern | null | undefined {
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
    const trimmedKey = key.trim();
    const colonIndex = trimmedKey.indexOf(":");

    let namespace: string;
    let rest: string;
    if (colonIndex === -1) {
        namespace = DEFAULT_NAMESPACE;
        rest = trimmedKey;
    } else {
        namespace = trimmedKey.slice(0, colonIndex);
        rest = trimmedKey.slice(colonIndex + 1);
    }

    const segments = rest.split(".");
    if (segments.length > 2 || segments.some((s) => s.trim().length === 0))
        throw new Error(`Invalid message key segments in key: '${key}'`);

    return {
        namespace: namespace,
        id: segments[0],
        attr: segments[1],
    };
}
