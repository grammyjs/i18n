import { join } from "./test_deps.ts";

export function makeTempLocalesDir() {
  const dir = Deno.makeTempDirSync();
  Deno.writeTextFileSync(
    join(dir, "en.ftl"),
    `hello = Hello!

greeting = Hello { $first_name }!

cart = { $first_name }, there {
  $apples ->
    [0] are no apples
    [one] is one apple
    *[other] are { $apples } apples
} in your cart.

checkout = Thank you for purchasing!`,
  );
  Deno.writeTextFileSync(
    join(dir, "ru.ftl"),
    `hello = (In Russian) Hello!

greeting = Привет { $first_name }!

cart = В вашей корзине {
  $apples ->
    [one] 1 яблоко
    *[other] { $apples } яблок
  }

checkout = (In Russian) Thank you for purchasing!`,
  );
  return dir;
}
