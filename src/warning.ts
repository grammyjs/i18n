import { FluentBundle } from "./deps.ts";
import { TranslationVariables } from "./types.ts";

export enum TranslateWarnings {
  MISSING_MESSAGE,
  MISSING_ATTRIBUTE,
  MISSING_TRANSLATION,
}

export type Warning =
  | TranslateMissingMessageWarning
  | TranslateMissingAttributeWarning
  | TranslateMissingTranslationWarning;

export interface TranslateWarning {
  type: TranslateWarnings;
  locales: string[];
  path: string;
  matchedBundles: Set<FluentBundle>;
  context?: TranslationVariables;
}

export interface TranslateMissingMessageWarning extends TranslateWarning {
  type: TranslateWarnings.MISSING_MESSAGE;
  messageId: string;
  bundle: FluentBundle;
}

export interface TranslateMissingAttributeWarning extends TranslateWarning {
  type: TranslateWarnings.MISSING_ATTRIBUTE;
  messageId: string;
  attributeName: string;
  bundle: FluentBundle;
}

export interface TranslateMissingTranslationWarning extends TranslateWarning {
  type: TranslateWarnings.MISSING_TRANSLATION;
}

export type WarningHandler = (warning: Warning) => void;

export function defaultWarningHandler(
  // deno-lint-ignore no-explicit-any
  logFn: (...args: any) => void = console.warn,
): WarningHandler {
  return function (w: Warning) {
    switch (w.type) {
      case TranslateWarnings.MISSING_MESSAGE:
        logFn(
          `Translation message "${w.messageId}" is missing in the following ` +
            `locale(s): ${w.bundle.locales.join(", ")}.`,
        );
        break;
      case TranslateWarnings.MISSING_ATTRIBUTE:
        logFn(
          `"${w.attributeName}" attribute is missing in message ` +
            `"${w.messageId}" for locale(s): ${w.bundle.locales.join(", ")}`,
        );
        break;
      case TranslateWarnings.MISSING_TRANSLATION:
        logFn(
          `The translation "${w.path}" is missing in the locales: ` +
            w.locales.join(", "),
        );
        break;
      default:
        logFn(`Unknown warning: ${(w as { type: string }).type}`);
    }
  };
}
