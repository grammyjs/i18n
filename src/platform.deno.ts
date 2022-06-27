import { extname } from "https://deno.land/std@0.145.0/path/mod.ts";

export function exists(path: string): boolean {
  try {
    Deno.lstatSync(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    }
    throw err;
  }
}

export function readLocalesDir(path: string): string[] {
  const files = new Array<string>();
  for (const entry of Deno.readDirSync(path)) {
    if (!entry.isFile) continue;
    const extension = extname(entry.name);
    if (extension !== ".ftl") continue;
    files.push(entry.name);
  }
  return files;
}

export {
  Fluent,
  type FluentBundleOptions,
  type FluentOptions,
  type LocaleId,
  type TranslationContext,
} from "https://deno.land/x/better_fluent@v0.1.0/mod.ts";

export {
  FluentType,
  type FluentValue,
} from "https://deno.land/x/fluent@v0.0.0/bundle/types.ts";
export { Scope } from "https://deno.land/x/fluent@v0.0.0/bundle/scope.ts";

export {
  Context,
  type Middleware,
  type NextFunction,
} from "https://lib.deno.dev/x/grammy@1.x/mod.ts";

export { resolve } from "https://deno.land/std@0.145.0/path/mod.ts";
