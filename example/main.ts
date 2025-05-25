import {
    Bot,
    Context,
    InlineKeyboard,
    InputFile,
} from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { I18n, I18nFlavor, loadLocalesDirectory } from "../mod.ts";
import { FluentAdapter } from "../adapter_fluent.ts";
import { GeneratedLocalesTypings } from "./locales.ts";

type EContext = I18nFlavor<Context, GeneratedLocalesTypings>;

const bot = new Bot<EContext>(Deno.env.get("BOT_TOKEN")!);
const fluent = new FluentAdapter();
await loadLocalesDirectory(fluent, "./locales", {
    extension: ".ftl", // extension to walk through.
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
    await ctx.reply(ctx.translate("start"), {
        reply_markup: new InlineKeyboard()
            .text(ctx.translate("start.ping-button"), "ping"),
    });
});

bot.callbackQuery("ping", async (ctx) => {
    await ctx.answerCallbackQuery(ctx.translate("start.ping-alert"));
});

bot.command("developer_info", async (ctx) => {
    await ctx.reply(
        ctx.translate("about", {
            projectUrl: "https://github.com/grammyjs/i18n/tree/v2/example",
        }),
    );
});

bot.on("message:photo", async (ctx) => {
    const { width, height, file_size } =
        ctx.message.photo[ctx.message.photo.length - 1];

    await ctx.reply(
        ctx.translate("image-info", {
            height,
            width,
            size: file_size ? file_size + " bytes" : "Unknown",
        }),
    );

    await ctx.reply(
        ctx.translate("status.downloading", {
            size: file_size ?? "Unknown size",
        }),
    );
    const { file_path } = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${bot.token}/${file_path}`;
    const response = await fetch(url);

    await ctx.reply(ctx.translate("status.uploading"));
    await ctx.replyWithDocument(new InputFile(response, "doc.jpg"));
});

bot.start({ drop_pending_updates: true });
