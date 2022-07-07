import {
  Context,
  Fluent,
  FluentBundleOptions,
  FluentOptions,
  LocaleId,
  TranslationContext,
} from "./deps.ts";

export type LocaleNegotiator<C extends Context = Context> = (ctx: C) =>
  | LocaleId
  | undefined
  | PromiseLike<LocaleId | undefined>;

export type TranslateFunction = (
  key: string,
  context?: TranslationContext,
) => string;

export interface I18nContextFlavor {
  /** I18n context namespace object */
  i18n: {
    /** Fluent instance used internally. */
    fluent: Fluent;
    /** Returns the current locale. */
    getLocale(): Promise<string>;
    /**
     * Equivalent for manually setting the locale in session and calling `renegotiateLocale()`.
     * If the `useSession` in the i18n configuration is set to true, sets the locale in session.
     * Otherwise throws an error.
     * You can suppress the error by using `useLocale()` instead.
     * @param locale Locale ID to set in the session.
     */
    setLocale(locale: LocaleId): Promise<void>;
    /**
     * Sets the specified locale to be used for future translations.
     * Effect lasts only for the duration of current update and is not preserved.
     * Could be used to change the translation locale in the middle of update processing
     * (e.g. when user changes the language).
     * @param locale Locale ID to set.
     */
    useLocale(locale: LocaleId): void;
    /**
     * You can manually trigger additional locale negotiation by calling this method.
     * This could be useful if locale negotiation conditions has changed and new locale must be applied
     * (e.g. user has changed the language and you need to display an answer in new locale).
     */
    renegotiateLocale(): Promise<void>;
  };
  /** Translation function bound to the current locale. */
  translate: TranslateFunction;
  /** Translation function bound to the current locale. */
  t: TranslateFunction;
}

export interface I18nConfig<C extends Context = Context> {
  /**
   * A locale ID to use by default.
   * This is used when locale negotiator and session (if enabled) returns an empty result.
   * The default value is "_en_".
   */
  defaultLocale: LocaleId;
  /**
   * Whether to use session to get and set language code.
   * You must be using session with it.
   */
  useSession?: boolean;
  /** Configuration for the Fluent instance used internally. */
  fluentOptions?: FluentOptions;
  /** Bundle options to use when adding a translation to the Fluent instance. */
  fluentBundleOptions: FluentBundleOptions;
  /** An optional function that determines which locale to use. Check the
   * [locale negotiation](https://github.com/grammyjs/i18n#locale-negotiation)
   * section below for more details. */
  localeNegotiator?: LocaleNegotiator<C>;
}
