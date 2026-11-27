/**
 * Test Unit timing projection (`beep ci unit-timings`, MEAS-06).
 *
 * **Details**
 *
 * Reads the Vitest JSON reports a Test Unit partition wrote under each
 * workspace's `coverage/` directory and the partition's sealed coverage
 * manifest when it exists, and writes one `unit-timings/v1` projection. The
 * hosted shard runs it on every event after its tests, so pushes and pull
 * requests both leave timings, where the raw reports are uploaded only when
 * the tests fail. {@link unitTimingCensus} folds projections by event and
 * checks each package's executed files against its selection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { writeArtifact } from "@beep/repo-cli-kit/artifacts/ArtifactIo";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CoverageProducerManifest, CoverageProducerPackage } from "../Quality/internal/CoverageArtifacts.schemas.ts";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import {
  UnitTimingEventCensus,
  UnitTimingFile,
  UnitTimingOutcome,
  UnitTimingPackage,
  UnitTimingProjection,
  UnitTimingShard,
} from "./CiUnitTimings.schemas.ts";

const $I = $RepoCliId.create("commands/Ci/CiUnitTimings");

const REPORT_FILE = "unit-results.json";
const INVOCATION_PREFIX = "invocation-";
const isInvocationDir = S.is(S.String.check(S.isPattern(/^invocation-\d+$/u)));

const VitestFileResult = S.Struct({
  name: S.NonEmptyString,
  status: S.NonEmptyString,
  startTime: S.Finite,
  endTime: S.Finite,
  assertionResults: S.Array(S.Unknown),
}).pipe(
  $I.annoteSchema("VitestFileResult", {
    description: "One test file of a Vitest JSON report, as the projection reads it.",
  })
);
const VitestReport = S.Struct({ success: S.Boolean, testResults: S.Array(VitestFileResult) }).pipe(
  $I.annoteSchema("VitestReport", { description: "The Vitest JSON report fields the projection reads." })
);
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(VitestReport));
// The manifest fields the projection reads, picked from the producer's own schema so a renamed field fails here.
const ManifestSelection = CoverageProducerPackage.mapFields((fields) => ({
  packageName: fields.packageName,
  packagePath: fields.packagePath,
  expectedTestFiles: fields.expectedTestFiles,
  testReportPath: fields.testReportPath,
  invocationId: fields.invocationId,
  shard: fields.shard,
}));
const ManifestView = S.Struct({
  schemaVersion: CoverageProducerManifest.fields.schemaVersion,
  identity: S.Struct({ runId: S.NonEmptyString, runAttempt: S.Int }),
  packages: S.Array(S.Struct({ selection: ManifestSelection })),
}).pipe(
  $I.annoteSchema("ManifestView", {
    description: "The coverage-producer/v1 manifest fields the timing projection reads.",
  })
);
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(ManifestView));
const ProjectionJson = S.fromJsonString(UnitTimingProjection);
const encodeProjection = S.encodeEffect(ProjectionJson);

/**
 * **Details**
 *
 * `writtenSince` is epoch seconds, the job's setup start: a report last
 * written before it was left by an earlier attempt in a kept workspace and is
 * not read. A file system that records no modification time keeps every
 * report. A manifest stamped with another `runId` or `runAttempt` selects
 * nothing.
 *
 * **Example** (Project a local partition)
 *
 * ```ts
 * import { UnitTimingOptions } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const options = UnitTimingOptions.make({
 *   partition: "unit-a",
 *   coverageOutput: ".beep/ci-coverage/unit-a",
 *   event: "local",
 *   runId: O.none(),
 *   runAttempt: O.none(),
 *   sha: O.none(),
 * })
 * console.log(options.partition) // "unit-a"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitTimingOptions extends S.Opaque<UnitTimingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    partition: S.NonEmptyString,
    coverageOutput: S.NonEmptyString,
    event: S.NonEmptyString,
    runId: S.Option(S.Int),
    runAttempt: S.Option(S.Int),
    sha: S.Option(S.NonEmptyString),
    writtenSince: S.Option(S.Int).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("UnitTimingOptions", {
      description: "The partition, its coverage output directory and the run identity a projection is stamped with.",
    })
  )
) {}

type ReportLocation = {
  readonly packageName: string;
  readonly packagePath: string;
  readonly invocationId: string;
  readonly reportPath: string;
};

type Selection = {
  readonly expected: number;
  readonly shard: O.Option<UnitTimingShard>;
  readonly location: ReportLocation;
};

const byReportPath = Order.mapInput(Order.String, (row: UnitTimingPackage) => row.reportPath);
const byFilePath = Order.mapInput(Order.String, (row: UnitTimingFile) => row.path);

const workspaceReports = Effect.fnUntraced(function* (
  repoRoot: string,
  packageName: string,
  dir: string,
  writtenSince: O.Option<number>
): Effect.fn.Return<ReadonlyArray<ReportLocation>, CiCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packagePath = path.relative(repoRoot, dir);
  const coverage = path.join(dir, "coverage");
  const exists = (file: string) =>
    fs.exists(file).pipe(CiCommandError.mapError(`Failed to stat ${path.relative(repoRoot, file)}.`));
  if (!(yield* exists(coverage))) {
    return A.empty();
  }
  const entries = yield* fs
    .readDirectory(coverage)
    .pipe(CiCommandError.mapError(`Failed to list ${path.relative(repoRoot, coverage)}.`));
  const candidates = A.appendAll(
    [{ invocationId: "0", file: path.join(coverage, REPORT_FILE) }],
    A.map(A.filter(A.sort(entries, Order.String), isInvocationDir), (entry) => ({
      invocationId: Str.slice(INVOCATION_PREFIX.length)(entry),
      file: path.join(coverage, entry, REPORT_FILE),
    }))
  );
  const writtenThisAttempt = Effect.fnUntraced(function* (file: string) {
    if (!(yield* exists(file))) {
      return false;
    }
    const info = yield* fs.stat(file).pipe(CiCommandError.mapError(`Failed to stat ${path.relative(repoRoot, file)}.`));
    return O.match(writtenSince, {
      onNone: () => true,
      onSome: (since) => !O.exists(info.mtime, (mtime) => mtime.getTime() < since * 1000),
    });
  });
  const present = yield* Effect.filter(candidates, (candidate) => writtenThisAttempt(candidate.file), {
    concurrency: 1,
  });
  return A.map(present, (candidate) => ({
    packageName,
    packagePath,
    invocationId: candidate.invocationId,
    reportPath: path.relative(repoRoot, candidate.file),
  }));
});

const fileRow = (repoRoot: string, path: Path.Path, result: typeof VitestFileResult.Type) =>
  UnitTimingFile.make({
    path: path.relative(repoRoot, path.resolve(repoRoot, result.name)),
    status: result.status,
    durationMs: Math.max(0, result.endTime - result.startTime),
    tests: A.length(result.assertionResults),
  });

const rowBase = (location: ReportLocation, selection: O.Option<Selection>) => ({
  ...location,
  expectedTestFiles: O.map(selection, (entry) => entry.expected),
  shard: O.flatMap(selection, (entry) => entry.shard),
});

const missingRow = (location: ReportLocation, selection: O.Option<Selection>) =>
  UnitTimingPackage.make({
    ...rowBase(location, selection),
    outcome: UnitTimingOutcome.Enum.missing,
    wallMs: 0,
    fileMs: 0,
    executedTestFiles: 0,
    files: [],
  });

const packageRow = Effect.fnUntraced(function* (
  repoRoot: string,
  location: ReportLocation,
  selection: O.Option<Selection>
): Effect.fn.Return<UnitTimingPackage, CiCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const base = rowBase(location, selection);
  const absolute = path.join(repoRoot, location.reportPath);
  const text = yield* fs
    .readFileString(absolute)
    .pipe(CiCommandError.mapError(`Failed to read ${location.reportPath}.`));
  return yield* decodeReport(text).pipe(
    Effect.map((report) => {
      const files = A.sort(
        A.map(report.testResults, (result) => fileRow(repoRoot, path, result)),
        byFilePath
      );
      const starts = A.map(report.testResults, (result) => result.startTime);
      const ends = A.map(report.testResults, (result) => result.endTime);
      const wallMs = pipe(
        A.match(starts, {
          onEmpty: () => 0,
          onNonEmpty: (nonEmpty) => Math.max(...ends) - Math.min(...nonEmpty),
        }),
        (value) => Math.max(0, value)
      );
      return UnitTimingPackage.make({
        ...base,
        outcome: report.success ? UnitTimingOutcome.Enum.passed : UnitTimingOutcome.Enum.failed,
        wallMs,
        fileMs: A.reduce(files, 0, (total, file) => total + file.durationMs),
        executedTestFiles: A.length(files),
        files,
      });
    }),
    Effect.orElseSucceed(() =>
      UnitTimingPackage.make({
        ...base,
        outcome: UnitTimingOutcome.Enum.unreadable,
        wallMs: 0,
        fileMs: 0,
        executedTestFiles: 0,
        files: [],
      })
    )
  );
});

const isOtherAttempt = (identity: (typeof ManifestView.Type)["identity"], options: UnitTimingOptions): boolean =>
  O.exists(options.runId, (runId) => identity.runId !== `${runId}`) ||
  O.exists(options.runAttempt, (attempt) => identity.runAttempt !== attempt);

const manifestSelections = Effect.fnUntraced(function* (
  repoRoot: string,
  options: UnitTimingOptions
): Effect.fn.Return<O.Option<HashMap.HashMap<string, Selection>>, CiCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(path.resolve(repoRoot, options.coverageOutput), "manifest.json");
  if (!(yield* fs.exists(manifestPath).pipe(CiCommandError.mapError("Failed to stat the coverage manifest.")))) {
    return O.none();
  }
  const text = yield* fs
    .readFileString(manifestPath)
    .pipe(CiCommandError.mapError("Failed to read the coverage manifest."));
  const manifest = yield* decodeManifest(text).pipe(
    CiCommandError.mapError(`${path.relative(repoRoot, manifestPath)} is not a coverage-producer/v1 manifest.`)
  );
  if (isOtherAttempt(manifest.identity, options)) {
    return O.none();
  }
  return O.some(
    HashMap.fromIterable(
      A.map(manifest.packages, (entry): readonly [string, Selection] => {
        const reportPath = path.join(entry.selection.packagePath, entry.selection.testReportPath);
        return [
          reportPath,
          {
            expected: A.length(entry.selection.expectedTestFiles),
            shard: O.map(O.fromUndefinedOr(entry.selection.shard), (shard) =>
              UnitTimingShard.make({ index: shard.index, total: shard.total })
            ),
            location: {
              packageName: entry.selection.packageName,
              packagePath: entry.selection.packagePath,
              invocationId: entry.selection.invocationId,
              reportPath,
            },
          },
        ];
      })
    )
  );
});

/**
 * Project one partition's Vitest reports into a `unit-timings/v1` row set.
 *
 * **Details**
 *
 * Each workspace's reports are `coverage/unit-results.json` (invocation 0)
 * and `coverage/invocation-<n>/unit-results.json`. Every workspace's report is
 * a row, so a red shard still reports the packages it executed. When the
 * partition's coverage manifest exists, each row it names carries
 * `expectedTestFiles`, and an invocation it names whose report is gone or
 * older than `writtenSince` is a `missing` row. A report that does not decode
 * is an `unreadable` row; only a file-system or manifest failure fails the
 * effect.
 *
 * **Example** (Inspect the projection effect)
 *
 * ```ts
 * import { projectUnitTimings } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof projectUnitTimings) // "function"
 * ```
 *
 * @param repoRoot - The checkout the partition ran in.
 * @param options - The partition, its coverage output and the run identity.
 * @returns The projection, with rows sorted by report path.
 * @category use-cases
 * @since 0.0.0
 */
export const projectUnitTimings = Effect.fn("CiUnitTimings.project")(function* (
  repoRoot: string,
  options: UnitTimingOptions
): Effect.fn.Return<UnitTimingProjection, CiCommandError, FileSystem.FileSystem | Path.Path> {
  const workspaces = yield* workspaceManifests(repoRoot).pipe(
    CiCommandError.mapError("Failed to read the workspace manifests.")
  );
  const located = yield* Effect.forEach(
    A.sort(
      HashMap.toEntries(workspaces),
      Order.mapInput(Order.String, ([name]: readonly [string, unknown]) => name)
    ),
    ([name, workspace]) => workspaceReports(repoRoot, name, workspace.dir, options.writtenSince),
    { concurrency: 8 }
  ).pipe(Effect.map(A.flatten));
  const selections = yield* manifestSelections(repoRoot, options);
  const selected = O.getOrElse(selections, HashMap.empty<string, Selection>);
  const onDisk = HashMap.fromIterable(A.map(located, (location) => [location.reportPath, location] as const));
  const unreported = A.filter(HashMap.toValues(selected), (entry) => !HashMap.has(onDisk, entry.location.reportPath));
  const read = yield* Effect.forEach(
    located,
    (location) => packageRow(repoRoot, location, HashMap.get(selected, location.reportPath)),
    { concurrency: 8 }
  );
  const packages = A.appendAll(
    read,
    A.map(unreported, (entry) => missingRow(entry.location, O.some(entry)))
  );
  return UnitTimingProjection.make({
    schemaVersion: "unit-timings/v1",
    partition: options.partition,
    event: options.event,
    runId: options.runId,
    runAttempt: options.runAttempt,
    sha: options.sha,
    sealed: O.isSome(selections),
    packages: A.sort(packages, byReportPath),
  });
});

type CensusGroup = {
  readonly executed: number;
  readonly expected: O.Option<number>;
};

const runKey = (projection: UnitTimingProjection) => `${O.getOrElse(projection.runId, () => "local")}`;
const attemptOf = (projection: UnitTimingProjection) => O.getOrElse(projection.runAttempt, () => 1);

const latestAttempts = (projections: ReadonlyArray<UnitTimingProjection>): ReadonlyArray<UnitTimingProjection> =>
  HashMap.toValues(
    A.reduce(projections, HashMap.empty<string, UnitTimingProjection>(), (acc, projection) => {
      const key = `${runKey(projection)}:${projection.partition}`;
      return O.exists(HashMap.get(acc, key), (kept) => attemptOf(kept) >= attemptOf(projection))
        ? acc
        : HashMap.set(acc, key, projection);
    })
  );

/**
 * Fold projections into one file census per event.
 *
 * **Details**
 *
 * Each partition counts once per run, at its latest attempt, since "Re-run
 * failed jobs" gives only the re-run partitions a new attempt. Rows then group
 * by run, package and invocation, so a sharded package's partitions add
 * their executed files toward one selection, across attempts. A group matches
 * when its executed files equal its selection; a group no manifest stamped is
 * `unsealed`, and its executed files still count. Events sort by name.
 *
 * **Example** (A sharded package that ran every file)
 *
 * ```ts
 * import { UnitTimingPackage, UnitTimingProjection, UnitTimingShard, unitTimingCensus } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const shard = (index: number, executed: number) =>
 *   UnitTimingProjection.make({
 *     schemaVersion: "unit-timings/v1",
 *     partition: `repo-cli-${index}`,
 *     event: "push",
 *     runId: O.some(1),
 *     runAttempt: O.some(1),
 *     sha: O.none(),
 *     sealed: true,
 *     packages: [
 *       UnitTimingPackage.make({
 *         packageName: "@beep/repo-cli",
 *         packagePath: "packages/tooling/tool/cli",
 *         invocationId: "0",
 *         reportPath: "packages/tooling/tool/cli/coverage/unit-results.json",
 *         outcome: "passed",
 *         wallMs: 10,
 *         fileMs: 10,
 *         executedTestFiles: executed,
 *         expectedTestFiles: O.some(5),
 *         shard: UnitTimingShard.makeOption({ index, total: 2 }),
 *         files: [],
 *       }),
 *     ],
 *   })
 * const [push] = unitTimingCensus([shard(1, 3), shard(2, 2)])
 * console.log(push?.unmatched.length) // 0
 * ```
 *
 * @param projections - Projections from any number of runs and events.
 * @returns One census row per event.
 * @category utilities
 * @since 0.0.0
 */
export const unitTimingCensus = (
  projections: ReadonlyArray<UnitTimingProjection>
): ReadonlyArray<UnitTimingEventCensus> =>
  pipe(
    A.groupBy(projections, (projection) => projection.event),
    (byEvent) =>
      A.map(
        A.sort(
          R.toEntries(byEvent),
          Order.mapInput(Order.String, ([event]: readonly [string, unknown]) => event)
        ),
        ([event, projected]) => {
          const rows = latestAttempts(projected);
          const groups = A.reduce(rows, HashMap.empty<string, CensusGroup>(), (acc, projection) =>
            A.reduce(projection.packages, acc, (inner, row) => {
              const key = `${runKey(projection)}:${row.packageName}:${row.invocationId}`;
              const previous = HashMap.get(inner, key);
              return HashMap.set(inner, key, {
                executed:
                  O.match(previous, { onNone: () => 0, onSome: (group) => group.executed }) + row.executedTestFiles,
                expected: O.orElse(
                  O.flatMap(previous, (group) => group.expected),
                  () => row.expectedTestFiles
                ),
              });
            })
          );
          const entries = A.sort(
            HashMap.toEntries(groups),
            Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)
          );
          return UnitTimingEventCensus.make({
            event,
            projections: A.length(rows),
            packages: A.length(entries),
            executedTestFiles: A.reduce(entries, 0, (total, [, group]) => total + group.executed),
            expectedTestFiles: A.reduce(entries, 0, (total, [, group]) => total + O.getOrElse(group.expected, () => 0)),
            unmatched: A.getSomes(
              A.map(entries, ([key, group]) =>
                O.flatMap(group.expected, (expected) => (expected === group.executed ? O.none() : O.some(key)))
              )
            ),
            unsealed: A.getSomes(A.map(entries, ([key, group]) => (O.isNone(group.expected) ? O.some(key) : O.none()))),
          });
        }
      )
  );

const optionalInt = (name: string) =>
  Config.option(Config.Int(name)).pipe(Config.map(O.filter((value: number) => value >= 0)));
const ActionsIdentity = Config.all({
  event: Config.option(Config.String("GITHUB_EVENT_NAME")),
  runId: optionalInt("GITHUB_RUN_ID"),
  runAttempt: optionalInt("GITHUB_RUN_ATTEMPT"),
  sha: Config.option(Config.String("GITHUB_SHA")),
  setupStartedAt: optionalInt("BEEP_SETUP_STARTED_AT"),
});

/**
 * Write one partition's projection to `out`, creating its directory.
 *
 * **Example** (Inspect the writer)
 *
 * ```ts
 * import { writeUnitTimings } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof writeUnitTimings) // "function"
 * ```
 *
 * @param repoRoot - The checkout the partition ran in; `out` and `coverageOutput` resolve against it.
 * @param partition - The Test Unit partition id.
 * @param coverageOutput - The partition's coverage output directory.
 * @param out - Where to write the projection JSON.
 * @returns The projection it wrote.
 * @category use-cases
 * @since 0.0.0
 */
export const writeUnitTimings = Effect.fn("CiUnitTimings.write")(function* (
  repoRoot: string,
  partition: string,
  coverageOutput: string,
  out: string
) {
  const path = yield* Path.Path;
  const identity = yield* ActionsIdentity.pipe(CiCommandError.mapError("Failed to read the run identity."));
  const options = yield* S.decodeEffect(UnitTimingOptions)({
    partition,
    coverageOutput,
    event: O.getOrElse(O.filter(identity.event, Str.isNonEmpty), () => "local"),
    runId: identity.runId,
    runAttempt: identity.runAttempt,
    sha: O.filter(identity.sha, Str.isNonEmpty),
    writtenSince: identity.setupStartedAt,
  }).pipe(CiCommandError.mapError("Invalid unit-timings options."));
  const projection = yield* projectUnitTimings(repoRoot, options);
  const target = path.resolve(repoRoot, out);
  const text = yield* encodeProjection(projection).pipe(CiCommandError.mapError("Failed to encode the projection."));
  yield* writeArtifact({ path: target, body: `${text}\n`, onError: CiCommandError.new(`Failed to write ${out}.`) });
  const executed = A.reduce(projection.packages, 0, (total, row) => total + row.executedTestFiles);
  yield* Console.log(
    `[ci] unit timings for ${partition} (${projection.event}): ${A.length(projection.packages)} package invocation(s), ${executed} test file(s), ${projection.sealed ? "sealed" : "unsealed"}; wrote ${path.relative(repoRoot, target)}.`
  );
  return projection;
});

/**
 * `beep ci unit-timings --partition <id> --coverage-output <dir> --out <file>`.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciUnitTimingsCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciUnitTimingsCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciUnitTimingsCommand = Command.make(
  "unit-timings",
  {
    partition: Flag.String("partition").pipe(Flag.withDescription("The Test Unit partition id")),
    coverageOutput: Flag.String("coverage-output").pipe(
      Flag.withDescription("The partition's coverage output directory, where its sealed manifest is")
    ),
    out: Flag.String("out").pipe(Flag.withDescription("Where to write the unit-timings/v1 projection")),
  },
  ({ partition, coverageOutput, out }) =>
    findRepoRoot().pipe(
      CiCommandError.mapError("Failed to locate repository root."),
      Effect.flatMap((repoRoot) => writeUnitTimings(repoRoot, partition, coverageOutput, out)),
      Effect.asVoid,
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(Command.withDescription("Project a Test Unit partition's Vitest reports into per-package and per-file timings"));
