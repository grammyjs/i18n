export {
    I18n,
    type I18nFlavor,
    type LocaleNegotiator,
    type MissingKeyEvent,
    type NegotiatorResult,
    type TranslateFunction,
} from "./plugin.ts";
export type {
    CreateNamespaceResolverOptions,
    FormatAdapter,
    LoadLocalesDirectoryConfig,
    Locales,
    LocalesTypings,
    MessageKey,
    // todo: reconsider all the types
    Messages,
    MessageVariables,
    NamespaceResolverFn,
    ResourceLoadable,
} from "./types.ts";
export {
    createNamespaceResolver,
    isValidLocale,
    loadLocalesDirectory,
} from "./utilities.ts";
