#!/usr/bin/env node
import * as NodeChildProcess from "node:child_process";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

const require = NodeModule.createRequire(import.meta.url);
const packageJsonPath = require.resolve("@effect/tsgo/package.json");
// decision: tsgo-runs-the-effect-compiler-artifact
const effectTsgoCli = NodePath.join(NodePath.dirname(packageJsonPath), "dist", "effect-tsgo.cjs");
const executable = NodeChildProcess.execFileSync(process.execPath, [effectTsgoCli, "get-exe-path"], {
  encoding: "utf8",
}).trim();

if (process.platform !== "win32" && typeof process.execve === "function") {
  try {
    process.execve(executable, [executable, ...process.argv.slice(2)]);
  } catch {
    // decision: tsgo-runs-the-effect-compiler-artifact
  }
}

try {
  NodeChildProcess.execFileSync(executable, process.argv.slice(2), { stdio: "inherit" });
} catch (cause) {
  if (cause && typeof cause === "object" && "status" in cause && cause.status) {
    process.exitCode = cause.status;
  } else {
    throw cause;
  }
}
