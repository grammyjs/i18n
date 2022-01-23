import {
    Bot,
    Context,
    session,
    SessionFlavor,
  } from "https://deno.land/x/grammy/mod.ts";
  import { i18nMiddleware } from "../src/mod.ts";
  // @deno-types="https://cdn.jsdelivr.net/gh/i18next/i18next/index.d.ts"
  import i18next from "https://deno.land/x/i18next/index.js";
  import { i18n } from "../src/deps.deno.ts";
  
  interface SessionData {
    pizzaCount: number;
  }
  
  interface i18nFlavor {
    i18n: i18n;
  }
  const initOptions = {
    fallbackLng: "ru",
    resources: {
      en: {
        translation: {
          greeting: "<b>Hello {{first_name}}!</b>",
          cart_one: "{{first_name}}, You have one pizza in your cart.",
          cart_other: "{{first_name}}, You have {{number}} pizza in your cart.",
          checkout: "Thank you"
        },
      },
      de: {
        translation: {
          greeting: "<b>Hallo {{first_name}}!</b>",
          cart_one: "{{first_name}}, Du hast eine Pizza in deinem Warenkorb.",
          cart_other:
            "{{first_name}}, Du hast {{number}} Pizzen in deinem Warenkorb.",
          checkout: "Danke"
        },
      },
      ru: {
        translation: {
          greeting:
            "<b>I can't speak Russian. Hi {{first_name}}!</b>",
          cart_one:
            "No Russian: {{first_name}}, You have one pizza in your cart.",
          cart_other:
            "No Russian: {{first_name}}, You have {{number}} pizza in your cart.",
          checkout: "No Russian: Thank you"
        },
      },
    },
  };
  const i18nT = new i18nMiddleware(i18next, {
    i18nextOptions: initOptions,
    useSession: true,
  });
  type i18nFlavorContext = Context & i18nFlavor & SessionFlavor<SessionData>;
  
  const bot = new Bot<i18nFlavorContext>(" <Your Token needs to be here> "); // <-- place your token inside this string
  
  function initial(): SessionData {
    return { pizzaCount: 0 };
  }
  bot.use(session({ initial }));
  bot.use(i18nT.langDetect());
  // Start message handler
  bot.command(
    "start",
    async (ctx) => await ctx.reply(ctx.i18n.t("greeting", {first_name: ctx.from?.first_name}), { parse_mode: "HTML" })
  );
  
  // Set locale to `en`
  bot.command("en", async (ctx) => {
    ctx.i18n.changeLanguage("en");
    return await ctx.reply(ctx.i18n.t("greeting", {first_name: ctx.from?.first_name}), { parse_mode: "HTML" });
  });
  
  // Set locale to `ru`
  bot.command("ru", async (ctx) => {
    ctx.i18n.changeLanguage("ru");
    return await ctx.reply(ctx.i18n.t("greeting", {first_name: ctx.from?.first_name}), { parse_mode: "HTML" });
  });
  
  // Set locale to `de`
  bot.command("ru", async (ctx) => {
    ctx.i18n.changeLanguage("de");
    return await ctx.reply(ctx.i18n.t("greeting", {first_name: ctx.from?.first_name}), { parse_mode: "HTML" });
  });
  // Set locale to `en-US`
  bot.command("ru", async (ctx) => {
    ctx.i18n.changeLanguage("en-US");
    return await ctx.reply(ctx.i18n.t("greeting", {first_name: ctx.from?.first_name}), { parse_mode: "HTML" });
  });
  
  // Add apple to cart
  bot.command("add", async (ctx) => {
    ctx.session.pizzaCount++;
    const message = ctx.i18n.t("cart", { count: ctx.session.pizzaCount , number: ctx.session.pizzaCount, first_name: ctx.from?.first_name });
    return await ctx.reply(message);
  });
  
  // Add apple to cart
  bot.command("cart", async (ctx) => {
    const message = ctx.i18n.t("cart", { count: ctx.session.pizzaCount, number: ctx.session.pizzaCount , first_name: ctx.from?.first_name });
    return await ctx.reply(message);
  });
  
  // Checkout
  bot.command("checkout", async (ctx) => await ctx.reply(ctx.i18n.t("checkout")));
  
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  bot.start();
  