import {
  Bot,
  Context as BaseContext,
  session,
  SessionFlavor,
} from "https://deno.land/x/grammy@v1.8.3/mod.ts";
import { Fluent } from "https://deno.land/x/better_fluent@v0.1.0/mod.ts";
import { FluentContextFlavor, useFluent } from "../src/mod.ts";

interface SessionData {
  apples: number;
}

type MyContext =
  & BaseContext
  & FluentContextFlavor
  & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(""); // <-- Put your bot token here

function initial(): SessionData {
  return { apples: 0 };
}

// Set the default parse mode to "HTML"
bot.api.config.use((prev, method, payload) =>
  prev(method, {
    ...payload,
    parse_mode: "HTML",
  })
);

bot.use(session({ initial }));

const fluent = new Fluent();

fluent.addTranslation({
  locales: "en-US",
  filePath: "./locales/en-US.ftl",
});

fluent.addTranslation({
  locales: "en",
  filePath: "./locales/en.ftl",
});

fluent.addTranslation({
  locales: "ru",
  filePath: "./locales/ru.ftl",
});

bot.use(useFluent({
  fluent,
  defaultLocale: "en",
}));

// Start message handler
bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting", {
    name: ctx.from!.first_name,
  }));
});

// Set locale to 'en-US'
bot.command("en", async (ctx) => {
  ctx.fluent.useLocale("en-US");
  // Should say NOT FOUND and fallback to 'en'.
  return await ctx.reply(ctx.t("greeting", {
    name: ctx.from!.first_name,
  }));
});

// Set locale to 'ru'
bot.command("ru", async (ctx) => {
  ctx.fluent.useLocale("ru");
  return await ctx.reply(ctx.t("greeting", {
    name: ctx.from!.first_name,
  }));
});

// Add apple to cart
bot.command("add", async (ctx) => {
  ctx.session.apples++;
  const message = ctx.t("cart", {
    name: ctx.from!.first_name,
    apples: ctx.session.apples,
  });
  return await ctx.reply(message);
});

bot.command("cart", async (ctx) => {
  const message = ctx.t("cart", {
    name: ctx.from!.first_name,
    apples: ctx.session.apples,
  });
  return await ctx.reply(message);
});

bot.command("checkout", async (ctx) => {
  await ctx.reply(ctx.t("checkout"));
});

bot.start();
