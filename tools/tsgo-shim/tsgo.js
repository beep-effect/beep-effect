#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import module from "node:module";
import path from "node:path";

// `tsgo` for this repo executes the compiler artifact shipped by the installed
// @effect/tsgo package directly. Do not route this through the mutable
// @typescript/native patch: a preserved `.original` backup can make a newer
// patcher mistake an older Effect compiler for the current one.
// Resolve through the bundled CLI because 0.39 platform packages use upstream
// metadata schema v5 while the package's exported helper still accepts only v4.
const require = module.createRequire(import.meta.url);
const packageJsonPath = require.resolve("@effect/tsgo/package.json");
const effectTsgoCli = path.join(path.dirname(packageJsonPath), "dist", "effect-tsgo.cjs");
const executable = execFileSync(process.execPath, [effectTsgoCli, "get-exe-path"], {
  encoding: "utf8",
}).trim();

if (process.platform !== "win32" && typeof process.execve === "function") {
  try {
    process.execve(executable, [executable, ...process.argv.slice(2)]);
  } catch {
    // Fall back for runtimes that expose execve without supporting it here.
  }
}

try {
  execFileSync(executable, process.argv.slice(2), { stdio: "inherit" });
} catch (cause) {
  if (cause && typeof cause === "object" && "status" in cause && cause.status) {
    process.exitCode = cause.status;
  } else {
    throw cause;
  }
}
