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
        path: "./example/locales",
    },
    types: {
        out: "./example/locales/types.d.ts",
        args: [],
    },
});
