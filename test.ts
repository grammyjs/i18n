import { Bot, Context } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { FluentAdapter } from "./adapter_fluent.ts";
import type { GeneratedLocalesTypings } from "./locales/types.d.ts";
import { I18n, type I18nFlavor } from "./mod.ts";

type FlavoredContext = I18nFlavor<Context, GeneratedLocalesTypings>;
const bot = new Bot<FlavoredContext>("");

const i18n = new I18n({
    adapter: new FluentAdapter(),
    fallbackLocale: "en",
});
bot.use(i18n);

bot.on("msg", (ctx) => {
    ctx.translate("cooked2.hype", { file2: "" });
});
