import {
  Context,
  Fluent,
  type FluentBundleOptions,
  FluentType,
  type FluentValue,
  type LocaleId,
  type MiddlewareFn,
  type NextFunction,
  resolve,
  type TranslationContext,
} from "./deps.ts";

import { readLocalesDir } from "./utils.ts";

import type {
  I18nConfig,
  I18nContextFlavor,
  TranslateFunction,
} from "./types.ts";

class FluentContext extends FluentType<string> {
  constructor(value: string, private defaultValue = "") {
    super(value);
  }

  // deno-lint-ignore no-explicit-any
  toString(scope: any): string {
    let ctx = JSON.parse(scope.args?.ctx as string);
    const keys = this.value.split(".");
    for (const key of keys) {
      ctx = ctx[key];
      if (ctx === undefined) break;
    }
    return ctx ?? this.defaultValue;
  }
}

/**
 * A custom Fluent function for accessing `Context` properties directly from
 * Fluent translation files.
 */
export function CTX(args: FluentValue[]) {
  if (args[1] && typeof args[1] !== "string") {
    throw new TypeError("CTX: Only string type is allowed for defaultValue.");
  }

  const key = args[0];
  const defaultValue = typeof args[1] === "string" ? args[1] : undefined;

  if (typeof key === "string") {
    return new FluentContext(key, defaultValue);
  }

  throw new TypeError(
    "CTX: Only type string is allowed for key.",
  );
}

export class I18n<C extends Context = Context> {
  private config: I18nConfig<C>;
  readonly fluent: Fluent;
  readonly locales = new Array<string>();

  constructor(config: Partial<I18nConfig>) {
    this.config = {
      defaultLocale: "en",
      fluentBundleOptions: { functions: {} },
      ...config,
    };

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

    this.fluent = new Fluent(this.config.fluentOptions);

    if (config.directory) {
      this.loadLocalesDir(config.directory);
    }
  }

  /**
   * Loads locales from the specified directory and registers them in the Fluent instance.
   * @param directory Path to the directory to look for the translation files.
   */
  loadLocalesDir(directory: string): void {
    for (const file of readLocalesDir(directory)) {
      const path = resolve(directory, file);
      const locale = file.substring(0, file.lastIndexOf("."));

      this.loadLocale(locale, {
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
  loadLocale(
    locale: LocaleId,
    options: {
      filePath?: string;
      source?: string;
      isDefault?: boolean;
      bundleOptions?: FluentBundleOptions;
    },
  ): void {
    this.fluent.addTranslation({
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
    key: string,
    locale: LocaleId,
    context?: TranslationContext,
  ): string {
    return this.translate(key, locale, context);
  }

  /** Gets a message by its key from the specified locale. */
  translate(
    key: string,
    locale: LocaleId,
    context?: TranslationContext,
  ): string {
    return this.fluent.translate(locale, key, context);
  }

  /** Returns a middleware to .use on the `Bot` instance. */
  middleware(): MiddlewareFn<C & I18nContextFlavor> {
    return middleware(this.fluent, this.config);
  }
}

function middleware<C extends Context = Context>(
  fluent: Fluent,
  { defaultLocale, localeNegotiator, useSession }: I18nConfig<C>,
) {
  return async function (
    ctx: C & I18nContextFlavor,
    next: NextFunction,
  ): Promise<void> {
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
      context?: TranslationContext,
    ): string {
      return translate(key, {
        first_name: ctx.from?.first_name ?? "",
        ctx: JSON.stringify(makeContextObject(ctx)),
        ...context,
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
  return function <C extends Context & I18nContextFlavor>(ctx: C) {
    const msg = ctx.message ?? ctx.channelPost;
    const actual = msg?.text ?? msg?.caption;
    const expected = ctx.t(key);
    return actual === expected;
  };
}

function makeContextObject(ctx: Context) {
  const keys = [
    "callbackQuery",
    "channelPost",
    "chatJoinRequest",
    "chatMember",
    "chat",
    "chosenInlineResult",
    "editedChannelPost",
    "editedMessage",
    "from",
    "match",
    "me",
    "msg",
    "message",
    "inlineQuery",
    "myChatMember",
    "poll",
    "pollAnswer",
    "preCheckoutQuery",
    "senderChat",
    "shippingQuery",
    "update",
  ];

  const obj: Record<string, unknown> = {};
  for (const key of keys) {
    if (ctx[key as keyof Context]) obj[key] = ctx[key as keyof Context];
  }
  return obj;
}
