
# i18n for grammY

Internationalization middleware for [grammY](https://github.com/grammyjs/grammY).

## Installation

```js
$ npm install @grammyjs/i18n
```

## Documentation to be done



See full at https://replit.com/@MikeLeitner/TgGruppenBot

To use it you need to define BOT_TOKEN as Secrets or Environment Variable

## User context

grammY user context props and functions:

```js
bot.use((ctx) => {
  ctx.i18n.locale()                    // Get current locale
  ctx.i18n.locale(code)                // Set current locale
  ctx.i18n.t(resourceKey, [data])      // Get resource value (data will be used by template engine)
});
```

## Helpers
Aren't included yet
