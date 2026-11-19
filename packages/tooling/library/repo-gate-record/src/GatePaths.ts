/**
 * Where a gate run's record and raw log live: one overwritten pair per
 * package gate, and a run-keyed pair per gate at the repository root.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoGateRecordId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoGateRecordId.create("GatePaths");

/**
 * The directory every gate writes under, relative to a package or to the
 * repository root.
 *
 * **Example** (Read the gates directory)
 *
 * ```ts
 * import { GATES_DIR } from "@beep/repo-gate-record/GatePaths";
 *
 * console.log(GATES_DIR); // .beep/gates
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GATES_DIR = ".beep/gates";

/**
 * A gate's name as a path segment: lower case letters, digits and dashes.
 *
 * **Example** (Check a gate name)
 *
 * ```ts
 * import { GateName } from "@beep/repo-gate-record/GatePaths";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(GateName)("test")); // true
 * console.log(S.is(GateName)("../test")); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateName = S.String.check(
  S.isPattern(/^[a-z][a-z0-9-]*$/u, {
    identifier: "GateNamePattern",
    title: "Gate Name Pattern",
    description: "A lower-case gate name usable as one path segment.",
  })
).pipe(
  $I.annoteSchema("GateName", {
    description: "A gate's name as one path segment: lower case letters, digits and dashes.",
  })
);

/**
 * Type of {@link GateName}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateName = typeof GateName.Type;

/**
 * A run id usable as a file name: letters, digits, dots, dashes and
 * underscores, starting with a letter or digit.
 *
 * **Details**
 *
 * Run ids sort by time when minted by {@link makeRunId}
 * (`@beep/repo-gate-record/RunId`), so the newest root runs are the
 * greatest names.
 *
 * **Example** (Check a run id)
 *
 * ```ts
 * import { RunId } from "@beep/repo-gate-record/GatePaths";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(RunId)("20261119T100000123Z-0a1b")); // true
 * console.log(S.is(RunId)("../x")); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunId = S.String.check(
  S.isPattern(/^[0-9A-Za-z][0-9A-Za-z._-]*$/u, {
    identifier: "RunIdPattern",
    title: "Run Id Pattern",
    description: "A run id usable as one file name.",
  })
).pipe(
  $I.annoteSchema("RunId", {
    description: "A run id usable as a file name; minted run ids sort by time.",
  })
);

/**
 * Type of {@link RunId}.
 *
 * @category models
 * @since 0.0.0
 */
export type RunId = typeof RunId.Type;

const isRelativeDir = (dir: string): boolean =>
  !Str.startsWith("/")(dir) &&
  !A.some(Str.split(dir, "/"), (segment) => segment === ".." || segment === "." || segment === "");

/**
 * A package directory relative to the repository root, written with `/`,
 * never climbing out of the repository.
 *
 * **Example** (Check a package directory)
 *
 * ```ts
 * import { RepoRelativeDir } from "@beep/repo-gate-record/GatePaths";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(RepoRelativeDir)("packages/foundation/primitive/glob")); // true
 * console.log(S.is(RepoRelativeDir)("../outside")); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RepoRelativeDir = S.String.check(
  S.makeFilter(isRelativeDir, {
    identifier: "RepoRelativeDirShape",
    title: "Repository Relative Directory",
    description: "A relative directory with no empty, `.` or `..` segment.",
    message: "expected a repository-relative directory with no empty, `.` or `..` segment",
  })
).pipe(
  $I.annoteSchema("RepoRelativeDir", {
    description: "A package directory relative to the repository root, never climbing out of it.",
  })
);

/**
 * Type of {@link RepoRelativeDir}.
 *
 * @category models
 * @since 0.0.0
 */
export type RepoRelativeDir = typeof RepoRelativeDir.Type;

/**
 * Whose record a write or read addresses: one package's gate, overwritten
 * each run, or one root run of a gate, kept among the newest 20.
 *
 * **Example** (Address a package record)
 *
 * ```ts
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
 *
 * const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/foundation/primitive/glob", gate: "test" });
 * console.log(target._tag); // PackageTarget
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecordTarget = S.TaggedUnion({
  PackageTarget: { packageDir: RepoRelativeDir, gate: GateName },
  RootTarget: { gate: GateName, runId: RunId },
}).pipe(
  $I.annoteSchema("RecordTarget", {
    description: "A package gate record, overwritten each run, or one root run of a gate.",
  })
);

/**
 * Type of {@link RecordTarget}.
 *
 * @category models
 * @since 0.0.0
 */
export type RecordTarget = typeof RecordTarget.Type;

/**
 * The record and raw log paths of a target, relative to the repository root.
 *
 * **Example** (Build a location)
 *
 * ```ts
 * import { RecordLocation } from "@beep/repo-gate-record/GatePaths";
 *
 * const location = RecordLocation.make({ record: ".beep/gates/test/r1.json", log: ".beep/gates/test/r1.log" });
 * console.log(location.log); // .beep/gates/test/r1.log
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RecordLocation extends S.Opaque<RecordLocation, { readonly brand: unique symbol }>()(
  S.Struct({
    record: S.NonEmptyString,
    log: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("RecordLocation", {
      description: "The repository-relative record and raw log paths of one gate run.",
    })
  )
) {}

/**
 * The repository-relative directory holding one gate's root runs.
 *
 * **Example** (Name the root directory of the test gate)
 *
 * ```ts
 * import { rootGateDir } from "@beep/repo-gate-record/GatePaths";
 *
 * console.log(rootGateDir("test")); // .beep/gates/test
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rootGateDir = (gate: GateName): string => `${GATES_DIR}/${gate}`;

/**
 * The record and log paths of a target.
 *
 * **Details**
 *
 * A package gate writes `<package>/.beep/gates/<gate>/report.json` and
 * `report.log`; a root run writes `.beep/gates/<gate>/<run-id>.json` and
 * `<run-id>.log`.
 *
 * **Example** (Locate a package record)
 *
 * ```ts
 * import { RecordTarget, recordLocation } from "@beep/repo-gate-record/GatePaths";
 *
 * const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/foundation/primitive/glob", gate: "test" });
 * console.log(recordLocation(target).record);
 * // packages/foundation/primitive/glob/.beep/gates/test/report.json
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const recordLocation: (target: RecordTarget) => RecordLocation = RecordTarget.match({
  PackageTarget: (target) => {
    const base = `${target.packageDir}/${GATES_DIR}/${target.gate}/report`;
    return RecordLocation.make({ record: `${base}.json`, log: `${base}.log` });
  },
  RootTarget: (target) => {
    const base = `${rootGateDir(target.gate)}/${target.runId}`;
    return RecordLocation.make({ record: `${base}.json`, log: `${base}.log` });
  },
});
