export {
  Fluent,
  type FluentBundleOptions,
  type FluentOptions,
  type LocaleId,
  type TranslationContext,
} from "@moebius/fluent";

export { FluentType, type FluentValue } from "@fluent/bundle";
export { Scope } from "@fluent/bundle/esm/scope";

export { Context, type Middleware, type NextFunction } from "grammy";

export { extname, resolve } from "path";

import { existsSync, readdirSync } from "fs";

export function exists(path: string): boolean {
  return existsSync(path);
}

export function readLocalesDir(path: string): string[] {
  const files = new Array<string>();
  for (const file of readdirSync(path, { withFileTypes: true })) {
    if (!file.isFile()) continue;
    files.push(file.name);
  }
  return files;
}
