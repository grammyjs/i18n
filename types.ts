import type { Context } from "https://lib.deno.dev/x/grammy@1.x/mod.ts";

export type KeyOf<T> = string & keyof T;
export type StringWithSuggestions<S extends string> =
    | string & Record<never, never>
    | S;

export type NegotiatorResult = string | undefined;
export type LocaleNegotiator<C extends Context> = (
    ctx: C,
) => NegotiatorResult | Promise<NegotiatorResult>;

export type LocalesTypings<
    L extends string = string,
    M extends string = string,
    V extends string = string,
    VV extends string | number | Date = string | number | Date, // todo: fix this
> = {
    locales: L;
    messages: {
        readonly [message in M]:
            | { readonly [variable in V]: VV }
            | never;
    };
};
export type Locales<LT extends LocalesTypings> = LT["locales"];
export type Messages<LT extends LocalesTypings> = LT["messages"];
export type MessageKey<
    LT extends LocalesTypings,
    M extends Messages<LT>,
> = KeyOf<M>;

export type TranslateFunction<LT extends LocalesTypings> = <
    MK extends MessageKey<LT, Messages<LT>>,
>(
    messageKey: MK,
    ...args: Messages<LT>[MK] extends never ? []
        : { readonly [variable: string]: unknown } extends Messages<LT>[MK]
            ? [variables?: Messages<LT>[MK]]
        : [variables: Messages<LT>[MK]]
) => string;

export interface ResourceLoadable<T> {
    /**
     * Accepts a translation resource as string.
     *
     * @param locale Locale which the resource belongs to.
     * @param source Resource content.
     * @param options Additional resource options.
     */
    loadResource(locale: string, source: string, options?: T): unknown;
}
