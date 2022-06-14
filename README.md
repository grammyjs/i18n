# i18n 2.0

Internationalization plugin for [grammY](grammy-website) based on
[Fluent][fluent-website] localization system.

## Why Fluent?

I've studied several i18n standards and message formats and have found that
Fluent has all the required features and at the same time provides a very
user-friendly message format, which is very important for non-dev people (i.e.
translators).

It is also supported by **Mozilla Foundation**, a well-respected leader in world
of OpenSource and the Web standards.

### Fluent features

- Variable substitution (aka placeables),
- Built-in and custom formatters that could be applied to the values of the
  rendered variables,
- Conditional substitution (selection) based on variable value,
- Powerful pluralization with built-in rules for every locale.

## Library features

- **Built on top** of [@moebius/fluent][moebius-fluent] library, that on itself
  simplifies Fluent integration,
- **Adds helper functions** to grammY bots context to simplify message
  translation,
- Automatically uses translation locale based on the language selected by the
  user in their Telegram settings,
- Uses an **automatic language negotiation**, so the best possible language will
  be automatically picked for each user,
- Gives you **full access to `Fluent` instance**, so you can
  [configure it][moebius-fluent] yourself as you see fit.

> It is highly advisable to read [@moebius/fluent][moebius-fluent] as well as
> [fluent.js][fluent-js] libraries documentation before using this library.

## Installation

### Node.js

```shell
npm install --save @grammyjs/fluent @moebius/fluent
```

### Deno

```ts
import { Fluent } from "https://deno.land/x/better_fluent/mod.ts";
import {
  FluentContextFlavor,
  useFluent,
} from "https://deno.land/x/grammy_fluent/mod.ts";
```

### Message format example

Consider the following message format example and see for yourself:

```fluent
-project-name = Super Project

welcome = Welcome, {$name}, to the {-project-name}!
  .balance =
    Your balance is: {
      NUMBER($value, maximumFractionDigits: 2)
    }
  .apples-count =
    You have { NUMBER($applesCount) ->
      [0] no apples
      [one] {$applesCount} apple
      *[other] {$applesCount} apples
    }
```

## Usage

Examples are written for [Deno](https://deno.land). By changing the imports
accordingly they'll become compatible for Node.js also. Checkout the [examples](examples/) folder for more.

```ts
import { Bot, Context } from "https://deno.land/x/grammy/mod.ts";
import { Fluent } from "https://deno.land/x/better_fluent/mod.ts";
import {
  FluentContextFlavor,
  useFluent,
} from "https://deno.land/x/grammy_fluent/mod.ts";

// Extend your application context type with the provided flavor interface
type MyContext = Context & FluentContextFlavor;

// Create grammY bot as usual, but specify the extended context
const bot = new Bot<MyContext>();

// Create an instance of Fluent and configure it
const fluent = new Fluent();

// Add translations that you need
await fluent.addTranslation({
  locales: "en",
  source: `
-brand-name = Super Project

welcome =
  Welcome, {$name}, to the {-brand-name}!
  Your balance is: {
    NUMBER($value, maximumFractionDigits: 2)
  }
  You have { NUMBER($applesCount) ->
    [0] no apples
    [one] {$applesCount} apple
    *[other] {$applesCount} apples
  }
  `,
  // All the aspects of Fluent are highly configurable
  bundleOptions: {
    // Use this option to avoid invisible characters around placeables
    useIsolating: false,
  },
});

// You can also load translations from files
await fluent.addTranslation({
  locales: "ru",
  filePath: [
    `${Deno.cwd()}/feature-1/translation.ru.ftl`,
    `${Deno.cwd()}/feature-2/translation.ru.ftl`,
  ],
});

// Tell the bot to use Fluent.
bot.use(useFluent({ fluent }));

bot.command("start", async (ctx) => {
  // Call the "translate" or "t" helper to render the message by specifying
  // it's ID and additional parameters:
  await ctx.reply(ctx.t("welcome", {
    name: context.from.first_name,
    value: 123.456,
    applesCount: 1,
  }));
});

// Run the bot
bot.start();
```

## API

### useFluent

```ts
function useFluent(options: GrammyFluentOptions): Middleware;
```

Call this function to add Fluent middleware to your bot, e.g:

```ts
bot.use(useFluent({ fluent }));
```

The following options are supported:

| Name             | Type             | Description                                                                                                                               |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| fluent *         | Fluent           | A pre-configured instance of [Fluent][moebius-fluent] to use.                                                                             |
| defaultLocale    | LocaleId         | A locale ID to use by default. This is used when locale negotiator returns an empty result. The default value is: "_en_".                 |
| localeNegotiator | LocaleNegotiator | An optional function that determines a locale to use. Check the [locale negotiation](#locale-negotiation) section below for more details. |

> Please, see [@moebius/fluent documentation][moebius-fluent] for all the Fluent
> configuration instructions.

### Context helpers

The following helpers are added to the bots' context by the middleware:

| Name                       | Type                                                                | Description                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fluent                     | Object                                                              | Fluent context namespace object, see the individual properties below.                                                                                                                                                                                                 |
| fluent.instance            | Fluent                                                              | An instance of [Fluent][moebius-fluent].                                                                                                                                                                                                                              |
| fluent.renegotiateLocale() | () => Promise<void>                                                 | You can manually trigger additional locale negotiation by calling this method. This could be useful if locale negotiation conditions has changed and new locale must be applied (e.g. user has changed the language and you need to display an answer in new locale). |
| fluent.useLocale()         | (localeId: string) => void                                          | Sets the specified locale to be used for future translations. Effect lasts only for the duration of current update and is not preserved. Could be used to change the translation locale in the middle of update processing (e.g. when user changes the language).     |
| translate \| t             | (**messageId**: string, **context?**: TranslationContext) => string | Translation function bound to the current locale. Shorthand alias "t" is also available.                                                                                                                                                                              |

Make sure to use `FluentContextFlavor` to extend your application context in
order for typings to work correctly:

```ts
import { Context } from "https://deno.land/x/grammy/mod.ts";
import { FluentContextFlavor } from "https://deno.land/x/grammy_fluent/mod.ts";

export type MyContext = Context & FluentContextFlavor;

const bot = new Bot<MyContext>();
```

### Locale negotiation

You can use a `localeNegotiator` property to define a custom locale negotiation
function that will be called for each Telegram update and must return a locale
ID to use for message translation.

The default negotiator will detect locale based on users Telegram language
setting.

> Locale negotiation normally happens only once during Telegram update
> processing. However, you can call `await ctx.fluent.renegotiateLocale()`
> to call the negotiator again and determine the new locale. This is useful if
> the locale changes during single update processing.

#### API

```ts
type LocaleNegotiator<ContextType> = (
  (ctx: ContextType) => (LocaleId | PromiseLike<LocaleId>)
);
```

#### Example

The example below will try to use locale ID stored in users session:

```ts
async function myLocaleNegotiator(ctx: Context) {
  return (
    (await ctx.session).languageId ||
    ctx.from.language_code ||
    "en"
  );
}

bot.use(useFluent({
  fluent,
  defaultLocale: "en", // this is the default
  // Telling middleware to use our custom negotiator
  localeNegotiator: myLocaleNegotiator,
}));
```

It will use the locale that is already stored in the user session by the old i18n
plugin.

## Credits

- Thanks to @slavafomin for his original Node.js implementation.

[grammy-website]: https://grammy.dev/
[fluent-website]: https://projectfluent.org/
[fluent-js]: https://github.com/projectfluent/fluent.js/
[moebius-fluent]: https://github.com/the-moebius/fluent
[i18n-plugin]: https://github.com/grammyjs/i18n
