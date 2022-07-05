import { I18n } from "../src/mod.ts";
import { assertEquals, join } from "./deps.ts";
import { makeTempLocalesDir } from "./utils.ts";

const i18n = new I18n({
  defaultLocale: "en",
});

const localesDir = makeTempLocalesDir();

Deno.test("Load locales and check registered", async () => {
  await i18n.loadLocalesDir(localesDir);
  assertEquals(i18n.locales.sort(), ["en", "ru"]);
});

Deno.test("English", async (t) => {
  await t.step("hello", () => {
    assertEquals(i18n.t("en", "hello"), "Hello!");
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

  await t.step("checkout", () => {
    assertEquals(
      i18n.t("ru", "checkout"),
      "Спасибо за покупку!",
    );
  });
});

Deno.test("Add locale", async (t) => {
  await t.step("From file", async () => {
    await i18n.loadLocale("en2", {
      filePath: join(localesDir, "en.ftl"),
    });
    assertEquals(i18n.t("en2", "hello"), "Hello!");
  });

  await t.step("From source text", async () => {
    await i18n.loadLocale("ml", {
      source: "hello = Namaskaaram",
    });
    assertEquals(i18n.t("ml", "hello"), "Namaskaaram");
  });
});

Deno.test("Get all translations of hello", () => {
  const translations = i18n.t("hello");
  assertEquals(translations.sort(), [
    "Hello!", // en
    "Hello!", // en2
    "Namaskaaram", // ml
    "Здравствуйте!", // ru
  ]);
});
