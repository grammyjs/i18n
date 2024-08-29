import { extname, join, SEP, walk, walkSync } from "./deps.ts";
import { NestedTranslation } from "./types.ts";

export async function readLocalesDir(
  path: string,
): Promise<NestedTranslation[]> {
  const files = new Array<NestedTranslation>();
  const filtered = new Array<NestedTranslation>();
  const locales = new Array<string>();

  for await (const entry of walk(path)) {
    const extension = extname(entry.name);
    if (entry.isFile && extension === ".ftl") {
      const decoder = new TextDecoder("utf-8");
      const filePath = join(path, entry.path.replace(path, ""));
      const contents = await Deno.readFile(filePath);

      if (!contents) {
        throw new Error(
          `Translation file ${entry.name} resulted in an empty string, which means the file is most likely empty. \
Please add at least one translation key to this file (or simply just delete it) to solve this error.`,
        );
      }

      files.push({
        belongsTo: entry.path.split(SEP)[1].split(".")[0],
        translationSource: decoder.decode(contents),
      });
    }
  }
  for (const file of files) {
    if (locales.indexOf(file.belongsTo) === -1) locales.push(file.belongsTo);
  }
  for (const locale of locales) {
    const sameLocale = files.filter((file) => file.belongsTo === locale);
    const sourceOnly = sameLocale.map((file) => file.translationSource);

    filtered.push({
      belongsTo: locale,
      translationSource: sourceOnly.join("\n"),
    });
  }
  return filtered;
}

export function readLocalesDirSync(path: string): NestedTranslation[] {
  const files = new Array<NestedTranslation>();
  const filtered = new Array<NestedTranslation>();
  const locales = new Array<string>();

  for (const entry of walkSync(path)) {
    const extension = extname(entry.name);
    if (entry.isFile && extension === ".ftl") {
      const decoder = new TextDecoder("utf-8");
      const filePath = join(path, entry.path.replace(path, ""));
      const contents = Deno.readFileSync(filePath);

      if (!contents) {
        throw new Error(
          `Translation file ${entry.name} resulted in an empty string, which means the file is most likely empty. \
Please add at least one translation key to this file (or simply just delete it) to solve this error.`,
        );
      }

      files.push({
        belongsTo: entry.path.split(SEP)[1].split(".")[0],
        translationSource: decoder.decode(contents),
      });
    }
  }
  for (const file of files) {
    if (locales.indexOf(file.belongsTo) === -1) locales.push(file.belongsTo);
  }
  for (const locale of locales) {
    const sameLocale = files.filter((file) => file.belongsTo === locale);
    const sourceOnly = sameLocale.map((file) => file.translationSource);

    filtered.push({
      belongsTo: locale,
      translationSource: sourceOnly.join("\n"),
    });
  }
  return filtered;
}
