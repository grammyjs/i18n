import { extname, join, walkSync, SEP, WalkEntry } from "./deps.ts";
import { NestedTranslation } from "./types.ts";

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

export function readNestedLocalesDirSync(path: string): NestedTranslation[] {
  const files = new Array<NestedTranslation>();
  const filtered = new Array<NestedTranslation>();
  const locales = new Array<string>();

  function readAndPushFile(translation: WalkEntry): void {
    const extention = extname(translation.name);
    if (translation.isFile && extention === ".ftl") {
      const decoder = new TextDecoder("utf-8");
      const locale = translation.path.split(SEP)[1].split(".")[0];
      const filePath = join(
        Deno.cwd(),
        path,
        translation.path.replace(path, ""),
      );
      const contents = decoder.decode(Deno.readFileSync(filePath));

      if (contents.length === 0) {
        throw new Error(
          `The translation file '${translation.name}' resulted in an empty string during file read, which means that \
the file is most likely empty. Please add atleast one (1) translation key to this file (or simply just delete it) to solve \
this error. Restart your bot once you have fixed this issue.`,
        );
      }

      files.push({
        belongsTo: locale,
        translationSource: contents,
      });
    }
  }
  for (const dirEntry of walkSync(path)) readAndPushFile(dirEntry);
  for (const file of files) {
    const locale = file.belongsTo;
    if (locales.indexOf(locale) === -1) locales.push(locale);
  }
  for (const locale of locales) {
    const sameLocale = files.filter((file) => file.belongsTo === locale);
    const sourceOnly = sameLocale.map((match) => match.translationSource);
    filtered.push({
      belongsTo: locale,
      translationSource: sourceOnly.join("\n"),
    });
  }
  return filtered;
}
