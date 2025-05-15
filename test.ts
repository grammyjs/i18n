import { I18n, I18nFlavor } from "./i18n.ts";
import { Bot, Context } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { GeneratedLocalesTypings } from "./locales/types.d.ts";
import { UserFromGetMe } from "https://deno.land/x/grammy@v1.36.1/types.ts";

type MyContext = Context & I18nFlavor<GeneratedMessageTypes>;

const adapter = new FluentAdapter<GeneratedMessageTypes>({
    fallbackLocale: "en",
});
adapter.loadResource(
    "en",
    `coo = ABCD {$lastChecked}
    .k = bruh`,
);
console.log(adapter.translate("de", "coo", {}));
console.log(adapter.translate("de", "coo", { lastChecked: 1 }));

const instance = new I18n<MyContext, GeneratedMessageTypes>(adapter);
const bot = new Bot<MyContext>("token");

bot.catch((err) => console.error(err));
bot.use(instance);

bot.on("msg", (ctx) => {
    console.log("Entering message handler");
    console.log(ctx.translate("coo"));
    console.log(ctx.translate("coo", { lastChecked: 1 }));
    console.log(ctx.translate("coo.k"));
    console.log(ctx.translate("coo.k", {}));
    console.log("Exiting message handler");
});

bot.botInfo = {} as UserFromGetMe;
bot.handleUpdate({
    update_id: 1,
    message: {
        chat: { id: 1, type: "private", first_name: "" },
        date: 1,
        from: { first_name: "", id: 1, is_bot: false },
        message_id: 1,
        text: "",
    },
});

class ABCD<K extends string = string> {
    constructor(opts: { k: () => Record<K, string> }) {
    }

    t(k: K) {}
}

const abcd = new ABCD({
    k: () => {
        return { "a": ["22"], "b": ["22"] } as const;
    },
    gv: "",
});
abcd.t("");
abcd.t("a");

type StringDifference<A extends string, B extends string> = string extends B ? A
    : Exclude<A, B>;

type StringDifferenceResult = StringDifference<
    "shit" | "nonShit" | "bullshit",
    string
>;

import { FluentAdapter } from "./adapter_fluent.ts";
import { KeyOf } from "./types.ts";

type NegotiatorResult = string | undefined;

type Negotiator<C extends Context> =
    | ((ctx: C) => NegotiatorResult)
    | ((ctx: C) => Promise<NegotiatorResult>);

const asyncNeg: Negotiator<Context> = () => {
    return Promise.resolve("en");
};

const syncNeg: Negotiator<Context> = () => {
    return "en";
};

type FnType<C extends Context, N extends Negotiator<C>> = ReturnType<N> extends
    Promise<NegotiatorResult> ? Promise<void>
    : ReturnType<N> extends NegotiatorResult ? void
    : never;

type A = FnType<Context, typeof asyncNeg>;
//   ^?
type B = FnType<Context, typeof syncNeg>;
//   ^?

type TranslateMessages = {
    msg1: { var1: string };
    msg2: { var1: string; var2: string };
    msg3: never; // or {} if you prefer
};

type TranslateFunctionX = <K extends keyof TranslateMessages>(
    key: K,
    ...args: TranslateMessages[K] extends never ? []
        : [variables: TranslateMessages[K]]
) => string;

let translate: TranslateFunctionX = (key: string, ...args: []) => {};

// Now you'll get proper autocompletion:
translate("msg1", { var1: "test" }); // OK
translate("msg2", { var1: "a", var2: "b" }); // OK
translate("msg3"); // OK
translate("");

type LocalesData<
    L extends string = string,
    M extends string = string,
    V extends string = string,
> = {
    locales: L;
    messages: {
        readonly [message in M]:
            | { readonly [variable in V]: unknown }
            | never;
    };
};
type Locales<LD extends LocalesData> = LD["locales"];
type Messages<LD extends LocalesData> = LD["messages"];
type MessageKey<LD extends LocalesData> = KeyOf<Messages<LD>>;
type TFn<
    LD extends LocalesData = LocalesData,
> = <M extends Messages<LD>, MK extends MessageKey<LD>>(
    messageKey: MK,
    ...args: M[MK] extends never ? []
        : [variables: M[MK]]
) => string;

class I<LD extends LocalesData = LocalesData> {
    constructor(o: {
        fallbackLocale: Locales<LD>;
    }) {
        console.log(o);
    }

    translate<M extends Messages<LD>, MK extends MessageKey<LD>, XX = M[MK]>(
        locale: Locales<LD>,
        key: MK,
        ...args: M[MK] extends never ? []
            : { readonly [variable: string]: unknown } extends M[MK]
                ? [variables?: M[MK]]
            : [variables: M[MK]]
    ) {
        console.log(locale, key, args);
    }
}

type SampleMessages = {
    locales: "en" | "de";
    messages: {
        readonly "vars": {
            readonly first: string;
        };
        readonly "no-vars": never;
    };
};

const i = new I<SampleMessages>({ fallbackLocale: "" });

i.translate("ff", "no-vars");
i.translate("de", "no-vars");
i.translate("de", "no-vars", {});
i.translate("de", "d");
i.translate("de", "vars", {});
i.translate("de", "vars", {
    name: "string",
});

const i2 = new I({ fallbackLocale: "" });

i2.translate("ff", "no-vars");
i2.translate("de", "no-vars");
i2.translate("de", "no-vars", {});
i2.translate("de", "vars");
i2.translate("de", "vars", {});
i2.translate("de", "vars", {
    first: "string",
});

const fluentAdapter = new FluentAdapter({ fallbackLocale: "" });
const i18n = new I18n(fluentAdapter);

i18n.translate("ff", "ee", {});
i18n.translate("ff", "ee", { dd: 1 });

const adapter2 = new FluentAdapter<SampleMessages>({
    fallbackLocale: "",
});

adapter2.translate("ff", "ee", {});
adapter2.translate("ff", "ee", { dd: 1 });

adapter2.translate("de", "no-vars");
adapter2.translate("de", "no-vars", {});
adapter2.translate("de", "no-vars", { dd: 1 });

adapter2.translate("de", "vars1");
adapter2.translate("de", "vars1", {});
adapter2.translate("de", "vars1", { dd: 1 });
adapter2.translate("de", "vars1", { first: "s" });

adapter2.translate("de", "vars2");
adapter2.translate("de", "vars2", {});
adapter2.translate("de", "vars2", { one: "" });
adapter2.translate("de", "vars2", { two: "" });
adapter2.translate("de", "vars2", { one: " ", two: "" });

const adapter3 = new FluentAdapter<GeneratedLocalesTypings>({
    fallbackLocale: "en",
});
adapter3.translate("en", "message", { theme: 1 });

adapter3.translate("de", "coo", { lastChecked: new Date() });
