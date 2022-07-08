import { bot, i18n } from "./bot.ts";
import { assertEquals, Chats } from "./deps.ts";

const chats = new Chats(bot);

Deno.test("Load locales and check registered", () => {
  assertEquals(i18n.locales.sort(), ["en", "ru"]);
});

Deno.test("English user", async (t) => {
  const user = chats.newUser({
    id: 5147129198, // E N G L I S H
    first_name: "English",
    last_name: "User",
    language_code: "en",
  });

  await t.step("Hears `hello`", async () => {
    // We can't register this middleware before loading the locales.
    bot.hears(i18n.t("hello"), async (ctx) => {
      await ctx.reply(ctx.t("hello"));
    });
    await user.sendMessage("Hello!");
    assertEquals(user.last.text, i18n.t("en", "hello"));
  });

  await t.step("start command", async () => {
    await user.command("start");
    assertEquals(
      user.last.text,
      i18n.t("en", "greeting", { first_name: "English" }),
    );
  });

  await t.step("empty cart", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      i18n.t("en", "cart", { first_name: "English", apples: 0 }),
    );
  });

  await t.step("add one apple in session", async () => {
    await user.command("add");
    assertEquals(
      user.last.text,
      i18n.t("en", "cart", { first_name: "English", apples: 1 }),
    );
  });

  await t.step("checkout command", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, i18n.t("en", "checkout"));
  });

  await t.step("check if cart is empty after checkout", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      i18n.t("en", "cart", { first_name: "English", apples: 0 }),
    );
  });

  await t.step("add 10 apples in session", async () => {
    for (let i = 0; i < 10; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      i18n.t("en", "cart", { first_name: "English", apples: 10 }),
    );
  });

  await t.step("are there 10 apples in session", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      i18n.t("en", "cart", { first_name: "English", apples: 10 }),
    );
  });

  await t.step("add 5 more apples in session", async () => {
    for (let i = 0; i < 5; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      i18n.t("en", "cart", { first_name: "English", apples: 15 }),
    );
  });

  await t.step("checkout again", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, i18n.t("en", "checkout"));
  });
});

Deno.test("Russian user", async (t) => {
  const user = chats.newUser({
    id: 182119199114, // R U S S I A N
    first_name: "Russian",
    last_name: "User",
    language_code: "ru",
  });

  await t.step("start command", async () => {
    await user.command("start");
    assertEquals(
      user.last.text,
      i18n.t("ru", "greeting", { first_name: "Russian" }),
    );
  });

  await t.step("empty cart", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      i18n.t("ru", "cart", { first_name: "Russian", apples: 0 }),
    );
  });

  await t.step("checkout command", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, i18n.t("ru", "checkout"));
  });

  await t.step("check if cart is empty after checkout", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      i18n.t("ru", "cart", { first_name: "Russian", apples: 0 }),
    );
  });

  await t.step("add 10 apples in session", async () => {
    for (let i = 0; i < 10; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      i18n.t("ru", "cart", { first_name: "Russian", apples: 10 }),
    );
  });

  await t.step("are there 10 apples in session", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      i18n.t("ru", "cart", { first_name: "Russian", apples: 10 }),
    );
  });

  await t.step("add 5 more apples in session", async () => {
    for (let i = 0; i < 5; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      i18n.t("ru", "cart", { first_name: "Russian", apples: 15 }),
    );
  });

  await t.step("checkout again", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, i18n.t("ru", "checkout"));
  });
});
