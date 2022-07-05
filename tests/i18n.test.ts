import { I18n } from "../src/mod.ts";
import { assertEquals } from "./test_deps.ts";

const i18n = new I18n({
  defaultLocale: "en",
});

Deno.test("Load locales and check registered", async () => {
  await i18n.loadLocalesDir("tests/test_locales");
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
    assertEquals(i18n.t("ru", "hello"), "(In Russian) Hello!");
  });

  await t.step("checkout", () => {
    assertEquals(
      i18n.t("ru", "checkout"),
      "(In Russian) Thank you for purchasing!",
    );
  });
});

Deno.test("Add locale", async (t) => {
  await t.step("From file", async () => {
    await i18n.loadLocale("en2", {
      filePath: "tests/test_locales/en.ftl",
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
