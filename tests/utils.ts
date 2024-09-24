import { join } from "./deps.ts";

export function makeTempLocalesDir() {
  const dir = Deno.makeTempDirSync();

  const englishTranslation = `hello = Hello!

greeting = Hello, { $name }!

cart = Hey { $name }, there {
  $apples ->
    [0] are no apples
    [one] is one apple
    *[other] are { $apples } apples
} in your cart.

checkout = Thank you for purchasing!

language =
  .hint = Enter a language with the command
  .invalid-locale = Invalid language
  .already-set = Language is already set!
  .language-set = Language set successfullY!`;

  const russianTranslation = `hello = Здравствуйте!

greeting = Здравствуйте, { $name }!

cart = Привет { $name }, в твоей корзине {
  $apples ->
    [0] нет яблок
    [one] {$apples} яблоко
    [few] {$apples} яблока
    *[other] {$apples} яблок
}.

checkout = Спасибо за покупку!

language =
  .hint = Отправьте язык после команды
  .invalid-locale = Неверный язык
  .already-set = Этот язык уже установлен!
  .language-set = Язык успешно установлен!`;

  function writeNestedFiles() {
    const nestedPath = join(dir, "/ru/test/nested/");
    const keys = russianTranslation.split(/\n\s*\n/);

    Deno.mkdirSync(nestedPath, { recursive: true });

    for (const key of keys) {
      const fileName = key.split(" ")[0] + ".ftl";
      const filePath = join(nestedPath, fileName);

      Deno.writeTextFileSync(filePath, key);
    }
  }

  // Using normal, singular translation files.
  Deno.writeTextFileSync(join(dir, "en.ftl"), englishTranslation);
  // Using split translation files.
  writeNestedFiles();

  return dir;
}
