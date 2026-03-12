import { Bot, Context, InputFile } from "@grammyjs/grammy";
import { InlineKeyboard } from "@grammyjs/grammy/keyboard";
import { I18n, I18nFlavor, loadLocalesDirectory } from "../mod.ts";
import { FluentAdapter } from "../adapter_fluent.ts";
import { GeneratedLocalesTypings } from "./locales.ts";

type EContext = I18nFlavor<Context, GeneratedLocalesTypings>;

const bot = new Bot<EContext>(Deno.env.get("BOT_TOKEN")!);
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
            size: file_size ? file_size + " bytes" : "Unknown",
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
