import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.145.0/path/mod.ts";

import {
  build,
  emptyDir,
} from "https://raw.githubusercontent.com/roj1512/dnt/no-esm/mod.ts";

import package_ from "./package.json" assert { type: "json" };

const version = Deno.args[0];
if (!version) {
  throw new Error("Provide the version as an argument");
}

const thisDir = dirname(fromFileUrl(import.meta.url));
const outDir = join(
  thisDir,
  "../",
  "out",
);

await emptyDir(outDir);

await build({
  outDir,
  test: false,
  shims: {
    deno: true,
  },
  package: {
    version,
    ...package_,
  },
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
    "https://deno.land/x/fluent@v0.0.0/bundle/scope.ts": {
      name: "@fluent/bundle",
      version: "^0.17.1",
      subPath: "esm/scope",
    },
  },
});

Deno.copyFileSync(join(thisDir, "LICENSE"), join(outDir, "LICENSE"));
