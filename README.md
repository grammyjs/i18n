# grammY i18n

Internationalization plugin for [grammY](https://grammy.dev) based on [Project Fluent](https://projectfluent.org).
Check out [the official documentation](https://grammy.dev/plugins/i18n.html) for this plugin.

## Installation

Node.js

```sh
npm install @grammyjs/i18n
```

Deno

```ts
import { I18n, I18nFlavor } from "https://deno.land/x/grammy_i18n/mod.ts";
```

## Example

Below is an example featuring both nested (`locales/en/...`) and standard (`locales/it.ftl`) file structure variants. Nested translations allow you to seperate your keys into different files (making it easier to maintain larger projects) while also letting you use the standard variant at the same time. Using a nested file structure alongside the standard variant won't break any existing translations.

```
.
├── locales/
│   ├── en/
│   │   ├── dialogues/
│   │   │   ├── greeting.ftl
│   │   │   └── goodbye.ftl
│   │   └── help.ftl
│   ├── it.ftl
│   └── ru.ftl
└── bot.ts
```

By splitting translations you don't change how you retrieve the keys contained within them, so for example, a key called `greeting` which is located in either `locales/en.ftl` or `locales/en/dialogues/greeting.ftl` can be retrieved by simply using `ctx.t("greeting")`.

Example bot
[not using sessions](https://grammy.dev/plugins/i18n.html#without-sessions):

```ts
import { Bot, Context } from "https://deno.land/x/grammy/mod.ts";
import { I18n, I18nFlavor } from "https://deno.land/x/grammy_i18n/mod.ts";

// For proper typings and auto-completions in IDEs,
// customize the `Context` using `I18nFlavor`.
type MyContext = Context & I18nFlavor;

// Create a new I18n instance.
const i18n = new I18n<MyContext>({
  defaultLocale: "en",
  directory: "locales",
});

// Create a bot as usual, but use the modified Context type.
const bot = new Bot<MyContext>(""); // <- Put your bot token here

// Remember to register this middleware before registering
// your handlers.
bot.use(i18n);

bot.command("start", async (ctx) => {
  // Use the method `t` or `translate` from the context and pass
  // in the message id (key) of the message you want to get.
  await ctx.reply(ctx.t("greeting"));
});

// Start your bot
bot.start();
```

See the [documentation](https://grammy.dev/plugins/i18n.html) and
[examples/](examples/) for more detailed examples.

## Credits

Thanks to...

- Slava Fomin II ([@slavafomin](https://github.com/slavafomin)) for the Node.js implementation of the [original Fluent plugin](https://github.com/the-moebius/grammy-fluent) and the [better Fluent integration](https://github.com/the-moebius/fluent).
- Roj ([@roj1512](https://github.com/roj1512)) for the [Deno port](https://github.com/roj1512/fluent) of the original [@fluent/bundle](https://github.com/projectfluent/fluent.js/tree/master/fluent-bundle) and [@fluent/langneg](https://github.com/projectfluent/fluent.js/tree/master/fluent-langneg) packages.
- Dunkan ([@dcdunkan](https://github.com/dcdunkan)) for the [Deno port](https://github.com/dcdunkan/deno_fluent) of the [@moebius/fluent](https://github.com/the-moebius/fluent).
- And all the previous maintainers and contributors of this i18n plugin.
