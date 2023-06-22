export const platform = "node";
export const evalCommandArgs = ["--eval"];

export function fluentImport() {
  return 'const { Fluent, defaultWarningHandler } = require("./src/mod.js");';
}
