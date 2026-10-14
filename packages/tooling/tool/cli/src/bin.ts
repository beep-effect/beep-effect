#!/usr/bin/env bun

/**
 * Lightweight CLI entry point for the repo command suite.
 *
 * The root `lint --fix` no-op path intentionally stays in this tiny module so
 * clean worktrees do not pay the startup cost of loading the full Effect CLI.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

const rawArgv = Bun.argv.slice(2);

if (rawArgv.length === 2 && rawArgv[0] === "lint" && rawArgv[1] === "--fix") {
  const A = await import("effect/Array");
  const CHANGED_PATH_DIFF_FILTER = "ACMRTUXB";
  const runGit = (args: ReadonlyArray<string>) =>
    Bun.spawnSync({
      cmd: ["git", ...args],
      stderr: "ignore",
      stdout: "pipe",
    });
  const outputs = [
    runGit(["diff", "--name-only", `--diff-filter=${CHANGED_PATH_DIFF_FILTER}`, "HEAD", "--"]),
    runGit(["diff", "--cached", "--name-only", `--diff-filter=${CHANGED_PATH_DIFF_FILTER}`, "--"]),
    runGit(["ls-files", "--others", "--exclude-standard"]),
  ];

  if (A.every(outputs, (output) => output.success)) {
    const changedFiles = A.flatMap(outputs, (output) =>
      A.filter(output.stdout.toString().trim().split(/\r?\n/), (line) => line.length > 0)
    );

    if (changedFiles.length === 0) {
      process.stdout.write("[beep-cli] lint:fix: no changed files\n");
      process.exit(0);
    }
  }
}

const fullCliModule = new URL("./bin-main.js", import.meta.url).href;
await import(fullCliModule);
