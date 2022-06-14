import {
  Context,
  Fluent,
  LocaleId,
  Middleware,
  NextFunction,
  TranslationContext,
} from "./deps.deno.ts";

import {
  defaultLocaleNegotiator,
  LocaleNegotiator,
} from "./locale-negotiator.ts";

export interface GrammyFluentOptions<
  ContextType extends Context = Context,
> {
  fluent: Fluent;
  defaultLocale?: LocaleId;
  localeNegotiator?: LocaleNegotiator<ContextType>;
}

export type TranslateFunction = (
  (messageId: string, context?: TranslationContext) => string
);

export interface FluentContextFlavor {
  fluent: {
    instance: Fluent;
    renegotiateLocale: () => Promise<void>;
    useLocale: (locale: LocaleId) => void;
  };
  translate: TranslateFunction;
  t: TranslateFunction;
}

const fallbackLocale = "en";

export function useFluent<
  ContextType extends Context = Context,
>(
  options: GrammyFluentOptions<ContextType>,
): Middleware<ContextType> {
  const {
    fluent,
    defaultLocale = fallbackLocale,
    localeNegotiator = defaultLocaleNegotiator,
  } = options;

  /**
   * Middleware function that adds fluent functionality
   * to the context object.
   */
  return async function fluentMiddleware(
    context: ContextType,
    next: NextFunction,
  ): Promise<void> {
    // A reference to the current translation function,
    // which could be changed dynamically
    let translate: TranslateFunction;

    // Translate wrapping function that delegates
    // all the calls to the current `translate`,
    // using this wrapper function in the context
    // allows us to update context only once and
    // have more dynamic translate function
    const translateWrapper: TranslateFunction = (
      (messageId, context) => translate(messageId, context)
    );

    // Adding custom properties to the context
    Object.assign(
      context,
      <FluentContextFlavor> {
        fluent: {
          instance: fluent,
          renegotiateLocale: negotiateLocale,
          useLocale,
        },
        translate: translateWrapper,
        t: translateWrapper,
      },
    );

    // This will negotiate locale initially and set
    // the translate function reference
    await negotiateLocale();

    await next();

    /**
     * Calls locale negotiator to determine the locale
     * and updates the translate function reference to
     * use the determined locale.
     */
    async function negotiateLocale() {
      // Determining the locale to use for translations
      const locale = <LocaleId> (
        await localeNegotiator?.(context) ||
        defaultLocale
      );

      useLocale(locale);
    }

    /**
     * Updated the translate function reference to use
     * the specified locale.
     */
    function useLocale(locale: LocaleId) {
      translate = fluent.withLocale(locale);
    }
  };
}
