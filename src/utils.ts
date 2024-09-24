import { extname, join, SEP, walk, walkSync } from "./deps.ts";
import { NestedTranslation } from "./types.ts";

function throwReadFileError(path: string) {
  throw new Error(
    `Something went wrong while reading the "${path}" file, usually, this can be caused by the file being empty. \
If it is, please add at least one translation key to this file (or simply just delete it) to solve this error.`,
  );
}

export async function readLocalesDir(
  path: string,
): Promise<NestedTranslation[]> {
  const files = new Array<NestedTranslation>();
  const locales = new Set<string>();

  for await (const entry of walk(path)) {
    if (entry.isFile && extname(entry.name) === ".ftl") {
      try {
        const decoder = new TextDecoder("utf-8");
        const excludeRoot = entry.path.replace(path, "");
        const contents = await Deno.readFile(join(path, excludeRoot));

        const belongsTo = excludeRoot.split(SEP)[1].split(".")[0];
        const translationSource = decoder.decode(contents);

        files.push({
          belongsTo,
          translationSource,
        });
        locales.add(belongsTo);
      } catch {
        throwReadFileError(entry.path);
      }
    }
  }

  return Array.from(locales).map((locale) => {
    const sameLocale = files.filter((file) => file.belongsTo === locale);
    const sourceOnly = sameLocale.map((file) => file.translationSource);
    return {
      belongsTo: locale,
      translationSource: sourceOnly.join("\n"),
    };
  });
}

export function readLocalesDirSync(path: string): NestedTranslation[] {
  const files = new Array<NestedTranslation>();
  const locales = new Set<string>();

  for (const entry of walkSync(path)) {
    if (entry.isFile && extname(entry.name) === ".ftl") {
      try {
        const decoder = new TextDecoder("utf-8");
        const excludeRoot = entry.path.replace(path, "");
        const contents = Deno.readFileSync(join(path, excludeRoot));

        const belongsTo = excludeRoot.split(SEP)[1].split(".")[0];
        const translationSource = decoder.decode(contents);

        files.push({
          belongsTo,
          translationSource,
        });
        locales.add(belongsTo);
      } catch {
        throwReadFileError(entry.path);
      }
    }
  }

  return Array.from(locales).map((locale) => {
    const sameLocale = files.filter((file) => file.belongsTo === locale);
    const sourceOnly = sameLocale.map((file) => file.translationSource);
    return {
      belongsTo: locale,
      translationSource: sourceOnly.join("\n"),
    };
  });
}
