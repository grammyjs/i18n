type KeyOf<T> = string & keyof T;

export type LocalesTypings<
    L extends string = string,
    M extends string = string,
    VK extends string = string,
    VV extends string | number | Date | boolean =
        | string
        | number
        | Date
        | boolean, // todo: fix this, what was this?!!
> = {
    locales: L;
    messages: {
        readonly [message in M]:
            | { readonly [variable in VK]: VV }
            | never;
    };
};
export type Locales<LT extends LocalesTypings> = LT["locales"];
export type Messages<LT extends LocalesTypings> = LT["messages"];
export type MessageKey<
    LT extends LocalesTypings,
    M extends Messages<LT>,
> = KeyOf<M>;
export type MessageVariables<
    LT extends LocalesTypings,
    M extends Messages<LT>,
    MK extends MessageKey<LT, M>,
> = M[MK] extends never ? []
    : Messages<LocalesTypings>[string] extends M[MK] ? [variables?: M[MK]]
    : [variables: M[MK]];

/**
 * A format adapter is an abstraction that provides translation capabilities to
 * any localization format. Format adapters helps enable localization regardless
 * of the localization format used. Format adapters should manage the
 * translation resources and expose a translate function that can be called from
 * the i18n instance.
 */
export interface FormatAdapter<
    LT extends LocalesTypings,
> {
    /**
     * List of locales registered in the adapter.
     */
    locales: string[];
    /**
     * Compiles an array of the best-matched list of locales. If none of the
     * registered locales matched, then an empty array is returned, and fallback
     * is handled by i18n.
     *
     * @param requestedLocale The locale, for which the best matches are requested for.
     */
    negotiateLocales(requestedLocale: string): string[];
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

export interface ResourceLoadable<T> {
    /**
     * Accepts a translation resource as string.
     *
     * @param locale Locale which the resource belongs to.
     * @param source Resource content.
     * @param options Additional resource options.
     */
    loadResource(locale: string, source: string, options?: T): unknown;
}

export interface LoadLocalesDirectoryConfig<T> {
    /** Extensions of the files to read from. */
    extensions: string[];
    /** Resource options that are passed `loadResource`. */
    resourceOptions?: T;
    /**
     * Whether to include the common source files that are at the root of the
     * locales directory. These common source files are loaded into every locale.
     */
    includeCommonSources?: boolean;
    /** Whether to ignore dot (hidden) files */
    ignoreDotFiles?: boolean;
    /** Whether to follow symlinks to the realpath. */
    followSymlinks?: boolean;
}
