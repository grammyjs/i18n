import type { Context, HearsContext, MiddlewareFn } from "./deps.ts";
import { Fluent } from "./fluent.ts";
import type {
  I18nConfig,
  I18nFlavor,
  LoadLocaleOptions,
  LocaleId,
  TranslateFunction,
  TranslationVariables,
} from "./types.ts";
import { readLocalesDir, readLocalesDirSync } from "./utils.ts";

export class I18n<C extends Context = Context> {
  private config: I18nConfig<C>;
  readonly fluent: Fluent;
  readonly locales = new Array<string>();

  constructor(config: Partial<I18nConfig<C>>) {
    this.config = { defaultLocale: "en", ...config };
    this.fluent = new Fluent(this.config.fluentOptions);
    if (config.directory) {
      this.loadLocalesDirSync(config.directory);
    }
  }

  /**
   * Loads locales from the specified directory and registers them in the Fluent instance.
   * @param directory Path to the directory to look for the translation files.
   */
  async loadLocalesDir(directory: string): Promise<void> {
    const localeFiles = await readLocalesDir(directory);
    await Promise.all(localeFiles.map(async (file) => {
      await this.loadLocale(file.belongsTo, {
        source: file.translationSource,
        bundleOptions: this.config.fluentBundleOptions,
      });
    }));
  }

  /**
   * Loads locales from any existing nested file or folder within the specified directory and registers them in the Fluent instance.
   * @param directory Path to the directory to look for the translation files.
   */
  loadLocalesDirSync(directory: string): void {
    for (const file of readLocalesDirSync(directory)) {
      this.loadLocaleSync(file.belongsTo, {
        source: file.translationSource,
        bundleOptions: this.config.fluentBundleOptions,
      });
    }
  }

  /**
   * Registers a locale in the Fluent instance based on the provided options.
   * @param locale Locale ID
   * @param options Options to specify the source and behavior of the translation
   */
  async loadLocale(
    locale: LocaleId,
    options: LoadLocaleOptions,
  ): Promise<void> {
    await this.fluent.addTranslation({
      locales: locale,
      isDefault: locale === this.config.defaultLocale,
      bundleOptions: this.config.fluentBundleOptions,
      ...options,
    });

    this.locales.push(locale);
  }

  /**
   * Synchronously registers a locale in the Fluent instance based on the provided options.
   * @param locale Locale ID
   * @param options Options to specify the source and behavior of the translation
   */
  loadLocaleSync(
    locale: LocaleId,
    options: LoadLocaleOptions,
  ): void {
    this.fluent.addTranslationSync({
      locales: locale,
      isDefault: locale === this.config.defaultLocale,
      bundleOptions: this.config.fluentBundleOptions,
      ...options,
    });

    this.locales.push(locale);
  }

  /**
   * Gets a message by its key from the specified locale.
   * Alias of `translate`.
   */
  t<K extends string>(
    locale: LocaleId,
    key: string,
    variables?: TranslationVariables<K>,
  ): string {
    return this.translate(locale, key, variables);
  }

  /** Gets a message by its key from the specified locale. */
  translate<K extends string>(
    locale: LocaleId,
    key: string,
    variables?: TranslationVariables<K>,
  ): string {
    return this.fluent.translate(locale, key, variables);
  }

  /** Returns a middleware to .use on the `Bot` instance. */
  middleware(): MiddlewareFn<C & I18nFlavor> {
    return middleware(this.fluent, this.config);
  }
}

function middleware<C extends Context = Context>(
  fluent: Fluent,
  {
    defaultLocale,
    localeNegotiator,
    useSession,
    globalTranslationContext,
  }: I18nConfig<C>,
): MiddlewareFn<C & I18nFlavor> {
  return async function (ctx, next): Promise<void> {
    let translate: TranslateFunction;

    function useLocale(locale: LocaleId): void {
      translate = fluent.withLocale(locale);
    }

    async function getNegotiatedLocale(): Promise<string> {
      return await localeNegotiator?.(ctx) ??
        // deno-lint-ignore no-explicit-any
        (await (useSession && (ctx as any).session))?.__language_code ??
        ctx.from?.language_code ??
        defaultLocale;
    }

    async function setLocale(locale: LocaleId): Promise<void> {
      if (!useSession) {
        throw new Error(
          "You are calling `ctx.i18n.setLocale()` without setting `useSession` to `true` \
in the configuration. It doesn't make sense because you cannot set a locale in \
the session that way. When you call `ctx.i18n.setLocale()`, the bot tries to \
store the user locale in the session storage. But since you don't have session \
enabled, it cannot store the locale information in the session storage. You \
should either enable sessions or use `ctx.i18n.useLocale()` instead.",
        );
      }

      // deno-lint-ignore no-explicit-any
      (await (ctx as any).session).__language_code = locale;
      await negotiateLocale();
    }

    // Determining the locale to use for translations
    async function negotiateLocale(): Promise<void> {
      const negotiatedLocale = await getNegotiatedLocale();
      useLocale(negotiatedLocale);
    }

    Object.defineProperty(ctx, "i18n", {
      value: {
        fluent,
        renegotiateLocale: negotiateLocale,
        useLocale,
        getLocale: getNegotiatedLocale,
        setLocale,
      },
      // Allow redefine property. This is necessary to be able to install the plugin
      // inside the conversation even if the plugin is already installed globally.
      writable: true,
    });

    ctx.translate = <K extends string>(
      key: string,
      translationVariables?: TranslationVariables<K>,
    ): string => {
      return translate(key, {
        ...globalTranslationContext?.(ctx),
        ...translationVariables,
      });
    };
    ctx.t = ctx.translate;

    await negotiateLocale();
    await next();
  };
}

/**
 * A filter middleware for listening to the messages send by the in their language.
 * It is useful when you have to listen for custom keyboard texts.
 *
 * ```ts
 * bot.filter(hears("menu-btn"), (ctx) => ...)
 * ```
 *
 * @param key Key of the message to listen for.
 */
export function hears(key: string) {
  return function <C extends Context & I18nFlavor>(
    ctx: C,
  ): ctx is HearsContext<C> {
    const expected = ctx.t(key);
    return ctx.hasText(expected);
  };
}
