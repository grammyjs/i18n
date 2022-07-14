import {
  Bot,
  Context,
  session,
  SessionFlavor,
} from "https://deno.land/x/grammy@v1.9.0/mod.ts";
import { I18n, I18nContextFlavor } from "../src/mod.ts";

interface SessionData {
  __language_code?: string;
  apples: number;
}

type MyContext =
  & Context
  & I18nContextFlavor
  & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(""); // <-- put your bot token here (https://t.me/BotFather)

bot.use(session({
  initial: (): SessionData => {
    return { apples: 0 };
  },
}));

const i18n = new I18n({
  defaultLocale: "en",
  useSession: true,
  directory: "locales",
});

bot.use(i18n);

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting"));
});

bot.command("en", async (ctx) => {
  // If 'useSession' is set to true, updates the session;
  // otherwise throws an error. You can use ctx.i18n.useLocale("en")
  // instead to suppress the error.
  await ctx.i18n.setLocale("en");
  await ctx.reply(ctx.t("language-set"));
});

// Set locale to 'ru'
bot.command("ru", async (ctx) => {
  // This is the manual way of doing await ctx.i18n.setLocale("ru");
  ctx.session.__language_code = "ru";
  // To refresh the chosen locale according to
  // the new session updates.
  await ctx.i18n.renegotiateLocale();

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
  // There is no message with the id 'checkout' in Russian translation. So, it
  // should log "Translation message (checkout) is not found for locale(s): ru"
  // and fall back to English, if the session locale is Russian.
  await ctx.reply(ctx.t("checkout"));
});

bot.start();
