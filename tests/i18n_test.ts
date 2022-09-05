import { I18n } from "../src/mod.ts";
import { assertEquals, join } from "./deps.ts";
import { makeTempLocalesDir } from "./utils.ts";

const localesDir = makeTempLocalesDir();

const i18n = new I18n({
  defaultLocale: "en",
  directory: localesDir,
});

Deno.test("Load locales and check registered", () => {
  assertEquals(i18n.locales.sort(), ["en", "ru"]);
});

Deno.test("English", async (t) => {
  await t.step("hello", () => {
    assertEquals(i18n.t("en", "hello"), "Hello!");
  });
  await t.step("pluralize", () => {
    assertEquals(
      i18n.t("en", "cart", {
        name: "Name",
        apples: 0,
      }),
      "Hey name, there are no apples in your cart.",
    );
    assertEquals(
      i18n.t("en", "cart", {
        name: "Name",
        apples: 1,
      }),
      "Hey name, there is one apple in your cart.",
    );
    assertEquals(
      i18n.t("en", "cart", {
        name: "Name",
        apples: 5,
      }),
      "Hey name, there are 5 apples in your cart.",
    );
  });

  await t.step("checkout", () => {
    assertEquals(
      i18n.t("en", "checkout"),
      "Thank you for purchasing!",
    );
  });
});

Deno.test("Russian", async (t) => {
  await t.step("hello", () => {
    assertEquals(i18n.t("ru", "hello"), "Здравствуйте!");
  });

  await t.step("pluralize", () => {
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 0,
      }),
      "Привет Имя, в твоей корзине нет яблок.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 1,
      }),
      "Привет Имя, в твоей корзине 1 яблоко.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 3,
      }),
      "Привет Имя, в твоей корзине 3 яблока.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 7,
      }),
      "Привет Имя, в твоей корзине 7 яблок.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 11,
      }),
      "Привет Имя, в твоей корзине 11 яблок.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 101,
      }),
      "Привет Имя, в твоей корзине 101 яблоко.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 123,
      }),
      "Привет Имя, в твоей корзине 123 яблока.",
    );
  });

  await t.step("checkout", () => {
    assertEquals(
      i18n.t("ru", "checkout"),
      "Спасибо за покупку!",
    );
  });
});

Deno.test("Add locale", async (t) => {
  await t.step("From file", () => {
    i18n.loadLocaleSync("en2", {
      filePath: join(localesDir, "en.ftl"),
    });
    assertEquals(i18n.t("en2", "hello"), "Hello!");
  });

  await t.step("From source text", () => {
    i18n.loadLocaleSync("ml", {
      source: "hello = നമസ്കാരം",
    });
    assertEquals(i18n.t("ml", "hello"), "നമസ്കാരം");
  });
});
