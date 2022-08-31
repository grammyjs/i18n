import { join } from "./deps.ts";

export function makeTempLocalesDir() {
  const dir = Deno.makeTempDirSync();
  Deno.writeTextFileSync(
    join(dir, "en.ftl"),
    `hello = Hello!

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
  .language-set = Language set successfullY!`,
  );
  Deno.writeTextFileSync(
    join(dir, "ru.ftl"),
    `hello = Здравствуйте!

greeting = Здравствуйте, { $name }!

cart = Привет { $name }, в твоей корзине {
  $apples ->
    [0] нет яблок
    [one] 1 яблоко
    *[other] { $apples } яблоко
}.

checkout = Спасибо за покупку!

language =
  .hint = (ru) Enter a language with the command
  .invalid-locale = (ru) Invalid language
  .already-set = (ru) Language is already set!
  .language-set = (ru) Language set successfullY!`,
  );
  return dir;
}
