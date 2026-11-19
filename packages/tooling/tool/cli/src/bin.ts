#!/usr/bin/env bun

/**
 * Lightweight CLI entry point for the repo command suite.
 *
 * The root `lint --fix` no-op path intentionally stays in this tiny module so
 * clean worktrees do not pay the startup cost of loading the full Effect CLI.
 * So does `quality check-probe`, which leads every package's generated `check`
 * script: it loads the filesystem probe alone (about 0.1 s, against about 1 s
 * for the full CLI).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

const rawArgv = Bun.argv.slice(2);
let handledLintFixNoop = false;
const isCheckProbe = rawArgv.length === 2 && rawArgv[0] === "quality" && rawArgv[1] === "check-probe";

if (isCheckProbe) {
  const [{ runMain }, BunFileSystem, BunPath, Effect, Layer, { checkPackageReferencesBuilt }] = await Promise.all([
    import("@effect/platform-bun/BunRuntime"),
    import("@effect/platform-bun/BunFileSystem"),
    import("@effect/platform-bun/BunPath"),
    import("effect/Effect"),
    import("effect/Layer"),
    import("./commands/Quality/CheckProbe.ts"),
  ]);
  // A generated `check` script runs in its package directory. The platform
  // layer is built into a context here, at the entry point, as bin-main does.
  runMain(
    Layer.merge(BunFileSystem.layer, BunPath.layer).pipe(
      Layer.build,
      Effect.flatMap((context) => Effect.provide(checkPackageReferencesBuilt(process.cwd()), context)),
      Effect.scoped
    )
  );
}

if (rawArgv.length === 2 && rawArgv[0] === "lint" && rawArgv[1] === "--fix") {
  const [A, Str] = await Promise.all([import("effect/Array"), import("effect/String")]);
  const CHANGED_PATH_DIFF_FILTER = "ACMRTUXB";
  const runGit = (args: ReadonlyArray<string>) =>
    // KEEP (D-21, X4-X6): the three `lint --fix` no-op reads run before any Effect runtime exists, so no
    // `Git` service can be provided; a failed read just falls through to the full CLI.
    // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-21, X4-X6), reason above
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

if (!handledLintFixNoop && !isCheckProbe) {
  const fullCliModule = new URL("./bin-main.js", import.meta.url).href;
  await import(fullCliModule);
}
