import { Bot, Context, session, SessionFlavor } from "./test_deps.ts";
import { I18n, I18nContextFlavor } from "../src/mod.ts";

interface SessionData {
  apples: number;
}

type MyContext =
  & Context
  & I18nContextFlavor
  & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>("BOT_TOKEN"); // <-- Put your bot token here

bot.use(session({
  initial: (): SessionData => {
    return { apples: 0 };
  },
}));

export const i18n = new I18n({
  defaultLocale: "en",
});

await i18n.loadLocalesDir("tests/test_locales");

bot.use(i18n.middleware());

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