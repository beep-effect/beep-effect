#!/usr/bin/env bun

/**
 * Lightweight CLI entry point for the repo command suite.
 *
 * The root `lint --fix` no-op path intentionally stays in this tiny module so
 * clean worktrees do not pay the startup cost of loading the full Effect CLI.
 * So does `gate run check`, every package's generated `check` script: it loads
 * the check gate and the four platform services it needs (measured on a built
 * `@beep/glob`: 323 ms for the whole check against 176 ms for the compiler
 * alone, and against about 1 s more for the full CLI). `quality check-probe`,
 * the probe alone, keeps its own slim path.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

const rawArgv = Bun.argv.slice(2);
let handledLintFixNoop = false;
const isCheckProbe = rawArgv.length === 2 && rawArgv[0] === "quality" && rawArgv[1] === "check-probe";
const isGateRunCheck =
  rawArgv[0] === "gate" &&
  rawArgv[1] === "run" &&
  rawArgv[2] === "check" &&
  (rawArgv.length === 3 || (rawArgv.length === 4 && /^--(agent|human|ci|audience=[a-z]+)$/.test(rawArgv[3] ?? "")));

if (isCheckProbe) {
  const [{ runMain }, BunFileSystem, BunPath, Effect, Layer, { checkPackageReferencesBuilt }] = await Promise.all([
    import("@effect/platform-bun/BunRuntime"),
    import("@effect/platform-bun/BunFileSystem"),
    import("@effect/platform-bun/BunPath"),
    import("effect/Effect"),
    import("effect/Layer"),
    import("./commands/Quality/CheckProbe.ts"),
  ]);
  runMain(
    Layer.merge(BunFileSystem.layer, BunPath.layer).pipe(
      Layer.build,
      Effect.flatMap((context) => Effect.provide(checkPackageReferencesBuilt(process.cwd()), context)),
      Effect.scoped
    )
  );
}

if (isGateRunCheck) {
  const [
    { runMain },
    BunChildProcessSpawner,
    BunFileSystem,
    BunPath,
    BunStdio,
    Effect,
    Layer,
    { runCheckGate },
    { splitAudienceArgs },
  ] = await Promise.all([
    import("@effect/platform-bun/BunRuntime"),
    import("@effect/platform-bun/BunChildProcessSpawner"),
    import("@effect/platform-bun/BunFileSystem"),
    import("@effect/platform-bun/BunPath"),
    import("@effect/platform-bun/BunStdio"),
    import("effect/Effect"),
    import("effect/Layer"),
    import("./commands/Gate/GateCheck.ts"),
    import("./commands/Gate/GateRuntime.ts"),
  ]);
  runMain(
    BunChildProcessSpawner.layer.pipe(
      Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer, BunStdio.layer)),
      Layer.build,
      Effect.flatMap((context) =>
        Effect.provide(runCheckGate(process.cwd(), splitAudienceArgs(rawArgv.slice(3)).flags), context)
      ),
      Effect.scoped
    )
  );
}

if (rawArgv.length === 2 && rawArgv[0] === "lint" && rawArgv[1] === "--fix") {
  const [A, Str] = await Promise.all([import("effect/Array"), import("effect/String")]);
  const CHANGED_PATH_DIFF_FILTER = "ACMRTUXB";
  const runGit = (args: ReadonlyArray<string>) =>
    // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: runs before any Effect runtime exists; a failed read falls through to the full CLI
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

if (!handledLintFixNoop && !isCheckProbe && !isGateRunCheck) {
  const fullCliModule = new URL("./bin-main.js", import.meta.url).href;
  await import(fullCliModule);
}
