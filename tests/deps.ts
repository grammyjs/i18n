export {
  assert,
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.217.0/testing/asserts.ts";
export { join } from "https://deno.land/std@0.217.0/path/mod.ts";
export {
  Bot,
  Context,
  session,
  type SessionFlavor,
} from "https://lib.deno.dev/x/grammy@1.x/mod.ts";

import { Bot, Context } from "https://lib.deno.dev/x/grammy@1.x/mod.ts";
import {
  Chat,
  MessageEntity,
  Update,
  User,
  UserFromGetMe,
} from "https://lib.deno.dev/x/grammy@1.x/types.ts";

export class Chats<C extends Context> {
  constructor(private bot: Bot<C>, botInfo?: UserFromGetMe) {
    this.bot.botInfo = botInfo ?? {
      id: 42,
      first_name: "Test Bot",
      is_bot: true,
      username: "test_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false
    };

    this.bot.api.config.use(() => {
      // deno-lint-ignore no-explicit-any
      return { ok: true, result: true } as any;
    });
  }

  newUser(user: Omit<User, "is_bot">) {
    return new TestUser<C>(this.bot, user);
  }
}

interface BotResponse {
  method: string;
  // deno-lint-ignore no-explicit-any
  payload: any;
}

interface SendMessageOptions {
  id?: number;
  entities?: MessageEntity[];
}

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

class TestUser<C extends Context> {
  private user: User;
  private chat: Chat.PrivateChat;
  private message_id = 1;
  private update_id = 100000;
  public responses: BotResponse[] = [];

  constructor(private bot: Bot<C>, user: Omit<User, "is_bot">) {
    this.user = { ...user, is_bot: false };
    this.chat = {
      first_name: user.first_name,
      id: user.id,
      type: "private",
      last_name: user.last_name,
      username: user.username,
    };
    this.bot.api.config.use((prev, method, payload, signal) => {
      if (method.startsWith("send")) this.message_id++;
      if ("chat_id" in payload && payload.chat_id === this.user.id) {
        this.responses.push({ method, payload });
      }
      return prev(method, payload, signal);
    });
  }

  get last() {
    return this.responses[this.responses.length - 1].payload;
  }

  async sendUpdate(update: Optional<Update, "update_id">) {
    const updateToSend = { update_id: this.update_id++, ...update };
    await this.bot.handleUpdate(updateToSend);
    return updateToSend;
  }

  sendMessage(text: string, options?: SendMessageOptions) {
    return this.sendUpdate({
      message: {
        text,
        chat: this.chat,
        from: this.user,
        date: Date.now(),
        message_id: options?.id ?? this.message_id++,
        entities: options?.entities,
      },
    });
  }

  command(command: string, payload?: string) {
    const text = `/${command}${payload ? ` ${payload}` : ""}`;
    return this.sendMessage(text, {
      entities: [{
        type: "bot_command",
        offset: 0,
        length: 1 + command.length,
      }],
    });
  }
}
