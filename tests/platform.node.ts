export function evalCommand() {
  return ["node", "--eval"];
}

export function fluentImport() {
  return 'const { Fluent, defaultWarningHandler } = require("./src/mod.js");';
}
