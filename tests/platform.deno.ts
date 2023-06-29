const fluentImport =
  'import { Fluent, defaultWarningHandler } from "./src/mod.ts";';

const decoder = new TextDecoder();

export async function evalCode(code: string) {
  const evalCommand = new Deno.Command("deno", {
    args: ["eval", `${fluentImport}\n${code.trim()}`],
    stderr: "piped",
    stdout: "piped",
  });
  const output = await evalCommand.output();
  return {
    success: output.success,
    stdout: decoder.decode(output.stdout).trim(),
    stderr: decoder.decode(output.stderr).trim(),
  };
}
