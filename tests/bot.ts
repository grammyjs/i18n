import { Bot, Context, session, SessionFlavor } from "./deps.ts";
import { hears, I18n, I18nFlavor } from "../src/mod.ts";
import { makeTempLocalesDir } from "./utils.ts";

interface SessionData {
  apples: number;
}

type MyContext =
  & Context
  & I18nFlavor
  & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>("TOKEN");

bot.use(session({
  initial: () => ({ apples: 0 }),
}));

export const i18n = new I18n<MyContext>({
  defaultLocale: "en",
  directory: makeTempLocalesDir(),
  fluentBundleOptions: {
    useIsolating: false,
  },
  globalTranslationContext: (ctx) => ({
    name: ctx.from?.first_name || "",
  }),
});

bot.use(i18n);

bot.chatType("private").command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting", { name: ctx.from.first_name }));
});

bot.chatType("private").command("add", async (ctx) => {
  ctx.session.apples++;
  await ctx.reply(ctx.t("cart", {
    apples: ctx.session.apples,
  }));
});

bot.chatType("private").command("cart", async (ctx) => {
  await ctx.reply(ctx.t("cart", {
    apples: ctx.session.apples,
  }));
});

bot.chatType("private").command("checkout", async (ctx) => {
  ctx.session.apples = 0;
  await ctx.reply(ctx.t("checkout"));
});

bot.filter(hears("hello"), async (ctx) => {
  await ctx.reply(ctx.t("hello"));
});
