# i18n

Internationalization plugin for [grammY](https://grammy.dev) based on
[Project Fluent](https://projectfluent.org).

## Installation

#### Node.js

```sh
npm install @grammyjs/i18n
```

#### Deno

If you are using [Deno](https://deno.land), you can import the plugin from the
Deno third-party module registry:

```ts
import { I18n, I18nContextFlavor } from "https://deno.land/x/.../mod.ts";
```

## Usage

The following examples are written for [Deno](https://deno.land). You can still
use the same code in Node.js by changing the imports accordingly. Checkout the
[examples folder](examples/) for full examples of both Deno and Node.

To setup the translations quickly, first of all, you need to put all of your
translation files in a folder (Or, see
[Adding Translations](#adding-translations)). Usually, we name the folder
**locales**. And the translation files' name should end with `.ftl` (fluent)
extension. Here is an example project structure:

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
  directory: "locales", // directory path
  defaultLocale: "en",
});

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
  __language_code: string;
}

type MyContext =
  & Context
  & SessionFlavor<SessionData>
  & I18nContextFlavor;

const i18n = new I18n({
  directory: "locales", // directory path
  defaultLocale: "en",
  useSession: true, // whether get/set in session
});

const bot = new Bot<MyContext>(""); // <- Put your bot token here

// Remember to register `session` middleware before registering
// middleware of the i18n instance.
bot.use(session({
  initial: () => {
    return { __language_code: "en" };
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

### Specify directory in configuration

You can specify a directory in the i18n configuration like in the examples
above. This might be the easiest way to add translations to the instance.

```ts
const i18n = new I18n({
  directory: "locales",
});
```

### Load locales from a directory

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

## API Documentation

### I18n Configuration

| Option              | Type                | Description                                                                                                                                        |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| directory           | string              | Path to the directory where locales are stored                                                                                                     |
| defaultLocale       | LocaleId            | A locale ID to use by default. This is used when locale negotiator and session (if enabled) returns an empty result. The default value is: "_en_". |
| useSession          | boolean             | Whether to use session to get and set language code. You should be using session with it though.                                                   |
| fluentOptions       | FluentOptions       | Configuration for the Fluent instance used internally.                                                                                             |
| fluentBundleOptions | FluentBundleOptions | Bundling options to use when adding a translation to the Fluent instance.                                                                          |
| localeNegotiator    | LocaleNegotiator    | An optional function that determines which locale to use. Check the [locale negotiation](#locale-negotiation) section below for more details.      |

> Find more about configuring the Fluent instance in the
> [@moebius/fluent documentation](https://github.com/the-moebius/fluent).

### I18n Instance

| Name               | Type                                                                                                                                                              | Description                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| loadLocale()       | (**locale: LocaleId**, options: { **filePath?: string;** **source?: string;** isDefault?: boolean; bundleOptions?: FluentBundleOptions; }) => Promise&lt;void&gt; | Registers a locale in the Fluent instance based on the provided options.           |
| loadLocalesDir()   | (directory: string) => Promise&lt;void&gt;                                                                                                                        | Loads locales from the specified folder and registers them in the Fluent instance. |
| translate() \| t() | (locale: LocaleId, messageId: string, context?: TranslationContext) => string                                                                                     | Returns the message from the provided locale.                                      |
| middleware()       | () => Middleware&lt;C extends Context = Context&gt;                                                                                                               | Returns a middleware to use in your bot.                                           |

### Context helpers

The following helpers are added to the bot's context by the middleware.

| Name                     | Type                                                        | Description                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| i18n                     | I18n                                                        | I18n context namespace object, see the individual properties below.                                                                                                                                                                                                       |
| translate() \| t()       | (messageId: string, context?: TranslationContext) => string | Translation function bound to the current locale. Shorthand alias "t" is also available.                                                                                                                                                                                  |
| i18n.fluentInstance      | Fluent                                                      | Fluent instance that is used internally.                                                                                                                                                                                                                                  |
| i18n.getLocale()         | () => Promise&lt;string&gt;                                 | Returns the negotiated locale.                                                                                                                                                                                                                                            |
| i18n.setLocale()         | (locale: LocaleId) => Promise&lt;void&gt;                   | Equivalent for manually setting the locale in session and calling reNegotiateLocale(). If the `useSession` in the i18n configuration is set to true, sets the locale in session. Otherwise throws an error. You can suppress the error by using i18n.useLocale() instead. |
| i18n.useLocale()         | (locale: LocaleId) => void                                  | Sets the specified locale to be used for future translations. Effect lasts only for the duration of current update and is not preserved. Could be used to change the translation locale in the middle of update processing (e.g. when user changes the language).         |
| i18n.reNegotiateLocale() | () => Promise&lt;void&gt;                                   | You can manually trigger additional locale negotiation by calling this method. This could be useful if locale negotiation conditions has changed and new locale must be applied (e.g. user has changed the language and you need to display an answer in new locale).     |

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

- And all the previous maintainers and contributors of this i18n plugin.

## License

Licensed under MIT | Copyright © 2022 Dunkan

[See LICENSE](LICENSE)
