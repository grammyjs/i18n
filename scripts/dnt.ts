import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.192.0/path/mod.ts";
import { build, emptyDir } from "https://deno.land/x/dnt@0.37.0/mod.ts";

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
      subPath: "types",
      peerDependency: true,
    },
    "https://deno.land/x/fluent@v0.0.0/bundle/mod.ts": {
      name: "@fluent/bundle",
      version: "^0.17.1",
    },
    "https://deno.land/x/fluent@v0.0.0/langneg/mod.ts": {
      name: "@fluent/langneg",
      version: "^0.6.2",
    },
    "./tests/platform.deno.ts": "./tests/platform.node.ts",
  },
});

Deno.copyFileSync(join(rootDir, "LICENSE"), join(outDir, "LICENSE"));
