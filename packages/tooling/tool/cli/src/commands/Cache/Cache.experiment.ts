/**
 * Disposable local Turbo experiments with bounded captures and no remote credentials.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Duration, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readContainedFileBytesNoFollow, writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCaptured } from "../../internal/process/index.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import {
  decodeCacheExperimentText as decodeText,
  hashCacheExperimentExecutable as hashExecutable,
  readCacheExperimentBytes as readBytes,
} from "./Cache.evidence.ts";
import {
  CacheFixtureRuntime,
  CacheSyntheticCheck,
  CacheSyntheticNonExecution,
  CacheSyntheticReceipt,
  CacheSyntheticRun,
} from "./Cache.experiment.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheCaptureViolation, CacheSyntheticRequest } from "./Cache.experiment.schemas.ts";

// Fixed adversarial data, never an operator credential.
const secretCanary = "QUALIFICATION_SYNTHETIC_SECRET_629a94d2";
const logLimit = 64 * 1024;
const taskId = "@qualification/fixture#qualify";
const taskDirectory = "packages/fixture";
// Only the native summary location is orchestration metadata; task paths remain.
const withoutSummaryLocation = Str.replace(
  /^\s*Summary:\s+\/fixture(?:-other)?\/\.turbo\/runs\/[A-Za-z0-9_-]+\.json\s*$/gm,
  ""
);
const script = `#!/bin/sh
set -eu
mkdir -p out
printf '%s\\n' "$QUALIFY_INPUT" > out/value.txt
cat input.txt >> out/value.txt
bun --version >> out/value.txt
printf 'qualification fixture\\n'
if test -f unsafe.txt; then cat unsafe.txt; fi
if test -f path.txt; then pwd; fi
if test -f overflow.txt; then head -c 131073 /dev/zero | tr '\\000' x; fi
if test -f fail.txt; then exit 7; fi
`;
const wrapper = `#!/bin/sh
umask 022
mkdir -p out
sh task.sh >out/task.log 2>&1
code=$?
cat out/task.log
exit "$code"
`;
const fixtureFiles = {
  "package.json":
    '{"name":"qualification-root","private":true,"packageManager":"bun@1.4.1","workspaces":["packages/*"]}\n',
  "bun.lock":
    '{"lockfileVersion":2,"configVersion":1,"workspaces":{"":{"name":"qualification-root"},"packages/fixture":{"name":"@qualification/fixture","version":"0.0.0"}},"packages":{}}\n',
  "turbo.json":
    '{"globalDependencies":["bun.lock","package.json"],"tasks":{"qualify":{"inputs":["$TURBO_DEFAULT$"],"env":["QUALIFY_INPUT","QUALIFY_BUN_SHA256"],"passThroughEnv":["QUALIFY_ORCHESTRATION"],"outputs":["out/**"]}}}\n',
  "packages/fixture/package.json":
    '{"name":"@qualification/fixture","version":"0.0.0","scripts":{"qualify":"sh fixture.sh"}}\n',
  "packages/fixture/fixture.sh": wrapper,
  "packages/fixture/task.sh": script,
  "packages/fixture/input.txt": "first input\n",
  ".gitignore": "node_modules\n.turbo\nout\n",
};

// Turbo's external summary is decoded at the subprocess boundary. Execution
// facts are selected below; undeclared fields are not treated as evidence.
const Summary = S.Struct({
  tasks: S.Array(
    S.Struct({
      taskId: S.NonEmptyString,
      hash: CacheSyntheticRun.fields.taskHash,
      cache: S.Struct({ status: S.NonEmptyString, local: S.Boolean, remote: S.Boolean }),
      command: S.String,
      execution: S.OptionFromOptionalKey(S.Struct({ exitCode: S.OptionFromOptionalKey(S.Int) })),
    })
  ),
});
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const hashText = (value: string) => hashBytes(new TextEncoder().encode(value));

/**
 * Detect unsafe or incomplete local capture without returning its contents.
 *
 * **Example** (Reject a truncated capture)
 *
 * ```ts
 * import { inspectCacheFixtureCapture } from "@beep/repo-cli/test/Cache"
 * console.assert(inspectCacheFixtureCapture("ok", true).includes("overflow"))
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const inspectCacheFixtureCapture: {
  (truncated: boolean): (text: string) => ReadonlyArray<CacheCaptureViolation>;
  (text: string, truncated: boolean): ReadonlyArray<CacheCaptureViolation>;
} = dual(
  2,
  (text: string, truncated: boolean): ReadonlyArray<CacheCaptureViolation> => [
    ...(truncated || new TextEncoder().encode(text).byteLength > logLimit
      ? A.of<CacheCaptureViolation>("overflow")
      : []),
    ...(Str.includes(secretCanary)(text) ? A.of<CacheCaptureViolation>("synthetic-secret") : []),
    ...(Str.includes("/fixture/")(text) || Str.includes("/fixture-other/")(text)
      ? A.of<CacheCaptureViolation>("absolute-path")
      : []),
  ]
);

/**
 * Compare successful captures only; matching unsafe digests cannot pass.
 *
 * **Example** (Reference the local comparison)
 *
 * ```ts
 * import { equivalentCacheFixtureRuns } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof equivalentCacheFixtureRuns === "function")
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const equivalentCacheFixtureRuns: {
  (right: CacheSyntheticRun): (left: CacheSyntheticRun) => boolean;
  (left: CacheSyntheticRun, right: CacheSyntheticRun): boolean;
} = dual(
  2,
  (left: CacheSyntheticRun, right: CacheSyntheticRun): boolean =>
    left.exitCode === 0 &&
    right.exitCode === 0 &&
    A.isReadonlyArrayEmpty(left.violations) &&
    A.isReadonlyArrayEmpty(right.violations) &&
    left.bunSha256 === right.bunSha256 &&
    left.taskHash === right.taskHash &&
    left.outputSha256 === right.outputSha256 &&
    left.logSha256 === right.logSha256
);

const validateFreshSyntheticVerdict = Effect.fn("CacheExperiment.validateFreshVerdict")(function* (
  task: (typeof Summary.Type)["tasks"][number],
  exitCode: number
) {
  if (
    task.cache.status === "MISS" &&
    O.isNone(
      task.execution.pipe(
        O.flatMap((execution) => execution.exitCode),
        O.filter((code) => (code === 0) === (exitCode === 0))
      )
    )
  )
    return yield* CacheCommandError.new("A fresh fixture run omitted consistent task execution evidence.");
});

const validateSyntheticTask = Effect.fn("CacheExperiment.validateTask")(function* (
  summary: typeof Summary.Type,
  exitCode: number
) {
  if (A.length(summary.tasks) !== 1)
    return yield* CacheCommandError.new("The synthetic fixture must execute exactly one task.");
  const task = O.getOrThrow(A.head(summary.tasks));
  if (
    task.taskId !== taskId ||
    task.command !== "sh fixture.sh" ||
    task.cache.remote ||
    !A.contains(["HIT", "MISS"], task.cache.status)
  )
    return yield* CacheCommandError.new("Unexpected task or remote-cache state in the local fixture.");
  if (task.cache.status === "HIT" && !task.cache.local)
    return yield* CacheCommandError.new("A hit without local artifact evidence cannot count as local replay.");
  yield* validateFreshSyntheticVerdict(task, exitCode);
  return task;
});

const isAbsentScriptObservation = (nonExecution: CacheSyntheticNonExecution) =>
  nonExecution.processExitCode === 0 &&
  nonExecution.executionRecordCount === 0 &&
  !nonExecution.outputPresent &&
  !nonExecution.replayLogPresent &&
  A.isReadonlyArrayEmpty(nonExecution.violations);
const decodeNonEmptyArrayCacheSyntheticRun = S.decodeUnknownEffect(S.NonEmptyArray(CacheSyntheticRun));

const decodeNonEmptyArrayCacheSyntheticCheck = S.decodeUnknownEffect(S.NonEmptyArray(CacheSyntheticCheck));

const runSynthetic = Effect.fn("CacheExperiment.synthetic")(
  function* (root: string, request: CacheSyntheticRequest) {
    if (process.platform !== "linux" || process.arch !== "x64")
      return yield* CacheCommandError.new("The synthetic sandbox currently requires Linux x64.");
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const resolveRuntime = Effect.fn("CacheExperiment.resolveRuntime")(function* (runtime: CacheFixtureRuntime) {
      const executable = yield* fs.realPath(runtime.executable);
      if ((yield* hashExecutable(executable)) !== runtime.pin.sha256)
        return yield* CacheCommandError.new("The requested Bun binary does not match its exact pin.");
      return CacheFixtureRuntime.make({ ...runtime, executable });
    });
    const bun = yield* resolveRuntime(request.bun);
    const alternateBun = yield* resolveRuntime(request.alternateBun);
    if (bun.pin.sha256 === alternateBun.pin.sha256 || bun.pin.version === alternateBun.pin.version)
      return yield* CacheCommandError.new("Runtime perturbation requires two distinct Bun versions and binaries.");
    const resolveClient = Effect.fn("CacheExperiment.resolveClient")(function* () {
      const turboPath = yield* fs.realPath(request.executable);
      const clientDigest = yield* hashExecutable(turboPath);
      if (clientDigest !== request.client.sha256)
        return yield* CacheCommandError.new("The requested Turbo binary does not match its exact pin.");
      if ((request.channel === "canary") !== Str.includes("-canary.")(request.client.version))
        return yield* CacheCommandError.new("The exact Turbo version does not match the selected client channel.");
      return turboPath;
    });
    const turboPath = yield* resolveClient();
    const clientDigest = request.client.sha256;
    const files = {
      ...fixtureFiles,
      "package.json": Str.replace("bun@1.4.1", `bun@${bun.pin.version}`)(fixtureFiles["package.json"]),
    };
    yield* writeContainedFileString(root, ".beep/cache/experiments/owner", "Cache-owned disposable local fixtures.\n");
    const parent = path.join(root, ".beep/cache/experiments");
    const experiment = yield* fs.makeTempDirectoryScoped({ directory: parent, prefix: "synthetic-" });
    const env = {
      PATH: "/tools:/usr/bin",
      HOME: "/tmp",
      TMPDIR: "/tmp",
      XDG_CACHE_HOME: "/tmp",
      LANG: "C",
      LC_ALL: "C",
      CI: "1",
      NO_COLOR: "1",
      TURBO_TELEMETRY_DISABLED: "1",
      DO_NOT_TRACK: "1",
      QUALIFY_INPUT: "semantic-a",
      QUALIFY_ORCHESTRATION: "orchestration-a",
    };
    const sandbox = Effect.fn("CacheExperiment.sandbox")(function* (
      fixture: string,
      guest: string,
      args: ReadonlyArray<string>,
      semantic = "semantic-a",
      orchestration = "orchestration-a",
      runtime: CacheFixtureRuntime = bun
    ) {
      return yield* runCaptured({
        command: "/usr/bin/bwrap",
        args: [
          "--unshare-all",
          "--die-with-parent",
          "--new-session",
          "--ro-bind",
          "/usr",
          "/usr",
          "--symlink",
          "usr/lib",
          "/lib",
          "--symlink",
          "usr/lib",
          "/lib64",
          "--proc",
          "/proc",
          "--dev",
          "/dev",
          "--tmpfs",
          "/tmp",
          "--dir",
          "/tools",
          "--ro-bind",
          runtime.executable,
          "/tools/bun",
          "--ro-bind",
          turboPath,
          "/tools/turbo",
          "--bind",
          fixture,
          guest,
          "--chdir",
          guest,
          "--",
          ...args,
        ],
        cwd: root,
        env: {
          ...env,
          QUALIFY_INPUT: semantic,
          QUALIFY_ORCHESTRATION: orchestration,
          QUALIFY_BUN_SHA256: runtime.pin.sha256,
        },
        extendEnv: false,
        source: "all",
        timeout: Duration.seconds(30),
        bound: OutputBound.make({ maxChars: logLimit, truncatedNotice: "[capture overflow]" }),
      });
    });
    const prepare = Effect.fn("CacheExperiment.prepare")(function* (name: string) {
      const fixture = path.join(experiment, name);
      yield* fs.makeDirectory(fixture);
      for (const [relative, contents] of R.toEntries(files)) {
        yield* writeContainedFileString(fixture, relative, contents);
      }
      return fixture;
    });
    const firstRoot = yield* prepare("fresh-a");
    const secondRoot = yield* prepare("fresh-b");
    const verifySandboxVersions = Effect.fn("CacheExperiment.verifySandboxVersions")(function* () {
      const turboVersion = yield* sandbox(firstRoot, "/fixture", ["/tools/turbo", "--version"]);
      if (
        turboVersion.exitCode !== 0 ||
        turboVersion.truncated ||
        Str.trim(turboVersion.output) !== request.client.version
      )
        return yield* CacheCommandError.new(
          "Sandbox client version differs from its exact pin or sandbox setup failed."
        );
      for (const runtime of [bun, alternateBun]) {
        const version = yield* sandbox(
          firstRoot,
          "/fixture",
          ["/tools/bun", "--version"],
          "semantic-a",
          "orchestration-a",
          runtime
        );
        if (version.exitCode !== 0 || version.truncated || Str.trim(version.output) !== runtime.pin.version)
          return yield* CacheCommandError.new("The observed sandbox Bun version differs from its exact pin.");
      }
    });
    yield* verifySandboxVersions();
    const invoke = Effect.fn("CacheExperiment.invoke")(function* (
      fixture: string,
      guest: string,
      cache: "local:" | "local:rw",
      semantic = "semantic-a",
      orchestration = "orchestration-a",
      runtime: CacheFixtureRuntime = bun
    ) {
      yield* fs.remove(path.join(fixture, ".turbo/runs"), { recursive: true, force: true });
      yield* fs.remove(path.join(fixture, taskDirectory, "out"), { recursive: true, force: true });
      yield* fs.remove(path.join(fixture, taskDirectory, ".turbo"), { recursive: true, force: true });
      const captured = yield* sandbox(
        fixture,
        guest,
        [
          "/tools/turbo",
          "run",
          "qualify",
          "--filter=@qualification/fixture",
          "--no-daemon",
          `--cache=${cache}`,
          "--env-mode=strict",
          "--summarize",
          "--output-logs=full",
          "--log-prefix=none",
        ],
        semantic,
        orchestration,
        runtime
      );
      const summaries = yield* fs.readDirectory(path.join(fixture, ".turbo/runs"));
      if (A.length(summaries) !== 1)
        return yield* CacheCommandError.new("The fixture did not produce exactly one bounded Turbo summary.");
      const summaryBytes = yield* readBytes(fixture, `.turbo/runs/${O.getOrThrow(A.head(summaries))}`, 1024 * 1024);
      const summary = yield* decodeText(summaryBytes).pipe(Effect.flatMap(JsonStringCodec(Summary).decode));
      return { captured, summary, summaryBytes };
    });
    const execute = Effect.fn("CacheExperiment.execute")(function* (
      fixture: string,
      guest: string,
      id: string,
      cache: "local:" | "local:rw",
      semantic = "semantic-a",
      orchestration = "orchestration-a",
      runtime: CacheFixtureRuntime = bun
    ) {
      const { captured, summary } = yield* invoke(fixture, guest, cache, semantic, orchestration, runtime);
      const task = yield* validateSyntheticTask(summary, captured.exitCode);
      const output = yield* readBytes(fixture, `${taskDirectory}/out/value.txt`, 4096);
      const outputNames = yield* fs.readDirectory(path.join(fixture, taskDirectory, "out"));
      if (A.length(outputNames) !== 2 || !A.contains(outputNames, "value.txt") || !A.contains(outputNames, "task.log"))
        return yield* CacheCommandError.new("The fixture output tree differs from its two declared files.");
      // The fixture wrapper records its task stream even with caching disabled;
      // Turbo writes its own replay log only when caching is enabled.
      const taskLog = yield* readBytes(fixture, `${taskDirectory}/out/task.log`, logLimit * 4);
      const text = yield* decodeText(taskLog);
      const replayLog = yield* readContainedFileBytesNoFollow(
        fixture,
        `${taskDirectory}/.turbo/turbo-qualify.log`,
        NonNegativeInt.make(logLimit * 4)
      );
      const replayText = yield* O.match(replayLog.contents, {
        onNone: () => Effect.succeed(""),
        onSome: decodeText,
      });
      if (cache === "local:rw" && captured.exitCode === 0 && O.isNone(replayLog.contents))
        return yield* CacheCommandError.new("A successful cache-enabled run omitted its replay log.");
      // Only Turbo's summary-location line is orchestration metadata. All task
      // diagnostics, including absolute paths in those diagnostics, remain.
      const orchestrationLog = withoutSummaryLocation(captured.output);
      const violations = A.dedupe([
        ...inspectCacheFixtureCapture(orchestrationLog, captured.truncated),
        ...inspectCacheFixtureCapture(text, taskLog.byteLength > logLimit),
        ...inspectCacheFixtureCapture(replayText, false),
      ]);
      const treeMode = (yield* fs.stat(path.join(fixture, taskDirectory, "out"))).mode & 0o777;
      const valueMode = (yield* fs.stat(path.join(fixture, taskDirectory, "out/value.txt"))).mode & 0o777;
      const logMode = (yield* fs.stat(path.join(fixture, taskDirectory, "out/task.log"))).mode & 0o777;
      // This fixture has a fixed, checked tree. Bind its paths and permission
      // bits as well as bytes; an artifact chmod cannot pass by content alone.
      const tree = `cache-fixture-tree/v1\0out\0${treeMode}\0out/value.txt\0${valueMode}\0${yield* hashBytes(output)}\0out/task.log\0${logMode}\0${yield* hashBytes(taskLog)}`;
      return CacheSyntheticRun.make({
        id,
        root: path.basename(fixture),
        bunSha256: runtime.pin.sha256,
        taskHash: task.hash,
        origin: task.cache.status === "HIT" ? "local-hit" : "fresh",
        exitCode: captured.exitCode,
        outputSha256: yield* hashText(tree),
        logSha256: yield* hashText(text),
        logBytes: NonNegativeInt.make(taskLog.byteLength),
        violations,
      });
    });
    const runs: Array<CacheSyntheticRun> = [];
    const checks: Array<CacheSyntheticCheck> = [];
    const record = (name: string, passed: boolean) => checks.push(CacheSyntheticCheck.make({ name, passed }));
    const first = yield* execute(firstRoot, "/fixture", "fresh-a", "local:");
    runs.push(first);
    const second = yield* execute(secondRoot, "/fixture-other", "fresh-b", "local:");
    runs.push(second);
    record(
      "isolated-fresh-fresh-and-cross-root",
      equivalentCacheFixtureRuns(first, second) && first.origin === "fresh" && second.origin === "fresh"
    );
    const runIsolatedPairs = Effect.fn("CacheExperiment.runIsolatedPairs")(function* () {
      for (const pair of [2, 3]) {
        const leftRoot = yield* prepare(`fresh-pair-${pair}-a`);
        const rightRoot = yield* prepare(`fresh-pair-${pair}-b`);
        const left = yield* execute(leftRoot, "/fixture", `fresh-pair-${pair}-a`, "local:");
        const right = yield* execute(rightRoot, "/fixture-other", `fresh-pair-${pair}-b`, "local:");
        runs.push(left, right);
        record(
          `isolated-fresh-fresh-pair-${pair}`,
          left.origin === "fresh" &&
            right.origin === "fresh" &&
            equivalentCacheFixtureRuns(left, right) &&
            equivalentCacheFixtureRuns(first, left)
        );
      }
    });
    yield* runIsolatedPairs();
    const observeLocalReuse = Effect.fn("CacheExperiment.observeLocalReuse")(function* () {
      const producer = yield* execute(firstRoot, "/fixture", "local-producer", "local:rw");
      runs.push(producer);
      const replay = yield* execute(firstRoot, "/fixture", "local-replay", "local:rw");
      runs.push(replay);
      record(
        "local-restoration",
        producer.origin === "fresh" && replay.origin === "local-hit" && equivalentCacheFixtureRuns(producer, replay)
      );
      const orchestration = yield* execute(
        firstRoot,
        "/fixture",
        "orchestration",
        "local:rw",
        "semantic-a",
        "orchestration-b"
      );
      runs.push(orchestration);
      record(
        "orchestration-invariance",
        orchestration.origin === "local-hit" && equivalentCacheFixtureRuns(producer, orchestration)
      );
      const orchestrationFresh = yield* execute(
        firstRoot,
        "/fixture",
        "orchestration-fresh",
        "local:",
        "semantic-a",
        "orchestration-b"
      );
      runs.push(orchestrationFresh);
      record(
        "orchestration-fresh-invariance",
        orchestrationFresh.origin === "fresh" && equivalentCacheFixtureRuns(first, orchestrationFresh)
      );
      return producer;
    });
    const producer = yield* observeLocalReuse();
    const runSemanticControls = Effect.fn("CacheExperiment.runSemanticControls")(function* () {
      const semantic = yield* execute(firstRoot, "/fixture", "semantic-env", "local:rw", "semantic-b");
      runs.push(semantic);
      record(
        "semantic-env-invalidation",
        equivalentCacheFixtureRuns(semantic, semantic) &&
          semantic.origin === "fresh" &&
          semantic.taskHash !== producer.taskHash &&
          semantic.outputSha256 !== producer.outputSha256
      );
      yield* writeContainedFileString(firstRoot, `${taskDirectory}/input.txt`, "second input\n");
      const file = yield* execute(firstRoot, "/fixture", "semantic-file", "local:rw");
      runs.push(file);
      record(
        "semantic-file-invalidation",
        equivalentCacheFixtureRuns(file, file) &&
          file.origin === "fresh" &&
          file.taskHash !== producer.taskHash &&
          file.outputSha256 !== producer.outputSha256
      );
      const runConfigurationControls = Effect.fn("CacheExperiment.runConfigurationControls")(function* () {
        yield* writeContainedFileString(
          firstRoot,
          "turbo.json",
          Str.replace('"out/**"', '"out/**","root-extra/**"')(fixtureFiles["turbo.json"])
        );
        const rootConfig = yield* execute(firstRoot, "/fixture", "root-configuration", "local:rw");
        runs.push(rootConfig);
        record(
          "root-configuration-invalidation",
          equivalentCacheFixtureRuns(rootConfig, rootConfig) &&
            rootConfig.origin === "fresh" &&
            rootConfig.taskHash !== file.taskHash
        );
        yield* writeContainedFileString(
          firstRoot,
          `${taskDirectory}/turbo.json`,
          '{"extends":["//"],"tasks":{"qualify":{"outputs":["out/**","child-extra/**"]}}}\n'
        );
        const childConfig = yield* execute(firstRoot, "/fixture", "child-configuration", "local:rw");
        runs.push(childConfig);
        record(
          "child-configuration-invalidation",
          equivalentCacheFixtureRuns(childConfig, childConfig) &&
            childConfig.origin === "fresh" &&
            childConfig.taskHash !== rootConfig.taskHash
        );
      });
      yield* runConfigurationControls();
    });
    yield* runSemanticControls();
    const runMetadataControls = Effect.fn("CacheExperiment.runMetadataControls")(function* () {
      // Each metadata perturbation starts from its own baseline and local cache.
      // These bytes are declared global inputs; the fixture does not pretend that
      // an unused lockfile or package-manager declaration always changes Turbo's key.
      for (const [name, relative, contents] of [
        ["lockfile", "bun.lock", `${files["bun.lock"]}\n`],
        [
          "package-manager",
          "package.json",
          Str.replace(`bun@${bun.pin.version}`, `bun@${alternateBun.pin.version}`)(files["package.json"]),
        ],
      ]) {
        const fixture = yield* prepare(name);
        const before = yield* execute(fixture, "/fixture", `${name}-before`, "local:rw");
        yield* writeContainedFileString(fixture, relative, contents);
        const after = yield* execute(fixture, "/fixture", `${name}-after`, "local:rw");
        runs.push(before, after);
        record(
          `${name}-invalidation`,
          before.origin === "fresh" &&
            after.origin === "fresh" &&
            equivalentCacheFixtureRuns(before, before) &&
            equivalentCacheFixtureRuns(after, after) &&
            before.taskHash !== after.taskHash &&
            before.outputSha256 === after.outputSha256 &&
            before.logSha256 === after.logSha256
        );
      }
    });
    yield* runMetadataControls();
    const runRuntimeControl = Effect.fn("CacheExperiment.runRuntimeControl")(function* () {
      const runtimeRoot = yield* prepare("runtime");
      const runtimeBefore = yield* execute(runtimeRoot, "/fixture", "runtime-before", "local:rw");
      const runtimeAfter = yield* execute(
        runtimeRoot,
        "/fixture",
        "runtime-after",
        "local:rw",
        "semantic-a",
        "orchestration-a",
        alternateBun
      );
      runs.push(runtimeBefore, runtimeAfter);
      record(
        "actual-runtime-invalidation",
        runtimeBefore.origin === "fresh" &&
          runtimeAfter.origin === "fresh" &&
          equivalentCacheFixtureRuns(runtimeBefore, runtimeBefore) &&
          equivalentCacheFixtureRuns(runtimeAfter, runtimeAfter) &&
          runtimeBefore.bunSha256 !== runtimeAfter.bunSha256 &&
          runtimeBefore.taskHash !== runtimeAfter.taskHash &&
          runtimeBefore.outputSha256 !== runtimeAfter.outputSha256 &&
          runtimeBefore.logSha256 === runtimeAfter.logSha256
      );
    });
    yield* runRuntimeControl();
    // Normal cache-disabled execution is the authority for each local decision.
    // Producer and replay are additional observations, never the authority itself.
    const shadow = Effect.fn("CacheExperiment.localShadow")(function* (
      name: string,
      mutations: Readonly<Record<string, string>> = {},
      semantic = "semantic-a",
      orchestration = "orchestration-a",
      runtime: CacheFixtureRuntime = bun
    ) {
      const fixture = yield* prepare(`shadow-${name}`);
      for (const [relative, contents] of R.toEntries(mutations))
        yield* writeContainedFileString(fixture, relative, contents);
      const fresh = yield* execute(
        fixture,
        "/fixture",
        `shadow-${name}-authority`,
        "local:",
        semantic,
        orchestration,
        runtime
      );
      const producer = yield* execute(
        fixture,
        "/fixture",
        `shadow-${name}-producer`,
        "local:rw",
        semantic,
        orchestration,
        runtime
      );
      const hit = yield* execute(
        fixture,
        "/fixture",
        `shadow-${name}-replay`,
        "local:rw",
        semantic,
        orchestration,
        runtime
      );
      runs.push(fresh, producer, hit);
      record(
        `local-shadow-${name}`,
        fresh.origin === "fresh" &&
          producer.origin === "fresh" &&
          hit.origin === "local-hit" &&
          equivalentCacheFixtureRuns(fresh, producer) &&
          equivalentCacheFixtureRuns(fresh, hit)
      );
    });
    yield* shadow("baseline");
    yield* shadow("semantic-env", {}, "semantic-b");
    yield* shadow("empty-semantic-env", {}, "");
    yield* shadow("empty-input", { [`${taskDirectory}/input.txt`]: "" });
    yield* shadow("unicode-input", { [`${taskDirectory}/input.txt`]: "café λ\n" });
    yield* shadow("root-config", {
      "turbo.json": Str.replace('"out/**"', '"out/**","root-extra/**"')(files["turbo.json"]),
    });
    yield* shadow("child-config", {
      [`${taskDirectory}/turbo.json`]:
        '{"extends":["//"],"tasks":{"qualify":{"outputs":["out/**","child-extra/**"]}}}\n',
    });
    yield* shadow("lockfile", { "bun.lock": `${files["bun.lock"]}\n` });
    yield* shadow("package-manager", {
      "package.json": Str.replace(`bun@${bun.pin.version}`, `bun@${alternateBun.pin.version}`)(files["package.json"]),
    });
    yield* shadow("orchestration", {}, "semantic-a", "orchestration-b");
    yield* shadow("alternate-runtime", {}, "semantic-a", "orchestration-a", alternateBun);
    const concurrentRoots = yield* Effect.all([prepare("concurrent-a"), prepare("concurrent-b")], { concurrency: 2 });
    const concurrent = yield* Effect.forEach(
      concurrentRoots,
      (fixture) => execute(fixture, "/fixture", path.basename(fixture), "local:"),
      { concurrency: 2 }
    );
    runs.push(...concurrent);
    record(
      "concurrent-isolated-fresh",
      A.every(concurrent, (run) => run.origin === "fresh" && equivalentCacheFixtureRuns(first, run))
    );
    const runCaptureAndFailureControls = Effect.fn("CacheExperiment.runCaptureAndFailureControls")(function* () {
      const negativeRoot = yield* prepare("negative");
      for (const [filename, { name, contents, violation }] of R.toEntries({
        "unsafe.txt": { name: "unsafe-log", contents: secretCanary, violation: "synthetic-secret" },
        "path.txt": { name: "absolute-path", contents: "probe", violation: "absolute-path" },
        "overflow.txt": { name: "capture-overflow", contents: "probe", violation: "overflow" },
      })) {
        yield* writeContainedFileString(negativeRoot, `${taskDirectory}/${filename}`, contents);
        const run = yield* execute(negativeRoot, "/fixture", name, "local:");
        runs.push(run);
        record(name, A.some(run.violations, (actual) => actual === violation) && !equivalentCacheFixtureRuns(run, run));
        yield* fs.remove(path.join(negativeRoot, taskDirectory, filename));
      }
      yield* writeContainedFileString(negativeRoot, `${taskDirectory}/fail.txt`, "probe");
      const failed = yield* execute(negativeRoot, "/fixture", "failed-task", "local:rw");
      runs.push(failed);
      const failedAgain = yield* execute(negativeRoot, "/fixture", "failed-task-repeat", "local:rw");
      runs.push(failedAgain);
      record(
        "failed-task-is-not-reused",
        failed.exitCode !== 0 &&
          failedAgain.exitCode !== 0 &&
          failedAgain.origin === "fresh" &&
          !equivalentCacheFixtureRuns(failed, failedAgain)
      );
    });
    yield* runCaptureAndFailureControls();
    const observeAbsentScript = Effect.fn("CacheExperiment.observeAbsentScript")(function* () {
      const absentRoot = yield* prepare("absent-script");
      yield* writeContainedFileString(
        absentRoot,
        `${taskDirectory}/package.json`,
        '{"name":"@qualification/fixture","version":"0.0.0","scripts":{}}\n'
      );
      const absent = yield* invoke(absentRoot, "/fixture", "local:");
      const selected = A.filter(absent.summary.tasks, (task) => task.taskId === taskId);
      const nonExecution = CacheSyntheticNonExecution.make({
        id: "absent-script",
        processExitCode: absent.captured.exitCode,
        summaryTaskCount: NonNegativeInt.make(A.length(absent.summary.tasks)),
        selectedTaskCount: NonNegativeInt.make(A.length(selected)),
        executionRecordCount: NonNegativeInt.make(
          A.length(A.filter(absent.summary.tasks, (task) => O.isSome(task.execution)))
        ),
        commands: A.map(selected, (task) => task.command),
        outputPresent: yield* fs.exists(path.join(absentRoot, taskDirectory, "out")),
        replayLogPresent: yield* fs.exists(path.join(absentRoot, taskDirectory, ".turbo/turbo-qualify.log")),
        summarySha256: yield* hashBytes(absent.summaryBytes),
        processCaptureSha256: yield* hashText(absent.captured.output),
        violations: inspectCacheFixtureCapture(
          withoutSummaryLocation(absent.captured.output),
          absent.captured.truncated
        ),
      });
      return nonExecution;
    });
    const nonExecution = yield* observeAbsentScript();
    record("absent-script-is-not-execution", isAbsentScriptObservation(nonExecution));
    const verifyFinalPins = Effect.fn("CacheExperiment.verifyFinalPins")(function* () {
      const stillPinned = yield* hashExecutable(turboPath);
      if (stillPinned !== clientDigest)
        return yield* CacheCommandError.new("The client changed during the experiment.");
      for (const runtime of [bun, alternateBun]) {
        if ((yield* hashExecutable(runtime.executable)) !== runtime.pin.sha256)
          return yield* CacheCommandError.new("A Bun runtime changed during the experiment.");
      }
    });
    yield* verifyFinalPins();
    const fixtureText = yield* JsonStringCodec(S.Record(S.String, S.String)).encode(files);
    return CacheSyntheticReceipt.make({
      channel: request.channel,
      client: request.client,
      bun: bun.pin,
      alternateBun: alternateBun.pin,
      fixtureSha256: yield* hashText(fixtureText),
      runs: yield* decodeNonEmptyArrayCacheSyntheticRun(runs),
      nonExecutions: [nonExecution],
      checks: yield* decodeNonEmptyArrayCacheSyntheticCheck(checks),
    });
  },
  Effect.scoped,
  CacheCommandError.mapError("Cannot complete the bounded local cache experiment.")
);

/**
 * Exercise experiment orchestration with a supplied process service.
 *
 * **Example** (Reference the process-boundary test entrypoint)
 *
 * ```ts
 * import { runCacheSyntheticForTesting } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof runCacheSyntheticForTesting === "function")
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const runCacheSyntheticForTesting = runSynthetic;

/**
 * Run the local synthetic matrix under the existing one-token admission lane.
 *
 * **Details**
 * Fixture directories are exclusively allocated and removed on exit. No
 * dependency install, remote-cache connection, or qualification transition runs.
 * Linux sandbox setup and exact native client/Bun pins fail closed.
 *
 * **Example** (Reference the admitted experiment)
 *
 * ```ts
 * import { runCacheSyntheticExperiment } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheSyntheticExperiment === "function")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const runCacheSyntheticExperiment = Effect.fn("Cache.runSyntheticExperiment")(function* (
  root: string,
  request: CacheSyntheticRequest
) {
  return yield* withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: 1,
      priority: "verify",
      originKey: "",
      checkoutRoot: root,
      branch: "",
      command: "bun run beep cache synthetic",
    }),
    noAdmissionOriginGate,
    runSynthetic(root, request)
  );
}, CacheCommandError.mapError("Local cache experiment admission or execution failed."));
