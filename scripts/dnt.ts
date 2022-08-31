import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.153.0/path/mod.ts";

import { build, emptyDir } from "https://deno.land/x/dnt@0.30.0/mod.ts";

import package_ from "./package.json" assert { type: "json" };

const version = Deno.args[0];
if (!version) {
  throw new Error("Provide the version as an argument");
}

const rootDir = join(dirname(fromFileUrl(import.meta.url)), "../");
const outDir = join(rootDir, "out");

await emptyDir(outDir);

await build({
  outDir,
  shims: {
    deno: true,
  },
  package: {
    version,
    ...package_,
  },
  esModule: false,
  entryPoints: ["./src/mod.ts"],
  mappings: {
    "https://lib.deno.dev/x/grammy@1.x/mod.ts": {
      name: "grammy",
      version: "^1.10.0",
      peerDependency: true,
    },
    "https://lib.deno.dev/x/grammy@1.x/types.ts": {
      name: "grammy",
      version: "^1.10.0",
      subPath: "out/types",
      peerDependency: true,
    },
  },
});

Deno.copyFileSync(join(rootDir, "LICENSE"), join(outDir, "LICENSE"));
