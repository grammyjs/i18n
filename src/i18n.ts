import {
  Context,
  Fluent,
  type FluentBundleOptions,
  FluentType,
  type FluentValue,
  type LocaleId,
  type Middleware,
  type NextFunction,
  resolve,
  type Scope,
  type TranslationContext,
} from "./deps.ts";

import { exists, readLocalesDir } from "./utils.ts";

import type {
  I18nConfig,
  I18nContextFlavor,
  TranslateFunction,
} from "./types.ts";

class FluentContext extends FluentType<string> {
  constructor(value: string, private defaultValue = "") {
    super(value);
  }

  toString(scope: Scope): string {
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
 * A custom function for accessing `Context` properties directly from
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
    "CTX: Invalid argument type. Both key and defaultValue should be the type of string.",
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
  }

  /**
   * Load and register translations from a directory to the Fluent instance.
   * @param directory Path to the directory to look for the translation files.
   * Translation files in that directory should end with `.ftl` extension.
   */
  async loadLocalesDir(directory: string): Promise<void> {
    if (!exists(directory)) {
      throw new Error(`Locales directory '${directory}' not found`);
    }

    for (const file of readLocalesDir(directory)) {
      const path = resolve(directory, file);
      const locale = file.substring(0, file.lastIndexOf("."));

      await this.loadLocale(locale, {
        filePath: path,
        bundleOptions: this.config.fluentBundleOptions,
      });
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

  /** Get a message by its key from the specified locale. */
  t(
    locale: LocaleId,
    key: string,
    context?: TranslationContext,
  ): string {
    return this.fluent.translate(locale, key, context);
  }

  /** Get a message by its key from the specified locale. */
  translate(
    locale: LocaleId,
    key: string,
    context?: TranslationContext,
  ): string {
    return this.fluent.translate(locale, key, context);
  }

  /** Returns a middleware to .use on the `Bot` instance. */
  middleware(): Middleware<C & I18nContextFlavor> {
    const fluent = this.fluent;
    const { defaultLocale, localeNegotiator, useSession } = this.config;
    return async function (
      ctx: C & I18nContextFlavor,
      next: NextFunction,
    ): Promise<void> {
      let translate: TranslateFunction;

      ctx.i18n = {
        fluent,
        reNegotiateLocale: negotiateLocale,
        useLocale,
        getLocale: getNegotiatedLocale,
        setLocale,
      };
      ctx.t = translateWrapper;
      ctx.translate = translateWrapper;

      await negotiateLocale();
      await next();

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

      async function getNegotiatedLocale(): Promise<string> {
        return await localeNegotiator?.(ctx) ??
          // deno-lint-ignore no-explicit-any
          (await (useSession && (ctx as any).session))?.__language_code ??
          ctx.from?.language_code ??
          defaultLocale;
      }

      // Determining the locale to use for translations
      async function negotiateLocale(): Promise<void> {
        const negotiatedLocale = await getNegotiatedLocale();
        useLocale(negotiatedLocale);
      }

      function useLocale(locale: LocaleId): void {
        translate = fluent.withLocale(locale);
      }

      async function setLocale(locale: LocaleId): Promise<void> {
        if (!useSession) {
          throw new Error(
"You are calling `ctx.i18n.setLocale()` without setting `useSession` \
to `true` in the configuration. It doesn't make sense because you cannot set a \
locale in session that way. You should either enable sessions or use \
`ctx.i18n.useLocale()` instead.",
          );
        }

        // deno-lint-ignore no-explicit-any
        (await (ctx as any).session).__language_code = locale;
        await negotiateLocale();
      }
    };
  }
}

function makeContextObject(ctx: Context) {
  const keys: Array<keyof Context> = [
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
  for (const key of keys) obj[key] = ctx[key];
  return obj;
}
