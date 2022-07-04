import { extname } from "./deps.ts";

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
