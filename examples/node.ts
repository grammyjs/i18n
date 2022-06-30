import { Bot, Context as BaseContext, session, SessionFlavor } from "grammy";
import { I18n, I18nContextFlavor } from "@grammyjs/i18n";

interface SessionData {
  __locale?: string;
  apples: number;
}

type MyContext =
  & BaseContext
  & I18nContextFlavor
  & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(""); // <-- Put your bot token here

function initial(): SessionData {
  return { apples: 0 };
}

bot.use(session({ initial }));

const i18n = new I18n({
  defaultLocale: "en",
  useSession: true,
});

i18n.loadLocalesDir("locales");

bot.use(i18n.middleware());

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting"));
});

bot.command("en", async (ctx) => {
  // This will set the locale in session and use it.
  await ctx.i18n.setLocale("en");
  await ctx.reply(ctx.t("greeting"));
});

// Set locale to 'ru'
bot.command("ru", async (ctx) => {
  ctx.session.__locale = "ru";
  await ctx.i18n.renegotiateLocale();
  await ctx.reply(ctx.t("greeting"));
});

// Add apple to cart
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
  // Should log "Translation message (checkout) is not found for locale(s): ru"
  // and fall back to English, if the session locale is Russian.
  await ctx.reply(ctx.t("checkout"));
});

bot.start();
