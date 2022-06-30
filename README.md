# grammY i18n

Internationalization plugin for [grammY](https://grammy.dev) based on
[Project Fluent](https://projectfluent.org).

## Installation

#### Node.js

```sh
npm install @grammyjs/i18n
```

#### Deno

```ts
import { I18n, I18nContextFlavor } from "https://deno.land/x/.../mod.ts";
```

## Usage

The following examples are written for [Deno](https://deno.land).
You can still use the same code in Node.js by changing the imports accordingly.
Check out the [examples/](examples/) for full examples of both Deno and Node.

To quickly setup the translations, first of all, you need to put all of your translation files in a directory (or see [Adding Translations](#adding-translations)).
Usually, the name of that folder is going to be **locales/**.
And the translation files name should have the extension `.ftl` (fluent).

Here is an example project structure:

```
.
├─ 📂 locales
│  ├── en.ftl
│  ├── it.ftl
│  └── ru.ftl
└── bot.ts
```

> Have a look at the Fluent syntax guide if you need help with the `.ftl`
> (fluent) files: https://projectfluent.org/fluent/guide.

And in the `bot.ts` file:

> If you are using [TypeScript](https://typescriptlang.org) (recommended to use)
> make sure to use `I18nContextFlavor` to extend your bot context in order for
> typings to work correctly.

### Without sessions

When not using sessions, the locale is selected from the `language_code` of the
user. Or if the custom [locale negotiator function](#locale-negotiation) returns
a locale, then it will be used.

```ts
import { Bot, Context } from "https://deno.land/x/grammy/mod.ts";
import { I18n, I18nContextFlavor } from "https://deno.land/x/.../mod.ts";

// Create a new I18n instance.
const i18n = new I18n({
  defaultLocale: "en",
});

// Load locales from the `locales` directory.
await i18n.loadLocalesDir("locales");

// For proper typings and auto-completions in IDEs,
// extend the `Context` using `I18nContextFlavor`.
type MyContext = Context & I18nContextFlavor;

// Create a bot as usual, but use the modified Context type.
const bot = new Bot<MyContext>(""); // <- Put your bot token here

// Tell the bot to use the middleware from the instance.
// Remember to register this middleware before registering
// other middlewares.
bot.use(i18n.middleware());

bot.command("start", async (ctx) => {
  // Use the method `t` or `translate` from the context and pass
  // in the message id (key) of the message you want to get.
  await ctx.reply(ctx.t("greeting"));
});

// Start your bot
bot.start();
```

### Using sessions

If `useSession` is set to true, the plugin will try to read the
`__language_code` from user's session data and use it, before falling back to
language code received from the updates.

> **NOTE**: You have to register the `session` middleware before registering
> i18n's middleware. Otherwise, it won't be able to read or write from session.

```ts
import {
  Bot,
  Context,
  session,
  SessionFlavor,
} from "https://deno.land/x/grammy/mod.ts";
import { I18n, I18nContextFlavor } from "https://deno.land/x/.../mod.ts";

interface SessionData {
  __language_code?: string;
}

type MyContext =
  & Context
  & SessionFlavor<SessionData>
  & I18nContextFlavor;

const i18n = new I18n({
  defaultLocale: "en",
  useSession: true, // whether get/set in session
});

// Load locales from the `locales` directory.
await i18n.loadLocalesDir("locales");

const bot = new Bot<MyContext>(""); // <- Put your bot token here

// Remember to register `session` middleware before registering
// middleware of the i18n instance.
bot.use(session({
  initial: () => {
    return {};
  },
}));

bot.use(i18n.middleware());

bot.command("start", async (ctx) => {
  await ctx.reply(ctx.t("greeting"));
});

bot.command("language", async (ctx) => {
  if (ctx.match === "") {
    return await ctx.reply(ctx.t("language.hint"));
  }

  // `i18n.locales` contains all the locales that have been registered
  if (!i18n.locales.includes(ctx.match)) {
    return await ctx.reply(ctx.t("language.invalid-locale"));
  }

  // `ctx.i18n.getLocale` returns the locale currently using.
  if (await ctx.i18n.getLocale() === ctx.match) {
    return await ctx.reply(ctx.t("language.already-set"));
  }

  await ctx.i18n.setLocale(ctx.match);
  await ctx.reply(ctx.t("language.language-set"));
});

bot.start();
```

## Adding translations

There are several methods to add translations to the plugin.

### Load locales from a directory

This has to be the simplest way of adding translations. Just put them all in a
folder and load them like this:

```ts
await i18n.loadLocalesDir("locales");
```

### Load a single locale

From a file:

```ts
await i18n.loadLocale("en", {
  filePath: "path/to/en.ftl",
});
```

From source text:

```ts
await i18n.loadLocale("en", {
  source: `greeting = Hello { $first_name }!
language-set = Language has been set to English!`,
});
```

## Custom placeables and functions

This plugin injects some custom functions and placeables to your translations
and translation context.

### Placeables

#### first_name

Replacement for `ctx.from.first_name`. So, you don't need to pass it in the
context when you need it. You can just use it directly.

```fluent
greeting = Hi {$first_name}
```

### Functions

#### CTX

`CTX("key", "optionalDefaultValue")`

This function helps you to access any properties of the bot context directly
from your translations.

```fluent
id = Your user ID: {CTX("from.id")}
```

Optionally you can pass in a default value as the second argument. If the value
is undefined the default value is used instead.

### Locale negotiation

You can use the `localeNegotiator` option to define a custom locale negotiation
function that will be called for each Telegram update and must return a locale
ID to use for message translation.

By default, the locale is selected in the following order:

1. If custom `localeNegotiator` is set, calls it and uses the returned locale.
2. Gets locale from the session, if `useSession` is true.
3. Uses the user's language_code from the received updates.
4. Default locale from the configuration.
5. English (en).

Locale negotiation normally happens only once during Telegram update processing.
However, you can call `ctx.i18n.reNegotiateLocale()` to call the negotiator
again and determine the new locale. This is useful if the locale changes during
single update processing.

Here is an example locale negotiator:

```ts
async function myLocaleNegotiator(ctx: Context) {
  return ctx.session.locale ?? ctx.from?.language_code ?? "en";
}

const i18n = new I18n({
  localeNegotiator: myLocaleNegotiator,
});
```

## Credits

Thanks to...

- **Slava Fomin II** ([@slavafomin](https://github.com/slavafomin)) for the
  Node.js implementation of the
  [original Fluent plugin](https://github.com/the-moebius/grammy-fluent) and the
  [better Fluent integration](https://github.com/the-moebius/fluent).

- **Roj** ([@roj1512](https://github.com/roj1512)) for the
  [Deno port](https://github.com/roj1512/fluent) of the original
  [@fluent/bundle](https://github.com/projectfluent/fluent.js/tree/master/fluent-bundle)
  and
  [@fluent/langneg](https://github.com/projectfluent/fluent.js/tree/master/fluent-langneg)
  packages.

- **Dunkan** ([@dcdunkan](https://github.com/dcdunkan)) for the
  [Deno port](https://github.com/dcdunkan/deno_fluent) of the
  [@moebius/fluent](https://github.com/the-moebius/fluent).

- And all the previous maintainers and contributors of this i18n plugin.

## License

Licensed under MIT | Copyright © 2022 Dunkan

[See LICENSE](LICENSE)
