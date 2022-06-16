import {
  Context,
  exists,
  extname,
  Fluent,
  FluentBundleOptions,
  FluentOptions,
  FluentType,
  FluentValue,
  LocaleId,
  Middleware,
  NextFunction,
  readLocalesDir,
  resolve,
  Scope,
  TranslationContext,
} from "./platform.deno.ts";

import {
  defaultLocaleNegotiator,
  LocaleNegotiator,
} from "./locale-negotiator.ts";

class FluentString extends FluentType<string> {
  constructor(value: string) {
    super(value);
  }

  toString(scope: Scope): string {
    let ctx = JSON.parse(scope.args?.ctx as string);
    const keys = this.value.split(".");
    for (const key of keys) {
      ctx = ctx[key];
    }
    return `${ctx}`;
  }
}

export type TranslateFunction = (
  messageId: string,
  context?: TranslationContext,
) => string;

export interface I18nContextFlavor {
  i18n: {
    fluentInstance: Fluent;
    getLocale(): Promise<string>;
    setLocale(locale: LocaleId): Promise<void>;
    useLocale(locale: LocaleId): string;
    reNegotiateLocale(): Promise<void>;
  };
  translate: TranslateFunction;
  t: TranslateFunction;
}

export interface I18nConfig<C extends Context = Context> {
  defaultLocale: LocaleId;
  directory?: string;
  fluentOptions?: FluentOptions;
  fluentBundleOptions: FluentBundleOptions;
  localeNegotiator?: LocaleNegotiator<C>;
  useSession?: boolean;
}

/**
 * A custom function for accessing `Context` properties directly from
 * Fluent translation files.
 */
function CTX(args: FluentValue[]) {
  const key = args[0];
  if (typeof key === "string") {
    return new FluentString(key);
  }
  throw new TypeError("Invalid argument to CTX");
}

export class I18n<C extends Context = Context> {
  private config: I18nConfig<C>;
  readonly fluentInstance: Fluent;
  readonly locales = new Array<string>();

  constructor(config: Partial<I18nConfig>) {
    this.config = {
      defaultLocale: "en",
      fluentBundleOptions: { functions: {} },
      ...config,
    };

    if (config.useSession) {
      this.config.localeNegotiator = function (ctx) {
        return config.localeNegotiator?.(ctx) ??
          // deno-lint-ignore no-explicit-any
          (ctx as any).session.__locale ??
          ctx.from?.language_code ??
          config.defaultLocale;
      };
    }

    if (
      this.config.fluentBundleOptions &&
      this.config.fluentBundleOptions.functions
    ) {
      this.config.fluentBundleOptions.functions["CTX"] = CTX;
    } else {
      this.config.fluentBundleOptions = {
        ...this.config.fluentBundleOptions,
        functions: { CTX },
      };
    }

    this.fluentInstance = new Fluent(this.config.fluentOptions);

    if (config.directory) {
      this.loadLocales(config.directory);
    }
  }

  /**
   * Load and register translations from a directory to the Fluent instance.
   * @param directory Path to the directory to look for the translation files.
   * Translation files in that directory should end with `.ftl` extension.
   */
  async loadLocales(directory: string): Promise<void> {
    if (!exists(directory)) {
      throw new Error(`Locales directory '${directory}' not found`);
    }

    for (const file of readLocalesDir(directory)) {
      const extension = extname(file);
      if (extension !== ".ftl") continue;

      const path = resolve(directory, file);
      const locale = file.substring(0, file.lastIndexOf("."));

      await this.fluentInstance.addTranslation({
        locales: locale,
        filePath: path,
        isDefault: locale === this.config.defaultLocale,
        bundleOptions: this.config.fluentBundleOptions,
      });

      this.locales.push(locale);
    }
  }

  /**
   * Loads and registers a translation to the Fluent instance.
   * @param locale Locale ID
   * @param options Options to specify the source and behavior of the translation.
   */
  async loadLocale(
    locale: LocaleId,
    options: {
      filePath?: string;
      source?: string;
      isDefault?: boolean;
      bundleOptions?: FluentBundleOptions;
    } = { bundleOptions: this.config.fluentBundleOptions },
  ): Promise<void> {
    await this.fluentInstance.addTranslation({
      locales: locale,
      isDefault: locale === this.config.defaultLocale,
      ...options,
    });

    this.locales.push(locale);
  }

  t(
    locale: LocaleId,
    messageId: string,
    context?: TranslationContext,
  ): string {
    return this.fluentInstance.translate(locale, messageId, context);
  }

  translate(
    locale: LocaleId,
    key: string,
    context?: TranslationContext,
  ): string {
    return this.fluentInstance.translate(locale, key, context);
  }

  /**
   * Returns a middleware to use in your Bot instance.
   */
  middleware(): Middleware<C> {
    const fluentInstance = this.fluentInstance;
    const {
      defaultLocale,
      localeNegotiator = defaultLocaleNegotiator,
      useSession,
    } = this.config;

    return async function (
      ctx: C,
      next: NextFunction,
    ): Promise<void> {
      let translate: TranslateFunction;

      Object.assign(
        ctx,
        <I18nContextFlavor> {
          i18n: {
            fluentInstance,
            reNegotiateLocale: negotiateLocale,
            useLocale,
            getLocale,
            setLocale,
          },
          t: translateWrapper,
          translate: translateWrapper,
        },
      );

      await negotiateLocale();
      await next();

      // Also exports ctx object properties for accessing them directly from
      // the translation source files.
      function translateWrapper(
        messageId: string,
        context?: TranslationContext,
      ): string {
        return translate(messageId, {
          first_name: ctx.from?.first_name ?? "",
          ctx: JSON.stringify({
            callbackQuery: ctx.callbackQuery,
            channelPost: ctx.channelPost,
            chatJoinRequest: ctx.chatJoinRequest,
            chatMember: ctx.chatMember,
            chat: ctx.chat,
            chosenInlineResult: ctx.chosenInlineResult,
            editedChannelPost: ctx.editedChannelPost,
            editedMessage: ctx.editedMessage,
            from: ctx.from,
            match: ctx.match,
            msg: ctx.msg,
            message: ctx.message,
            inlineQuery: ctx.inlineQuery,
            myChatMember: ctx.myChatMember,
            poll: ctx.poll,
            pollAnswer: ctx.pollAnswer,
            preCheckoutQuery: ctx.preCheckoutQuery,
            senderChat: ctx.senderChat,
            shippingQuery: ctx.shippingQuery,
            update: ctx.update,
          }),
          ...context,
        });
      }

      async function negotiateLocale(): Promise<void> {
        // Determining the locale to use for translations
        const negotiatedLocale = await localeNegotiator?.(ctx) ?? defaultLocale;
        useLocale(negotiatedLocale);
      }

      function useLocale(locale: LocaleId): void {
        translate = fluentInstance.withLocale(locale);
      }

      async function getLocale(): Promise<string> {
        return await localeNegotiator?.(ctx) ?? defaultLocale;
      }

      async function setLocale(locale: LocaleId): Promise<void> {
        if (useSession) {
          // deno-lint-ignore no-explicit-any
          (ctx as any).session.__locale = locale;
          await negotiateLocale();
        } else {
          useLocale(locale);
        }
      }
    };
  }
}
