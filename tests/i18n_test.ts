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
    assertEquals(i18n.t("hello", "en"), "Hello!");
  });

  await t.step("checkout", () => {
    assertEquals(
      i18n.t("checkout", "en"),
      "Thank you for purchasing!",
    );
  });
});

Deno.test("Russian", async (t) => {
  await t.step("hello", () => {
    assertEquals(i18n.t("hello", "ru"), "Здравствуйте!");
  });

  await t.step("checkout", () => {
    assertEquals(
      i18n.t("checkout", "ru"),
      "Спасибо за покупку!",
    );
  });
});

Deno.test("Add locale", async (t) => {
  await t.step("From file", () => {
    i18n.loadLocale("en2", {
      filePath: join(localesDir, "en.ftl"),
    });
    assertEquals(i18n.t("hello", "en2"), "Hello!");
  });

  await t.step("From source text", () => {
    i18n.loadLocale("ml", {
      source: "hello = നമസ്കാരം",
    });
    assertEquals(i18n.t("hello", "ml"), "നമസ്കാരം");
  });
});

Deno.test("Get translations of hello", async (t) => {
  await t.step("all translations", () => {
    const translations = i18n.t("hello");
    const translations_ = i18n.t("hello", i18n.locales);
    assertEquals(translations, translations_);
    assertEquals(translations.sort(), [
      "Hello!", // en
      "Hello!", // en2
      "Здравствуйте!", // ru
      "നമസ്കാരം", // ml
    ]);
  });

  await t.step("en", () => {
    const en = i18n.t("hello", ["en", "ml", "ru"]);
    assertEquals(en, ["Hello!", "നമസ്കാരം", "Здравствуйте!"]);
  });

  await t.step("all translations", () => {
    const en = i18n.t("hello", ["en", "ml", "ru"]);
    assertEquals(en, ["Hello!", "നമസ്കാരം", "Здравствуйте!"]);
  });
});
