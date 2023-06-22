export const platform = "deno";
export const evalCommandArgs = ["eval"];

export function fluentImport() {
  return 'import { Fluent, defaultWarningHandler } from "./src/mod.ts";';
}
