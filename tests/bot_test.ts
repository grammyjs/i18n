import { bot, i18n } from "./bot.ts";
import { assertEquals, assertNotEquals, Chats } from "./deps.ts";

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

  await t.step("Hears `Hello!` but not `Здравствуйте!`", async () => {
    await user.sendMessage("Hello!");
    assertEquals(user.last.text, "Hello!");

    await user.sendMessage("Здравствуйте!");
    assertNotEquals(user.last.text, "Здравствуйте!");
  });

  await t.step("start command", async () => {
    await user.command("start");
    assertEquals(user.last.text, "Hello, English!");
  });

  await t.step("empty cart", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      "Hey English, there are no apples in your cart.",
    );
  });

  await t.step("add one apple in session", async () => {
    await user.command("add");
    assertEquals(
      user.last.text,
      "Hey English, there is one apple in your cart.",
    );
  });

  await t.step("checkout command", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, "Thank you for purchasing!");
  });

  await t.step("check if cart is empty after checkout", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      "Hey English, there are no apples in your cart.",
    );
  });

  await t.step("add 10 apples in session", async () => {
    for (let i = 0; i < 10; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      "Hey English, there are 10 apples in your cart.",
    );
  });

  await t.step("there are 10 apples in session", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      "Hey English, there are 10 apples in your cart.",
    );
  });

  await t.step("add 5 more apples in session", async () => {
    for (let i = 0; i < 5; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      "Hey English, there are 15 apples in your cart.",
    );
  });

  await t.step("checkout again", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, "Thank you for purchasing!");
  });
});

Deno.test("Russian user", async (t) => {
  const user = chats.newUser({
    id: 182119199114, // R U S S I A N
    first_name: "Russian",
    last_name: "User",
    language_code: "ru",
  });

  await t.step("Hears `Здравствуйте!` but not `Hello!`", async () => {
    await user.sendMessage("Здравствуйте!");
    assertEquals(user.last.text, "Здравствуйте!");

    await user.sendMessage("Hello!");
    assertNotEquals(user.last.text, "Hello!");
  });

  await t.step("start command", async () => {
    await user.command("start");
    assertEquals(user.last.text, "Здравствуйте, Russian!");
  });

  await t.step("empty cart", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      "Привет Russian, в твоей корзине нет яблок.",
    );
  });

  await t.step("checkout command", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, "Спасибо за покупку!");
  });

  await t.step("check if cart is empty after checkout", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      "Привет Russian, в твоей корзине нет яблок.",
    );
  });

  await t.step("add 10 apples in session", async () => {
    for (let i = 0; i < 10; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      "Привет Russian, в твоей корзине 10 яблоко.",
    );
  });

  await t.step("there are 10 apples in session", async () => {
    await user.command("cart");
    assertEquals(
      user.last.text,
      "Привет Russian, в твоей корзине 10 яблоко.",
    );
  });

  await t.step("add 5 more apples in session", async () => {
    for (let i = 0; i < 5; i++) {
      await user.command("add");
    }
    assertEquals(
      user.last.text,
      "Привет Russian, в твоей корзине 15 яблоко.",
    );
  });

  await t.step("checkout again", async () => {
    await user.command("checkout");
    assertEquals(user.last.text, "Спасибо за покупку!");
  });
});
