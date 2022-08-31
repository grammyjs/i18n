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
