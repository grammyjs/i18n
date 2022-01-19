import i18next, { Services, LanguageDetectorModule, InitOptions, Context, i18n, SessionFlavor, Middleware } from "./deps.deno.ts";
let i18n_instance: i18n;
export class GrammyLanguageDetector implements LanguageDetectorModule {
  constructor(ctx: i18nFlavorContextS, useSession: boolean) {
    this.useSession = useSession;
    this.ctx = ctx;
  }
  static type = "languageDetector" as const;
  ctx: i18nFlavorContextS | undefined;
  useSession: boolean;
  type = GrammyLanguageDetector.type;
  services!: Services;
  i18nextOptions!: InitOptions;
  init(
      services: Services,
      i18nextOptions: InitOptions
  ): void {
    this.services = services;
    this.i18nextOptions = i18nextOptions;
  }

  detect(): string | string[] | undefined {
    return languageDetector(this.ctx, this.useSession);
  }
  cacheUserLanguage (lng:string) {
    if (this.useSession && this.ctx?.session) {
      this.ctx.session.__language_code = lng;
    }
  }
}


interface  i18nFlavor extends Context {
  i18n: i18n;
}

interface SessionFlavori18n extends SessionFlavor<any> {
  __language_code?: string;
}
type i18nFlavorContextS = Context & i18nFlavor & SessionFlavori18n;


function languageDetector(ctx: i18nFlavorContextS|undefined, useSession: boolean) {
    if (useSession && ctx?.session?.__language_code) {
        return ctx?.session.__language_code;
      } else if (useSession && ctx?.session) {
        return ctx?.from?.language_code
      } else {
        return ctx?.from?.language_code;
      }
}

export function langDetect<C extends i18nFlavorContextS>(InitOptions: InitOptions, useSession: boolean): Middleware<C> {
    return async (ctx, next) => {
        const langDetect = new GrammyLanguageDetector(ctx, useSession);
        if (!i18n_instance) { // <-- this is a hack to make sure that i18next is initialized only once}
            i18n_instance = i18next.createInstance();
            await i18n_instance.use(langDetect).init(InitOptions);
            ctx.i18n = i18n_instance;
        } else {
            await i18n_instance.changeLanguage(languageDetector(ctx, useSession));
            ctx.i18n = i18n_instance;
        }
      console.log("Language", ctx.from?.language_code);
     
      ctx.i18n.on('languageChanged', (lng:string) => { // Keep language in sync
        if(ctx.session){
          ctx.i18n.services.languageDetector.cacheUserLanguage(lng);
        }
      })
      await next();
    }
  }
