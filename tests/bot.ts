import { Bot, Context, session, SessionFlavor } from "./deps.ts";
import { I18n, I18nContextFlavor } from "../src/mod.ts";

interface SessionData {
  apples: number;
}

type MyContext =
  & Context
  & I18nContextFlavor
  & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>(""); // <-- put your bot token here (https://t.me/BotFather)

bot.use(session({
  initial: (): SessionData => {
    return { apples: 0 };
  },
}));

export const i18n = new I18n({
  defaultLocale: "en",
});

// We're loading the locales here: ./bot.test.ts

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
