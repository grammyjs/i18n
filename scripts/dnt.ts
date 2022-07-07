import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.147.0/path/mod.ts";

import { build, emptyDir } from "https://deno.land/x/dnt@0.28.0/mod.ts";

import package_ from "./package.json" assert { type: "json" };

const version = Deno.args[0];
if (!version) {
  throw new Error("Provide the version as an argument");
}

const rootDir = join(dirname(fromFileUrl(import.meta.url)), "../");
const outDir = join(
  rootDir,
  "out",
);

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
    "https://deno.land/x/better_fluent@v0.1.0/mod.ts": {
      name: "@moebius/fluent",
      version: "^1.0.0",
    },
    "https://lib.deno.dev/x/grammy@1.x/mod.ts": {
      name: "grammy",
      version: "^1.9.0",
      peerDependency: true,
    },
    "https://deno.land/x/fluent@v0.0.0/bundle/types.ts": {
      name: "@fluent/bundle",
      version: "^0.17.1",
    },
  },
});

Deno.copyFileSync(join(rootDir, "LICENSE"), join(outDir, "LICENSE"));
