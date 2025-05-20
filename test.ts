import { Bot, type Context } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { FluentAdapter } from "./adapter_fluent.ts";
import type { GeneratedLocalesTypings } from "./locales/types.d.ts";
import { I18n, type I18nFlavor } from "./mod.ts";

type MyContext = I18nFlavor<Context, GeneratedLocalesTypings>;

const adapter = new FluentAdapter<GeneratedLocalesTypings>({});
adapter.translate("de", "coo", { lastChecked: 1 });
adapter.translate("de", "coo.k");

const i18n = new I18n<MyContext, GeneratedLocalesTypings>({
    adapter,
    fallbackLocale: "en",
});
i18n.translate("de", "cooked2.hype", { file2: "" });

const bot = new Bot<MyContext>("");
bot.on("msg", (ctx) => {
    ctx.translate("coo", { lastChecked: 1 });
});
