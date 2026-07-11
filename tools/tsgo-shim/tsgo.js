#!/usr/bin/env node
// `tsgo` for this repo: executes the TypeScript 7 native compiler shipped by
// the `@typescript/native` backend, which `effect-tsgo patch` (root prepare
// script) replaces with the Effect Language Service build. The retired
// `@typescript/native-preview` bin bypassed that patch, so its diagnostics
// silently lacked the effect rules on fresh installs.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("@typescript/native/package.json");
await import(pathToFileURL(join(dirname(packageJsonPath), "lib", "tsc.js")).href);
