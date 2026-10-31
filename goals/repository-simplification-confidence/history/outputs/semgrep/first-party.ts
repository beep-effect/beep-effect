// biome-ignore-all lint: Semgrep rule fixture for .semgrep/first-party.yml; each line is a deliberate positive or negative case.
// Paired positive (`ruleid:`) and negative (`ok:`) cases for every first-party
// Semgrep rule. `bun run beep ci lane sast` runs them with `semgrep --test` on
// every invocation, and a repo-cli test fails when a rule lacks either case.
// Run from the repository root:
//   docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep semgrep --test --config .semgrep/first-party.yml goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts
// This path is outside every compiled project and is already excluded from the
// SAST scan (`goals/**/history/outputs/` in .semgrepignore), fallow and oxlint.
import * as childProcess from "node:child_process";
import { exec, execSync } from "node:child_process";
import defaultChildProcess from "child_process";

const requiredChildProcess = require("node:child_process");

declare const userInput: string;
declare const command: string;
declare const args: string;
declare const onDone: () => void;

// ruleid: beep-no-eval
eval(userInput);
// ruleid: beep-no-eval
globalThis.eval(userInput);
// ruleid: beep-no-eval
window.eval(userInput);
// ok: beep-no-eval
JSON.parse(userInput);

// ruleid: beep-no-dynamic-shell-exec
exec(command);
// ruleid: beep-no-dynamic-shell-exec
execSync(`git ${args}`);
// ruleid: beep-no-dynamic-shell-exec
childProcess.exec(command, onDone);
// ruleid: beep-no-dynamic-shell-exec
childProcess.execSync(command);
// ruleid: beep-no-dynamic-shell-exec
defaultChildProcess.exec(command);
// ruleid: beep-no-dynamic-shell-exec
requiredChildProcess.execSync(`rm -rf ${args}`);
// ok: beep-no-dynamic-shell-exec
childProcess.exec("git status");
// ok: beep-no-dynamic-shell-exec
exec("git status");
// ok: beep-no-dynamic-shell-exec
childProcess.execSync("git rev-parse HEAD");
// ok: beep-no-dynamic-shell-exec
/needle/.exec(command);

// ok: beep-hardcoded-private-key
export const certificate = "-----BEGIN CERTIFICATE-----";
// The positive case stays last and header-only: gitleaks matches a private-key
// header only together with a later key marker, so this file carries none.
// ruleid: beep-hardcoded-private-key
export const leakedKey = "-----BEGIN RSA PRIVATE KEY-----";
