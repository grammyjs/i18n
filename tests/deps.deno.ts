export function evalCommand() {
  return ["deno", "eval"];
}

export function fluentImport() {
  return 'import { Fluent, defaultWarningHandler } from "./src/mod.ts";';
}
