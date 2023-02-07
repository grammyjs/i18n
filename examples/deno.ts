import {
  Bot,
  Context,
  session,
  SessionFlavor,
} from "https://deno.land/x/grammy@v1.14.1/mod.ts";
import { I18n, I18nFlavor } from "../src/mod.ts";

interface SessionData {
  apples: number;
}

type MyContext =
  & Context
  & I18nFlavor
  & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(""); // <-- put your bot token here (https://t.me/BotFather)

bot.use(session({
  initial: () => ({ apples: 0 }),
}));

const i18n = new I18n<MyContext>({
  defaultLocale: "en",
  useSession: true,
  directory: "locales",
  globalTranslationContext(ctx) {
    return {
      first_name: ctx.from?.first_name ?? "",
    };
  },
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
