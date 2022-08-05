import { extname } from "./deps.ts";

export async function readLocalesDir(path: string): Promise<string[]> {
  const files = new Array<string>();
  for await (const entry of Deno.readDir(path)) {
    if (!entry.isFile) continue;
    const extension = extname(entry.name);
    if (extension !== ".ftl") continue;
    files.push(entry.name);
  }
  return files;
}

export function readLocalesDirSync(path: string): string[] {
  const files = new Array<string>();
  for (const entry of Deno.readDirSync(path)) {
    if (!entry.isFile) continue;
    const extension = extname(entry.name);
    if (extension !== ".ftl") continue;
    files.push(entry.name);
  }
  return files;
}
