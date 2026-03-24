// todo: write a better example of a useful bot.
import { Bot, type Context, InputFile } from "@grammyjs/grammy";
import { InlineKeyboard } from "@grammyjs/grammy/keyboard";
import { FluentAdapter } from "../adapters/fluent/adapter.ts";
import { I18n, type I18nFlavor, loadLocalesDirectory } from "../mod.ts";
import type { GeneratedLocalesTypings } from "./locales.ts";

type EContext = I18nFlavor<Context, GeneratedLocalesTypings>;

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
if (!BOT_TOKEN) {
    throw new Error("Set BOT_TOKEN environment variable");
}
const bot = new Bot<EContext>(BOT_TOKEN);

const fluent = new FluentAdapter();
await loadLocalesDirectory(fluent, "./locales", {
    extensions: [".ftl"], // extension to walk through.
    // optional configuration
    followSymlinks: false,
    ignoreDotFiles: true,
    includeCommonSources: true,
});

const i18n = new I18n<EContext, GeneratedLocalesTypings>({
    adapter: fluent,
    fallbackLocale: "en",
    localeNegotiator: (ctx) => ctx.from?.language_code,
    onMissingKey: (event) => {
        console.error("Missing key:", event);
        if (event.fallback) {
            return "Custom fallback message";
        }
    },
});
bot.use(i18n.middleware());

bot.command("start", async (ctx) => {
    await ctx.sendMessage(ctx.translate("start"), {
        reply_markup: new InlineKeyboard()
            .text(ctx.translate("start.ping-button"), "ping"),
    });
});

bot.use(i18n.hears("start.ping-button"), async (ctx) => {
    await ctx.send(ctx.translate("start.ping-alert"));
});

bot.callbackQuery("ping", async (ctx) => {
    await ctx.answerCallbackQuery(ctx.translate("start.ping-alert"));
});

bot.command("developer_info", async (ctx) => {
    await ctx.sendMessage(
        ctx.translate("about", {
            projectUrl: "https://github.com/grammyjs/i18n/tree/v2/example",
        }),
    );
});

bot.on("message:photo", async (ctx) => {
    const { width, height, file_size } =
        ctx.message.photo[ctx.message.photo.length - 1];

    await ctx.sendMessage(
        ctx.translate("image-info", {
            height,
            width,
            size: file_size ? `${file_size} bytes` : "Unknown",
        }),
    );

    await ctx.sendMessage(
        ctx.translate("status.downloading", {
            size: file_size ?? "Unknown size",
        }),
    );
    const { file_path } = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${bot.token}/${file_path}`;
    const response = await fetch(url);

    await ctx.sendMessage(ctx.translate("status.uploading"));
    await ctx.sendDocument(new InputFile(response, "doc.jpg"));
});

bot.start({ drop_pending_updates: true });
