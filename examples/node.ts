import { Bot, Context as BaseContext, session, SessionFlavor } from "grammy";
import { I18n, I18nFlavor } from "@grammyjs/i18n";

interface SessionData {
  __locale?: string;
  apples: number;
}

type MyContext =
  & BaseContext
  & I18nFlavor
  & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(""); // <-- put your bot token here (https://t.me/BotFather)

function initial(): SessionData {
  return { apples: 0 };
}

bot.use(session({ initial }));

const i18n = new I18n({
  defaultLocale: "en",
  useSession: true,
  directory: "locales",
});

bot.use(i18n);

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting"));
});

bot.command(["en", "de", "ku", "ckb"], async (ctx) => {
  const locale = ctx.msg.text.substring(1).split(" ")[0];
  await ctx.i18n.setLocale(locale);
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
  await ctx.reply(ctx.t("checkout"));
});

bot.start();
