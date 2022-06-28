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
  messageId: string,
  context?: TranslationContext,
) => string;

export interface I18nContextFlavor {
  i18n: {
    fluent: Fluent;
    getLocale(): Promise<string>;
    setLocale(locale: LocaleId): Promise<void>;
    useLocale(locale: LocaleId): void;
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
