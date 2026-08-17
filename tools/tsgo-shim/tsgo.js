#!/usr/bin/env node
import { execFileSync } from "node:child_process";
// `tsgo` for this repo executes the compiler artifact shipped by the installed
// @effect/tsgo package directly. Do not route this through the mutable
// @typescript/native patch: a preserved `.original` backup can make a newer
// patcher mistake an older Effect compiler for the current one.
import getExePath from "@effect/tsgo/lib/getExePath";

const executable = getExePath();

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
