import { bot } from "./session_bot.ts";
import { assertEquals, Chats } from "./deps.ts";

const chats = new Chats(bot);

const user = chats.newUser({
  first_name: "Test",
  id: 1234567890,
  language_code: "en",
});

Deno.test("/start", async () => {
  await user.command("start");
  assertEquals(user.last.text, "Hello, Test!");
});

Deno.test("/language", async (t) => {
  await t.step("no match", async () => {
    await user.command("language");
    assertEquals(user.last.text, "Enter a language with the command");
  });

  await t.step("invalid language", async () => {
    await user.command("language", "blah");
    assertEquals(user.last.text, "Invalid language");
  });

  await t.step("already set", async () => {
    await user.command("language", "en");
    assertEquals(user.last.text, "Language is already set!");
  });

  await t.step("set 'ru'", async () => {
    await user.command("language", "ru");
    assertEquals(user.last.text, "Язык успешно установлен!");
  });

  await t.step("'ru': already set", async () => {
    await user.command("language", "ru");
    assertEquals(user.last.text, "Этот язык уже установлен!");
  });

  await t.step("back to 'en'", async () => {
    await user.command("language", "en");
    assertEquals(user.last.text, "Language set successfullY!");
  });
});
