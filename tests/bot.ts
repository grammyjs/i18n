import { Bot, Context, session, SessionFlavor } from "./deps.ts";
import { hears, I18n, I18nContextFlavor } from "../src/mod.ts";
import { makeTempLocalesDir } from "./utils.ts";

interface SessionData {
  apples: number;
}

type MyContext =
  & Context
  & I18nContextFlavor
  & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>("TOKEN");

bot.use(session({
  initial: (): SessionData => {
    return { apples: 0 };
  },
}));

export const i18n = new I18n({
  defaultLocale: "en",
  directory: makeTempLocalesDir(),
});

bot.use(i18n);

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting"));
});

bot.command("add", async (ctx) => {
  ctx.session.apples++;
  await ctx.reply(ctx.t("cart", {
    apples: ctx.session.apples,
  }));
});

bot.command("cart", async (ctx) => {
  await ctx.reply(ctx.t("cart", {
    apples: ctx.session.apples,
  }));
});

bot.command("checkout", async (ctx) => {
  ctx.session.apples = 0;
  // There is no message with the id 'checkout' in Russian translation. So, it
  // should log "Translation message (checkout) is not found for locale(s): ru"
  // and fall back to English, if the session locale is Russian.
  await ctx.reply(ctx.t("checkout"));
});

// We can't register this middleware before loading the locales.

bot.filter(hears("hello"), async (ctx) => {
  await ctx.reply(ctx.t("hello"));
});
