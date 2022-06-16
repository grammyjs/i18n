import { Context, LocaleId } from "./platform.deno.ts";

export type LocaleNegotiator<C extends Context = Context> = (ctx: C) =>
  | LocaleId
  | undefined
  | PromiseLike<LocaleId | undefined>;

/**
 * Default implementation of locale negotiator
 * that returns locale specified in users Telegram settings.
 */
export const defaultLocaleNegotiator: LocaleNegotiator = (ctx) =>
  ctx.from?.language_code;
