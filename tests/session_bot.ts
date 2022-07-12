import { Bot, Context, session, SessionFlavor } from "./deps.ts";
import { I18n, I18nContextFlavor } from "../src/mod.ts";
import { makeTempLocalesDir } from "./utils.ts";

interface SessionData {
  __language_code?: string;
}

type MyContext =
  & Context
  & I18nContextFlavor
  & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>("TOKEN");

bot.use(session({
  initial: () => {
    return {};
  },
}));

const i18n = new I18n({
  defaultLocale: "en",
  directory: makeTempLocalesDir(),
  useSession: true,
  fluentBundleOptions: {
    useIsolating: false,
  },
});

bot.use(i18n);

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting"));
});

bot.command("language", async (ctx) => {
  if (ctx.match === "") {
    return await ctx.reply(ctx.t("language.hint"));
  }

  // `i18n.locales` contains all the locales that have been registered
  if (!i18n.locales.includes(ctx.match)) {
    return await ctx.reply(ctx.t("language.invalid-locale"));
  }

  // `ctx.i18n.getLocale` returns the locale currently using.
  if (await ctx.i18n.getLocale() === ctx.match) {
    return await ctx.reply(ctx.t("language.already-set"));
  }

  await ctx.i18n.setLocale(ctx.match);
  await ctx.reply(ctx.t("language.language-set"));
});
