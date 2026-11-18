/**
 * Schemas for the Test Unit timing projection (`beep ci unit-timings`, MEAS-06).
 *
 * **Details**
 *
 * A Test Unit shard runs every selected package's Vitest suite with the JSON
 * reporter, which writes `coverage/unit-results.json` (or
 * `coverage/invocation-<n>/unit-results.json` when a package has several
 * invocations). The projection turns those reports into one row per executed
 * package invocation, with per-file timings, and stamps each row with the
 * number of test files the producer selected for it (`expectedTestFiles`)
 * when the sealed coverage manifest names it. The hosted shard writes one
 * projection per partition on every event and uploads it as its own artifact,
 * so a reader can fold runs by event without the failure-only report upload.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/CiUnitTimings.schemas");

const NonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0));
const NonNegativeMs = S.Finite.check(S.isGreaterThanOrEqualTo(0));

/**
 * How one package invocation's report ended.
 *
 * **Details**
 *
 * `passed` and `failed` come from the report's own `success` flag.
 * `missing`: the sealed manifest names the invocation but no report exists.
 * `unreadable`: a report exists and is not a Vitest JSON report.
 *
 * **Example** (Guard a report outcome)
 *
 * ```ts
 * import { UnitTimingOutcome } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(UnitTimingOutcome.is.missing("missing")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnitTimingOutcome = LiteralKit(["passed", "failed", "missing", "unreadable"]).pipe(
  $I.annoteSchema("UnitTimingOutcome", {
    description:
      "passed/failed: the report's success flag; missing: named by the manifest, no report; unreadable: not a Vitest JSON report.",
  })
);

/**
 * Type of {@link UnitTimingOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type UnitTimingOutcome = typeof UnitTimingOutcome.Type;

/**
 * One executed test file: its repository-relative path, the status Vitest
 * reported, its wall time and its test count.
 *
 * **Example** (A passing test file)
 *
 * ```ts
 * import { UnitTimingFile } from "@beep/repo-cli/commands/Ci"
 *
 * const file = UnitTimingFile.make({ path: "packages/a/test/a.test.ts", status: "passed", durationMs: 120, tests: 4 })
 * console.log(file.durationMs) // 120
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitTimingFile extends S.Opaque<UnitTimingFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    status: S.NonEmptyString,
    durationMs: NonNegativeMs,
    tests: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("UnitTimingFile", {
      description: "One executed test file with its reported status, wall time and test count.",
    })
  )
) {}

/**
 * The shard of a package a partition ran, as the producer selected it.
 *
 * **Example** (The second of three shards)
 *
 * ```ts
 * import { UnitTimingShard } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(UnitTimingShard.make({ index: 2, total: 3 }).total) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitTimingShard extends S.Opaque<UnitTimingShard, { readonly brand: unique symbol }>()(
  S.Struct({ index: NonNegativeInt, total: NonNegativeInt }).pipe(
    $I.annoteSchema("UnitTimingShard", { description: "A Vitest shard index and total." })
  )
) {}

/**
 * One package invocation a Test Unit partition executed.
 *
 * **Details**
 *
 * `wallMs` runs from the first file's start to the last file's end;
 * `fileMs` sums the files' own durations. `expectedTestFiles` is the number
 * of files the producer selected for the invocation, present only when the
 * sealed coverage manifest names it (a red producer seals nothing). A sharded
 * package's selection is the whole package, so its shards' `executedTestFiles`
 * sum to it across the run, not within one partition.
 *
 * **Example** (A passing package row)
 *
 * ```ts
 * import { UnitTimingPackage } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const row = UnitTimingPackage.make({
 *   packageName: "@beep/a",
 *   packagePath: "packages/a",
 *   invocationId: "0",
 *   reportPath: "packages/a/coverage/unit-results.json",
 *   outcome: "passed",
 *   wallMs: 300,
 *   fileMs: 420,
 *   executedTestFiles: 2,
 *   expectedTestFiles: O.some(2),
 *   shard: O.none(),
 *   files: [],
 * })
 * console.log(row.executedTestFiles) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitTimingPackage extends S.Opaque<UnitTimingPackage, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.NonEmptyString,
    packagePath: S.NonEmptyString,
    invocationId: S.NonEmptyString,
    reportPath: S.NonEmptyString,
    outcome: UnitTimingOutcome,
    wallMs: NonNegativeMs,
    fileMs: NonNegativeMs,
    executedTestFiles: NonNegativeInt,
    expectedTestFiles: S.OptionFromOptionalKey(NonNegativeInt),
    shard: S.OptionFromOptionalKey(UnitTimingShard),
    files: S.Array(UnitTimingFile),
  }).pipe(
    $I.annoteSchema("UnitTimingPackage", {
      description: "One executed package invocation with its outcome, timings, file counts and per-file rows.",
    })
  )
) {}

/**
 * The timing projection one Test Unit partition writes on every event.
 *
 * **Details**
 *
 * `sealed` says whether the partition's coverage manifest existed, which is
 * where `expectedTestFiles` comes from. `runId`, `runAttempt` and `sha` are
 * read from the GitHub Actions environment and absent elsewhere; `event` is
 * `GITHUB_EVENT_NAME`, or `local` outside Actions.
 *
 * **Example** (An empty local projection)
 *
 * ```ts
 * import { UnitTimingProjection } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const projection = UnitTimingProjection.make({
 *   schemaVersion: "unit-timings/v1",
 *   partition: "unit-a",
 *   event: "local",
 *   runId: O.none(),
 *   runAttempt: O.none(),
 *   sha: O.none(),
 *   sealed: false,
 *   packages: [],
 * })
 * console.log(projection.schemaVersion) // "unit-timings/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitTimingProjection extends S.Opaque<UnitTimingProjection, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("unit-timings/v1"),
    partition: S.NonEmptyString,
    event: S.NonEmptyString,
    runId: S.OptionFromOptionalKey(NonNegativeInt),
    runAttempt: S.OptionFromOptionalKey(NonNegativeInt),
    sha: S.OptionFromOptionalKey(S.NonEmptyString),
    sealed: S.Boolean,
    packages: S.Array(UnitTimingPackage),
  }).pipe(
    $I.annoteSchema("UnitTimingProjection", {
      description: "Per-package and per-file Test Unit timings of one partition run, stamped with its event.",
    })
  )
) {}

/**
 * One event's file census over a set of projections.
 *
 * **Details**
 *
 * `packages` counts distinct (package, invocation) pairs. `executedTestFiles`
 * sums every shard's executed files; `expectedTestFiles` sums each pair's
 * selection once. `unmatched` lists the pairs whose executed files differ from
 * their selection, and `unsealed` the pairs no manifest stamped, so a red run
 * is counted, never read as a match.
 *
 * **Example** (A matching event)
 *
 * ```ts
 * import { UnitTimingEventCensus } from "@beep/repo-cli/commands/Ci"
 *
 * const row = UnitTimingEventCensus.make({
 *   event: "push",
 *   projections: 1,
 *   packages: 1,
 *   executedTestFiles: 2,
 *   expectedTestFiles: 2,
 *   unmatched: [],
 *   unsealed: [],
 * })
 * console.log(row.unmatched.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitTimingEventCensus extends S.Opaque<UnitTimingEventCensus, { readonly brand: unique symbol }>()(
  S.Struct({
    event: S.NonEmptyString,
    projections: NonNegativeInt,
    packages: NonNegativeInt,
    executedTestFiles: NonNegativeInt,
    expectedTestFiles: NonNegativeInt,
    unmatched: S.Array(S.String),
    unsealed: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("UnitTimingEventCensus", {
      description: "Executed against selected test files per event, with the unmatched and unsealed packages named.",
    })
  )
) {}
