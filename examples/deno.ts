import {
  Bot,
  Context as BaseContext,
  session,
  SessionFlavor,
} from "https://deno.land/x/grammy@v1.8.3/mod.ts";
import { I18n, I18nContextFlavor } from "../src/mod.ts";

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
  directory: "locales",
  defaultLocale: "en",
  useSession: true,
});

bot.use(i18n.middleware());

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting"));
});

bot.command("en", async (ctx) => {
  // If 'useSession' is set to true, updates the session;
  // and if not, only uses the locale temporarily, which is
  // equivalent for ctx.i18n.useLocale("en");
  await ctx.i18n.setLocale("en");
  await ctx.reply(ctx.t("language-set"));
});

// Set locale to 'ru'
bot.command("ru", async (ctx) => {
  // This is the manual way of doing ctx.i18n.setLocale("ru");
  ctx.session.__locale = "ru";
  await ctx.i18n.reNegotiateLocale();

  await ctx.reply(ctx.t("language-set"));
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