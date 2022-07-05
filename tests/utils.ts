import { join } from "./deps.ts";

export function makeTempLocalesDir() {
  const dir = Deno.makeTempDirSync();
  Deno.writeTextFileSync(
    join(dir, "en.ftl"),
    `hello = Hello!

greeting = Hello, { $first_name }!

cart = Hey { $first_name }, there {
  $apples ->
    [0] are no apples
    [one] is one apple
    *[other] are { $apples } apples
} in your cart.

checkout = Thank you for purchasing!`,
  );
  Deno.writeTextFileSync(
    join(dir, "ru.ftl"),
    `hello = Здравствуйте!

greeting = Здравствуйте, { $first_name }!

cart = Привет { $first_name }, в твоей корзине {
  $apples ->
    [0] нет яблок
    [one] 1 яблоко
    *[other] { $apples } яблоко
}.

checkout = Спасибо за покупку!`,
  );
  return dir;
}
