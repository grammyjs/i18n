import { Context, i18n, InitOptions, SessionFlavor } from "./deps.deno.ts";

interface i18nFlavor extends Context {
  i18n: i18n;
}

interface SessionFlavori18n extends SessionFlavor<any> {
  __language_code?: string;
}
export type i18nFlavorContextS = Context & i18nFlavor & SessionFlavori18n;

export interface Config {
  readonly useSession?: boolean;
  i18nextOptions: InitOptions;
}
