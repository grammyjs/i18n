# grammY i18n

Official internationalization [plugin](https://grammy.dev/plugins) for [grammY](https://grammy.dev).
This plugin helps you to make your bot speak in & handle multiple languages.
It comes with TypeScript types support for messages, namespaces, CLI features, different translation formats, etc.
Check out the documentation for this plugin [here](https://grammy.dev/plugins/i18n).

You can install the plugin using the commands below:

```bash
npm install @grammyjs/i18n # Node.js (npm)
deno add jsr:@grammyjs/i18n # Deno
```

...and import the `I18n` class from `@grammyjs/i18n` to get started.
You must use this plugin with a format adapter of your choice.
Each format adapter is for different source file formats used to write translation data.

We currently have only one official format adapter: Fluent.
Which is, Mozilla's [Project Fluent](https://projectfluent.org) format.
This has been the official & only supported format in version 1.
But currently it is possible to use any format, using their format adapters.

The following example shows the usage of Fluent adapter (see [example/](./example) for a detailed one):

```ts
import { FluentAdapter } from "@grammyjs/i18n/adapter-fluent";

const fluentAdapter = new FluentAdapter();
const i18n = new I18n({
    adapter: fluentAdapter,
    fallbackLocale: "en",
    // optional:
    localeNegotiator: (ctx) => ctx.from?.language_code,
    onMissingKey: (event) => {
        console.error("Missing key:", event);
        if (event.fallback) return "Please report the issue.";
    },
});

bot.use(i18n);
```

Later, you can use the `ctx.t` method to retrieve translations for the locale resolved for the update.

```ts
bot.command("start", async (ctx) => {
    await ctx.send(ctx.t("greeting")); // Hello user!
});
```

By default, locale for a user is chosen as the value of `ctx.from.language_code`, the client language-code that Telegram sends to the bot (This may not be available for all updates).
And you can negotiate the locale as you wish.
Here's an example of how to do it when using sessions:

```ts
const i18n = new I18n({
    fallbackLocale: "en",
    localeNegotiator: (ctx) =>
        ctx.session.settings.languageCode ?? ctx.from.language_code, // or simply just the session one is enough, AS-YOU-WISH.
});
```

If `localeNegotiator` returns undefined, then the `fallbackLocale` is used instead.
So, it's important that the language you set as the `fallbackLocale` be a complete locale which you can ultimately depend on.

If the message key could not be found in the negotiated locale, then, the `onMissingKey` handler is called with enough information about the event.
You can throw errors to handle it in your bot's error handler.
Or return a string to be shown as the message, like a service message.
If it returns undefined even for the fallback locale, then, an error is thrown, because it's a bug!

### Locales Directory

Adapters ideally will have a way to load translation sources of the supported formats.
The standardized way is to implement the `FormatAdapter::loadResource` method.
When using format adapters which has the method, you can use the `loadLocalesDirectory` utility function provided by this plugin to easily load your translation resources from a standardized directory.

```ts
await loadLocalesDirectory(adapter, "./locales", {
    extensions: [".ftl"],
    // optional:
    resourceOptions: {/* Adapter specific options */},
    ignoreDotFiles: true,
    followSymlinks: true,
    resolveNamespace: createNamespaceResolver(/* explained later on */),
    sharedDirectoryLoading: "after-locales";
    sharedDirectoryName: "shared";
});
```

The locales directory is expected to have the following structure:

```asciiart
locales/
├── en/
│   ├── deeply/
│   │   └── nested/
│   │       └── foo.ftl
│   ├── bar.ftl
│   └── main.ftl
├── ru/ (ideally, it should be equal to 'en')
│   ├── foo.ftl
│   └── main.ftl
└── shared/ (optional)
    └── main.ftl
```

Every entry inside the locales directory must be a directory named same as the locale it represents.
Every other entry is ignored in root level.
Each locale can have any number of files nested or not.

Locales directory can also optionally have a shared directory, which should contain files & messages that should be added to every locale.
Shared directory name can be using `sharedDirectoryName` property, and can opt-out by setting `sharedDirectoryLoading` to `disabled`.

#### Locales Directory = too much?

If you have a very simple bot, and you don't want any of the additional features, you can always keep it very simple & stupid.
Let's say this is your locales directory:

```asciiart
locales/
├── en.ftl
├── de.ftl
└── ru.ftl
```

Here's a simple 6-line piece of code, to load all the top-level files in your directory to the format adapter:

```ts
const dirpath = "./locales";
for await (const dirent of Deno.readDir(dirpath)) {
    if (!dirent.isFile) continue;
    const content = await Deno.readTextFile(join(dirpath, dirent.name));
    const locale = basename(dirent.name, extname(dirent.name));
    adapter.loadResource(locale, content /* optional: namespace, options */);
}
```

### Namespaces

Every file inside a locale is considered to be under the same namespace, (meaning, each file is treated the same) unless a namespace resolver is defined.
A namespace resolver function should take in a path relative to the locale directory (e.g.: `main.ftl`, `deeply/nested/foo.ftl`) and the locale it belongs to (undefined if shared directory), and return which namespace it should belong to.
You can define your own namespace resolvers, but i18n provides a simple utility that covers common cases.

```ts
await loadLocalesDirectory(fluentAdapter, "./locales", {
    // directory strategy:
    resolveNamespace: createNamespaceResolver({
        strategy: "directory",
        // optional:
        separator: "/",
    }),
    // file strategy:
    resolveNamespace: createNamespaceResolver({
        strategy: "file",
        // optional:
        separator: "/",
        indexFile: "index",
        resolveExtension: (path) => extname(path),
    }),
    // ...other options...
});
```

- `directory` strategy: Merges files inside a directory into a single namespace with the directory path as the name.
- `file` strategy: Each file on their own.
  Each file is their own namespace; file path as the namespace with the extension trimmed (default).

| Strategy / Path                                        | `directory`                                | `file`       |
| ------------------------------------------------------ | ------------------------------------------ | ------------ |
| `a.ext`                                                | default namespace (≡ namespaces disabled)  | `a`          |
| `a/b.ext`, `a/c.ext`                                   | `a`                                        | `a/b`, `a/c` |
| `a/b/c.ext` with separator `.`                         | `a.b`                                      | `a.b.c`      |
| `a/index.ext` with indexFile `index`                   | `a`, as index files are not supported      | `a`          |
| `a/b.ext` with extension resolver that returns nothing | `a`, as extensions resolvers are not used. | `a/b.ext`    |

> **NOTE**: As shown, when using `file` strategy, both `a.ext` and `a/index.ext` (with `indexFile = "index"`) resolves to `a`.
> This is not prevented by the resolver function.
> Please consider this and avoid ambiguity while structuring the locales directory.

So, messages in different namespaces can have the same message name, but they would be stored in separate namespaces without any overriding problems.
This is useful for larger bots, as well as any other bot as it allows clear prefixing which allows flexibility.

### TypeScript Types

Like other grammY plugins, i18n also exports a flavor, for TypeScript to understand the i18n methods.

```ts
import type { Context } from "grammy";
import type { I18nFlavor } from "@grammyjs/i18n";

type MyContext = I18nFlavor<Context>;

const bot = new Bot<MyContext>(BOT_TOKEN);
const i18n = new I18n<MyContext>(/* options */);
```

i18n also brings support for types for messages and variables.
So that you get auto-completions for the message names and variables, allowing easier development and less mistakes.

```ts
type Typings = {
    locales: "en" | "zh"; // or just string, to not have any strict stuff here.
    namespaces: string; // or string literal union
    messages: {
        "msg-without-vars": never;
        "msg-with-vars": {
            theme: string;
            banCount: number;
            joinDate: Date;
            anything: string | number | Date /* ... */;
        };
    };
};

const adapter = new CustomAdapter<Typings>(/* .. */);
const i18n = new I18n<Context, Typings>({ adapter });

i18n.translate("de" /* ... */); // ts error: no locale
i18n.translate("en", "msg-with-vars"); // ts error: expected third argument.
i18n.translate("en", "msg-without-vars"); // no error
i18n.translate("en", "msg-without-vars", {}); // ts error: did not expect variables
i18n.translate("zh", "msg-with-vars", { theme: "simple" }); // ts error: expected all the variables

// the same works in `ctx.t`, not just `i18n.translate`.
```

Syncing typings with source translations ~~can be~~ is really difficult, considering variables and their types and all.
So, the [CLI](#cli) introduced in v2, has support for [generating types from source files](#type-generation).

## CLI

CLI can be used by running the following:

```bash
deno run jsr:@grammyjs/i18n/cli # see -h for help
```

It currently supports [TypeScript type generation](#type-generation) from your source files.

### Types Generation

Some adapters might support & expose their type generation capability.
For such adapters, you can use the `generate-types` command of the CLI to generate types.
The official Fluent adapter supports this feature.

```bash
deno run -A jsr:@grammyjs/i18n/cli generate-types \
    jsr:@grammyjs/i18n/adapter-fluent/cli \ # the adapter
    -o ./locales/types.d.ts \ # the output path
    # more flags
# with configuration file:
deno run -A jsr:@grammyjs/i18n/cli generate-types --config path/to/y18n.config.ts
# See `--help` for options and flags.
```

You can import the `GeneratedLocalesTypings` from the output file, and use it like as shown before, by passing it as a type argument in constructor & `I18nFlavor`.

```ts
import type { GeneratedLocalesTypings } from "../locales/types.d.ts";

type MyContext = I18nFlavor<Context, GeneratedLocalesTypings>; // for `ctx.t` & more.
const fluent = new FluentAdapter<GeneratedLocalesTypings>(); // for adapter (if it supports).
const i18n = new I18n<EContext, GeneratedLocalesTypings>(); // for i18n instance.
```

### CLI Configuration

It would be difficult to keep passing the options for CLI commands as arguments everytime you run it.
Even more difficult when collaborating and to share the exact flags & configuration for namespaces, paths, shared directories, etc.
So, you can store the configuration in a configuration file and pass the path as the `--config` flag.
The file may look like this:

```ts
import { defineConfig } from "@grammyjs/i18n/cli/config";
import fluentAdapter from "@grammyjs/i18n/adapter-fluent/cli";
import { createNamespaceResolver } from "@grammyjs/i18n";

export default defineConfig({
    adapter: fluentAdapter,
    followSymlinks: true,
    ignoreDotFiles: true,
    resolveNamespace: createNamespaceResolver({
        strategy: "directory",
        separator: "/",
    }),
    sources: {
        fallbackLocale: "en",
        path: "./locales",
        shared: "shared",
        deferShared: true,
    },
    types: {
        out: "./locales/types.d.ts",
        args: ["--allow-override"],
    },
});
```

All configuration properties are optional.
And, all can be overridden by passing additional flags when running the command.
Command line arguments take priority over the configuration file properties.

## Migrating from v1

v2 introduced so many changes that are useful, but came with a few inconvenient breaks for existing bots wishing to update to the new version.

1. The most important change is with the format we had built-in in v1: [Fluent](https://projectfluent.org).
   It is not directly integrated into i18n like before.
   You can use any compatible adapter.
   To migrate to v2, and to keep using Fluent, you must use a supported Fluent adapter.
   We do have an official Fluent adapter.

    Here's the v2 code:

    ```ts
    import { FluentAdapter } from "@grammyjs/i18n/adapter-fluent";

    const fluentAdapter = new FluentAdapter(/* options */); // in v1, this was not needed
    const i18n = new I18n({
        adapter: fluentAdapter,
        // ...
    });
    ```

1. `I18nFlavor` is a [Transformative context flavor](https://grammy.dev/guide/context#transformative-context-flavors) in v2, as opposed to an [additive context flavor](https://grammy.dev/guide/context#additive-context-flavors) in v1.
   Across all official plugins of grammY v2, flavors are now transformative.

    ```ts
    type MyContext = Context & I18nFlavor; // v1
    type MyContext = I18nFlavor<Context>; // v2
    ```

1. If you used i18n with sessions in v1, you will have to manually do that in locale negotiator in v2.

    ```ts
    // in v1, it was automatically handled for you when set `useSession` = true.
    const i18n = new I18n({
        useSession: true, // stores & retrieves user set locale in `ctx.session.__language_code` for pre-v1 compatibility.
        // ...
    });
    bot.command("language", async (ctx) => {
        await ctx.i18n.setLocale(ctx.match); // writes to session & renegotiates locale
    });
    ```

    In v2, you must handle everything by yourself.
    This way, it's independent of sessions directly, and you get much more flexibility by simply replacing a few lines.

    ```ts
    const i18n = new I18n({
        localeNegotiator: (ctx) =>
            ctx.session.__language_code ?? ctx.from.language_code, // retrieves from `ctx.session.__language_code`
    });
    bot.command("language", async (ctx) => {
        ctx.session.__language_code = ctx.match; // do by yourself.
    });
    ```

    The `ctx.i18n.setLocale(locale)` method which previously set the locale in session and renegotiated has also been removed.

1. In v2, `fallbackLocale` in the `I18n` constructor must be specified, replacing optional `defaultLocale` from v1.
   In v1, if the default locale was unspecified, `en` (language code for English) would have been used as the ultimate fallback locale, set by the plugin itself.
   It would have made no sense if English was not a locale in your application.
   v2 focuses on less surprises, as you must set a locale as `fallbackLocale` that is usually development focused & ideally 100 % complete.

1. Locales directory has been restructured in v2.
   In v1, the directory used to be a flat array directory where each file was for each locale.
   And in v1.1 support for splitting each locale into multiple files was implemented, making it easier to manage translations.

    ```asciiart
    locales/
    ├── en.ftl
    ├── es/ (all files effectively merged into 'es')
    │   ├── dialogues/
    │   │   ├── greeting.ftl
    │   │   └── goodbye.ftl
    │   └── help.ftl
    ├── it.ftl
    └── ru.ftl
    ```

    `en.ftl`, `it.ftl` etc. simply had all the messages in a single file, which worked well for smaller bots.
    In v2, the standard locales directory expected by the utilities and CLI is as following:

    ```asciiart
    locales/
    ├── en/
    │   ├── help.ftl
    │   └── main.ftl
    ├── es/
    │   ├── help.ftl
    │   └── main.ftl
    ├── it/ (ideally, similarly structured as 'en')
    ├── ru/ (ideally, similarly structured as 'en')
    └── shared/ (optional)
        └── main.ftl
    ```

    Just like v1, it simply merges into all messages across files into one namespace, unless a namespace resolver is used in CLI or utilities.
    The major change is, instead of having locales as single files in the root is no longer supported.
    Each locale must be their own directory with any number of files, nested or not.
    Appropriate use of [namespaces](#namespaces) may also enhance your experience.
    Read more at: [Locales directory](#locales-directory).

1. Locales directory handling is separated and more controlled in v2.
   Functions for loading locales directory were methods of the `I18n` class in v1.
   And you had an option to specify the directory right in the constructor options itself.

    ```ts
    const i18n = new I18n({
        directory: "./locales", // auto-loads by internally calling i18n.loadLocalesDirSync, which was unsupported in platforms like Deno Deploy.
        // ...
    });

    // or if needed,
    i18n.loadLocalesDirSync("./locales");
    await i18n.loadLocalesDir("./locales");
    ```

    In v2, the locales directory loading was completely moved from the core `I18n` class and is made part of format adapters.
    Any format adapter which supports `loadResource`, can be used with the `loadLocalesDirectory` utility.

    ```ts
    // using fluent adapter
    const adapter = new FluentAdapter();
    // pass the adapter to the i18n.
    await loadLocalesDirectory(adapter, "./locales", {
        extensions: [".ftl"],
        // ...
    });
    ```

1. `globalTranslationContext` has been removed in v2, because it provided no real use.
   And unnecessary overhead for most messages which doesn't need the global context values.
   So, they must be explicitly defined again in the messages that actually needs them.

1. `hears` function is now a method of `I18n` in v2.
   So, that it can work well with the message typings.

    ```ts
    bot.filter(hears("message-key") /*, (ctx) => {} */); // v1
    bot.filter(i18n.hears("message-key") /*, (ctx) => {} */); // v2
    ```

1. `renegotiateLocale()` in `ctx.i18n` got renamed to `negotiateLocale()`.

1. Warning handler of v1 is now replaced with a single `onMissingKey` handler in v2.
   The warning handler was very tightly associated with Fluent based implementation and it had unnecessary separation of events.
   But given that now it's an adapter-based implementation, just the missing message key event handling is enough.

    ```ts
    const warningHandler: WarningHandler = (w) => {
        const locales = w.bundles.locales.join(", ");
        switch (w.type) {
            case TranslateWarnings.MISSING_MESSAGE:
                console.warn(
                    `Translation message ${w.messageId} is missing in the following locales(s): ${locales}`,
                );
                break;
            case TranslateWarnings.MISSING_ATTRIBUTE:
                console.warn(
                    `${w.attributeName} attribute is missing in message ${w.messageId} for locales(s): ${locales}`,
                );
                break;
            case TranslateWarnings.MISSING_TRANSLATION:
                console.warn(
                    `Translation ${w.path} missing in locales: ${locales}`,
                );
                break;
            default:
                console.warn("Unknown warning");
        }
    };
    ```

    The `onMissingKey` handler takes in a object with information regarding the missing message key.
    It's called when a message key is not found in each negotiated locales, and the fallback locale.
    If fallback locale is not handled, the plugin throws an error.

    ```ts
    const i18n = new I18n({
        onMissingKey: (event) => {
            console.warn(
                `Missing ${event.messageKey} in ${event.currentLocale} (requested: ${event.requestedLocale})`,
            );
            if (event.fallback) {
                // return a string to show it as the translated message:
                return "Sorry, translation for this message could not be found. Kindly report this issue.";
                // or, throw an error for the bot's error handler to catch:
                // throw new Error("missing message key in fallback locale: " + event.messageKey);
            }
        },
    });
    ```

---

Thanks to all the previous & current maintainers & contributors of this plugin and [@grammyjs/fluent](https://github.com/grammyjs/fluent).

&copy; Licensed under MIT.
