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
let handledLintFixNoop = false;

if (rawArgv.length === 2 && rawArgv[0] === "lint" && rawArgv[1] === "--fix") {
  const [A, Str] = await Promise.all([import("effect/Array"), import("effect/String")]);
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
      A.filter(Str.split(/\r?\n/)(Str.trim(output.stdout.toString())), (line) => line.length > 0)
    );

    if (changedFiles.length === 0) {
      const [{ runMain }, Console] = await Promise.all([
        import("@effect/platform-bun/BunRuntime"),
        import("effect/Console"),
      ]);
      runMain(Console.log("[beep-cli] lint:fix: no changed files"));
      handledLintFixNoop = true;
    }
  }
}

if (!handledLintFixNoop) {
  const fullCliModule = new URL("./bin-main.js", import.meta.url).href;
  await import(fullCliModule);
}
