import {
  type Context,
  Fluent,
  type FluentBundleOptions,
  type HearsContext,
  type LocaleId,
  type MiddlewareFn,
  resolve,
  type TranslationContext,
} from "./deps.ts";

import { readLocalesDir, readLocalesDirSync } from "./utils.ts";

import type { I18nConfig, I18nFlavor, TranslateFunction } from "./types.ts";

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
      const path = resolve(directory, file);
      const locale = file.substring(0, file.lastIndexOf("."));

      await this.loadLocale(locale, {
        filePath: path,
        bundleOptions: this.config.fluentBundleOptions,
      });
    }));
  }

  /**
   * Loads locales from the specified directory and registers them in the Fluent instance.
   * @param directory Path to the directory to look for the translation files.
   */
  loadLocalesDirSync(directory: string): void {
    for (const file of readLocalesDirSync(directory)) {
      const path = resolve(directory, file);
      const locale = file.substring(0, file.lastIndexOf("."));

      this.loadLocaleSync(locale, {
        filePath: path,
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
    options: {
      filePath?: string;
      source?: string;
      isDefault?: boolean;
      bundleOptions?: FluentBundleOptions;
    },
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
    options: {
      filePath?: string;
      source?: string;
      isDefault?: boolean;
      bundleOptions?: FluentBundleOptions;
    },
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
   * Alias of `translate` method.
   */
  t(
    locale: LocaleId,
    key: string,
    context?: TranslationContext,
  ): string {
    return this.translate(locale, key, context);
  }

  /** Gets a message by its key from the specified locale. */
  translate(
    locale: LocaleId,
    key: string,
    context?: TranslationContext,
  ): string {
    return this.fluent.translate(locale, key, context);
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
    defaultTranslationContext,
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

    // Also exports ctx object properties for accessing them directly from
    // the translation source files.
    function translateWrapper(
      key: string,
      translationContext?: TranslationContext,
    ): string {
      return translate(key, {
        ...defaultTranslationContext?.(ctx),
        ...translationContext,
      });
    }

    ctx.i18n = {
      fluent,
      renegotiateLocale: negotiateLocale,
      useLocale,
      getLocale: getNegotiatedLocale,
      setLocale,
    };
    ctx.t = translateWrapper;
    ctx.translate = translateWrapper;

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
