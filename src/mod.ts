import {
  i18n,
  InitOptions,
  LanguageDetectorModule,
  Middleware,
  NextFunction,
  Services,
} from "./deps.deno.ts";
import { Config, i18nFlavorContextS } from "./types.ts";
export class GrammyLanguageDetector implements LanguageDetectorModule {
  constructor(ctx: i18nFlavorContextS, useSession: boolean) {
    this.useSession = useSession;
    this.ctx = ctx;
  }
  static type = "languageDetector" as const;
  ctx: i18nFlavorContextS | undefined;
  useSession: boolean | undefined;
  type = GrammyLanguageDetector.type;
  services!: Services;
  i18nextOptions!: InitOptions;
  init(services: Services, i18nextOptions: InitOptions): void {
    this.services = services;
    this.i18nextOptions = i18nextOptions;
  }

  detect(): string | string[] | undefined {
    return languageDetector(this.ctx, this.useSession || false);
  }
  cacheUserLanguage(lng: string) {
    if (this.useSession && this.ctx?.session) {
      this.ctx.session.__language_code = lng;
    }
  }
}

function languageDetector(
  ctx: i18nFlavorContextS | undefined,
  useSession: boolean,
) {
  if (useSession && ctx?.session?.__language_code) {
    return ctx?.session.__language_code;
  } else if (useSession && ctx?.session) {
    return ctx?.from?.language_code;
  } else {
    return ctx?.from?.language_code;
  }
}

export class i18nMiddleware {
  constructor(i18nextInstance: i18n, config: Config) {
    this.i18nextInstance = i18nextInstance;
    this.config = config;
  }
  config: Config;
  i18nextInstance: i18n;
  langDetect<C extends i18nFlavorContextS>(): Middleware<C> {
    return async (ctx:i18nFlavorContextS, next: NextFunction) => {
      console.log(ctx.from, ctx.session);
      const langDetect = new GrammyLanguageDetector(
        ctx,
        this.config.useSession || false,
      );
      if (!this.i18nextInstance?.options.debug) {
        // <-- this is a hack to make sure that i18next is initialized only once}
        this.i18nextInstance.createInstance();
        await this.i18nextInstance
          .use(langDetect)
          .init(this.config.i18nextOptions);
        ctx.i18n = this.i18nextInstance;
      } else {
        await this.i18nextInstance.changeLanguage(
          languageDetector(ctx, this.config.useSession || false),
        );
        ctx.i18n = this.i18nextInstance;
      }
      ctx.i18n.on("languageChanged", (lng: string) => {
        // Keep language in sync
        if (ctx.session) {
          ctx.i18n.services.languageDetector.cacheUserLanguage(lng);
        }
      });
      await next();
    };
  }
}
