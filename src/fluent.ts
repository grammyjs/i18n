import {
  defaultWarningHandler,
  TranslateWarnings,
  WarningHandler,
} from "./warning.ts";
import type {
  AddTranslationOptions,
  FluentBundleOptions,
  FluentOptions,
  LocaleId,
  MaybeArray,
  TranslationVariables,
} from "./types.ts";
import { FluentBundle, FluentResource, negotiateLanguages } from "./deps.ts";

export class Fluent {
  private readonly bundles = new Set<FluentBundle>();
  private defaultBundle?: FluentBundle;
  private handleWarning: WarningHandler = defaultWarningHandler();

  constructor(options?: FluentOptions) {
    if (options?.warningHandler) {
      this.handleWarning = options.warningHandler;
    }
  }

  public async addTranslation(options: AddTranslationOptions): Promise<void> {
    const source = "source" in options && "filePath" in options
      ? undefined
      : "source" in options && options.source
      ? options.source
      : "filePath" in options && options.filePath
      ? await Deno.readTextFile(options.filePath)
      : undefined;
    if (source === undefined) {
      throw new Error(
        "Provide either filePath or string source as translation source.",
      );
    }
    this.addBundle(options, source);
  }

  public addTranslationSync(options: AddTranslationOptions): void {
    const source = "source" in options && "filePath" in options
      ? undefined
      : "source" in options && options.source
      ? options.source
      : "filePath" in options && options.filePath
      ? Deno.readTextFileSync(options.filePath)
      : undefined;
    if (source === undefined) {
      throw new Error(
        "Provide either filePath or string source as translation source.",
      );
    }
    this.addBundle(options, source);
  }

  public translate<K extends string>(
    localeOrLocales: MaybeArray<LocaleId>,
    path: string,
    context?: TranslationVariables<K>,
  ): string {
    const locales = Array.isArray(localeOrLocales)
      ? localeOrLocales
      : [localeOrLocales];
    const [messageId, attributeName] = path.split(".", 2);
    const bundles = this.matchBundles(locales);
    const warning = { locales, path, matchedBundles: bundles, context };

    for (const bundle of bundles) {
      const message = bundle.getMessage(messageId);
      if (message === undefined) {
        this.handleWarning({
          ...warning,
          type: TranslateWarnings.MISSING_MESSAGE,
          bundle,
          messageId,
        });
        continue;
      }
      let pattern = message.value ?? "";
      if (attributeName) {
        if (message.attributes?.[attributeName]) {
          pattern = message.attributes?.[attributeName];
        } else {
          this.handleWarning({
            ...warning,
            type: TranslateWarnings.MISSING_ATTRIBUTE,
            attributeName,
            bundle,
            messageId,
          });
          continue;
        }
      }
      return bundle.formatPattern(pattern, context);
    }
    // None of the bundles worked out for the given message.
    this.handleWarning({
      ...warning,
      type: TranslateWarnings.MISSING_TRANSLATION,
    });
    return `{${path}}`;
  }

  /**
   * Returns translation function bound to the specified locale(s).
   */
  public withLocale(localeOrLocales: MaybeArray<LocaleId>) {
    return this.translate.bind(this, localeOrLocales);
  }

  private createBundle(
    locales: MaybeArray<LocaleId>,
    source: string,
    bundleOptions?: FluentBundleOptions,
  ): FluentBundle {
    const bundle = new FluentBundle(locales, bundleOptions);
    const resource = new FluentResource(source);
    const errors = bundle.addResource(resource, { allowOverrides: true });
    if (errors.length === 0) return bundle;
    for (const error of errors) console.error(error);
    throw new Error(
      "Failed to add resource to the bundle, see the errors above.",
    );
  }

  private addBundle(options: AddTranslationOptions, source: string) {
    const bundle = this.createBundle(
      options.locales,
      source,
      options.bundleOptions,
    );
    this.bundles.add(bundle);
    if (!this.defaultBundle || options.isDefault) {
      this.defaultBundle = bundle;
    }
  }

  private matchBundles(locales: LocaleId[]): Set<FluentBundle> {
    const bundles = Array.from(this.bundles);

    // Building a list of all the registered locales
    const availableLocales = bundles.reduce<LocaleId[]>(
      (locales, bundle) => [...locales, ...bundle.locales],
      [],
    );
    // Find the best match for the specified locale
    const matchedLocales = negotiateLanguages(locales, availableLocales);
    // For matched locales, find the first bundle they're in.
    const matchedBundles = matchedLocales.map((locale) => {
      return bundles.find((bundle) => bundle.locales.includes(locale));
    }).filter((bundle) => bundle !== undefined) as FluentBundle[];

    // Add the default bundle to the end, so it'll be used if other bundles fails.
    if (this.defaultBundle) matchedBundles.push(this.defaultBundle);
    return new Set(matchedBundles);
  }
}
