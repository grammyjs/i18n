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
      "Hey \u2068Name\u2069, there \u2068are no apples\u2069 in your cart.",
    );
    assertEquals(
      i18n.t("en", "cart", {
        name: "Name",
        apples: 1,
      }),
      "Hey \u2068Name\u2069, there \u2068is one apple\u2069 in your cart.",
    );
    assertEquals(
      i18n.t("en", "cart", {
        name: "Name",
        apples: 5,
      }),
      "Hey \u2068Name\u2069, there \u2068are \u20685\u2069 apples\u2069 in your cart.",
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
      "Привет \u2068Имя\u2069, в твоей корзине \u2068нет яблок\u2069.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 1,
      }),
      "Привет \u2068Имя\u2069, в твоей корзине \u2068\u20681\u2069 яблоко\u2069.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 3,
      }),
      "Привет \u2068Имя\u2069, в твоей корзине \u2068\u20683\u2069 яблока\u2069.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 7,
      }),
      "Привет \u2068Имя\u2069, в твоей корзине \u2068\u20687\u2069 яблок\u2069.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 11,
      }),
      "Привет \u2068Имя\u2069, в твоей корзине \u2068\u206811\u2069 яблок\u2069.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 101,
      }),
      "Привет \u2068Имя\u2069, в твоей корзине \u2068\u2068101\u2069 яблоко\u2069.",
    );
    assertEquals(
      i18n.t("ru", "cart", {
        name: "Имя",
        apples: 123,
      }),
      "Привет \u2068Имя\u2069, в твоей корзине \u2068\u2068123\u2069 яблока\u2069.",
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
