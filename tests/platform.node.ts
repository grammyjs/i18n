import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);

const fluentImport =
  'const { Fluent, defaultWarningHandler } = require("./src/mod.js");';

interface EvalCodeOutput {
  success: boolean;
  stdout: string;
  stderr: string;
}

export async function evalCode(code: string): Promise<EvalCodeOutput> {
  try {
    const command = await exec("node", [
      "--eval",
      `${fluentImport}\n${code.trim()}`,
    ]);
    return { success: true, stdout: command.stdout.trim(), stderr: command.stderr.trim() };
  } catch (error) {
    return { success: false, stdout: error.stdout.trim(), stderr: error.stderr.trim() };
  }
}
