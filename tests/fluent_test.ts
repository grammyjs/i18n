import { Fluent } from "../src/fluent.ts";
import { assert, assertEquals, assertStringIncludes } from "./deps.ts";
import { evalCode } from "./platform.deno.ts";

Deno.test("source for translations", async (t) => {
  await t.step(
    "should throw if both filepath and source are given",
    async () => {
      const { success, stderr } = await evalCode(`
    const fluent = new Fluent();
    fluent.addTranslationSync({ locales: "locale", filePath: "f", source: "s" });`);
      assert(success === false);
      assertStringIncludes(
        stderr,
        "Provide either filePath or string source as translation source.",
      );
    },
  );

  await t.step(
    "should throw if both filepath and source aren't given",
    async () => {
      const { success, stderr } = await evalCode(`
    const fluent = new Fluent();
    fluent.addTranslationSync({ locales: "locale" });`);
      assert(success === false);
      assertStringIncludes(
        stderr,
        "Provide either filePath or string source as translation source.",
      );
    },
  );

  await t.step("string source (async)", async () => {
    const fluent = new Fluent();
    await fluent.addTranslation({ locales: "locale", source: "msg = hi" });
    assertEquals(fluent.translate("locale", "msg"), "hi");
  });

  await t.step("string source (sync)", () => {
    const fluent = new Fluent();
    fluent.addTranslationSync({ locales: "locale", source: "msg = hi" });
    assertEquals(fluent.translate("locale", "msg"), "hi");
  });

  const file = await Deno.makeTempFile();
  await Deno.writeTextFile(file, "msg = hi");

  await t.step("filepath source (async)", async () => {
    const fluent = new Fluent();
    await fluent.addTranslation({ locales: "locale", filePath: file });
    assertEquals(fluent.translate("locale", "msg"), "hi");
  });

  await t.step("filepath source (sync)", () => {
    const fluent = new Fluent();
    fluent.addTranslationSync({ locales: "locale", filePath: file });
    assertEquals(fluent.translate("locale", "msg"), "hi");
  });

  await Deno.remove(file);
});

Deno.test("translate", async (t) => {
  await t.step("translate", async () => {
    const fluent = new Fluent();
    await fluent.addTranslation({ locales: "locale", source: "key = message" });
    assertEquals(fluent.translate("locale", "key"), "message");
  });

  await t.step("falls back to default translation", async () => {
    const fluent = new Fluent();
    await fluent.addTranslation({
      locales: "default",
      source: "msg = hi",
      isDefault: true,
    });
    await fluent.addTranslation({
      locales: "notDefault",
      source: "message = kek",
    });
    assertEquals(
      fluent.translate("notDefault", "msg"),
      fluent.translate("default", "msg"),
    );
  });
});

const warningScenes: Record<
  string,
  { code: (warningHandler: string) => string; expected: string }
> = {
  "missing translation": {
    code: (wh) => `
    new Fluent({ warningHandler: ${wh} }).translate("locale", "path");`,
    expected: 'The translation "path" is missing in the locales: locale',
  },
  "missing message": {
    code: (wh) => `
    const fluent = new Fluent({ warningHandler: ${wh} });
    fluent.addTranslationSync({
      locales: "locale",
      source: "message",
    });
    fluent.translate("locale", "key");`,
    expected:
      `Translation message "key" is missing in the following locale(s): locale.
The translation "key" is missing in the locales: locale`,
  },
  "missing attribute": {
    code: (wh) => `
    const fluent = new Fluent({ warningHandler: ${wh} });
    fluent.addTranslationSync({
      locales: "locale",
      source: "key=string",
    });
    fluent.translate("locale", "key.attr");`,
    expected:
      `"attr" attribute is missing in message "key" for locale(s): locale
The translation "key.attr" is missing in the locales: locale`,
  },
};

Deno.test("warnings", async (t) => {
  await t.step("default warning handler", async (t) => {
    for (const scene in warningScenes) {
      await t.step(scene, async () => {
        const { code, expected } = warningScenes[scene];
        const { success, stderr } = await evalCode(
          code("defaultWarningHandler()"),
        );
        assert(success);
        assertEquals(stderr, expected);
      });
    }
  });
  await t.step(
    "default warning handler but logFn is console.log",
    async (t) => {
      for (const scene in warningScenes) {
        await t.step(scene, async () => {
          const { code, expected } = warningScenes[scene];
          const { success, stdout } = await evalCode(
            code("defaultWarningHandler(console.log)"),
          );
          assert(success);
          assertEquals(stdout, expected);
        });
      }
    },
  );
  await t.step(
    "default warning handler but logFn does nothing",
    async (t) => {
      for (const scene in warningScenes) {
        await t.step(scene, async () => {
          const { code } = warningScenes[scene];
          const { success, stdout } = await evalCode(
            code("defaultWarningHandler(function () {})"),
          );
          assert(success);
          assertEquals(stdout, "");
        });
      }
    },
  );
  await t.step(
    "custom warning handler",
    async (t) => {
      for (const scene in warningScenes) {
        await t.step(scene, async () => {
          const { code, expected } = warningScenes[scene];
          const { success, stdout } = await evalCode(
            code("function () {console.log('kek')}"),
          );
          assert(success);
          assertEquals(
            stdout.split("\n").length,
            expected.split("\n").length,
          );
        });
      }
    },
  );
});

Deno.test("multiple bundles", async () => {
  const fluent = new Fluent({
    warningHandler: () => {}
  });

  await fluent.addTranslation({ locales: "en", source: "hi = hello" });
  await fluent.addTranslation({ locales: "en", source: "planet = world\nhi = error" });
  await fluent.addTranslation({ locales: "en", source: "less = more" });

  await fluent.addTranslation({ locales: "it", source: "hi = ciao" });
  await fluent.addTranslation({ locales: "it", source: "planet = mondo\nhi = errore" });
  await fluent.addTranslation({ locales: "it", source: "less = più" });

  assertEquals(fluent.translate("en", "hi"), "hello");
  assertEquals(fluent.translate("en", "planet"), "world");
  assertEquals(fluent.translate("en", "less"), "more");

  assertEquals(fluent.translate("it", "hi"), "ciao");
  assertEquals(fluent.translate("it", "planet"), "mondo");
  assertEquals(fluent.translate("it", "less"), "più");
})
