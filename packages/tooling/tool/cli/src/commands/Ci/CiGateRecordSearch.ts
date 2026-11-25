/**
 * The search for the gate records a job's checkout holds.
 *
 * **Details**
 *
 * The task-outcome record, the CI projection and the lane recorder all find
 * a job's records the same way: package records at
 * `<package>/.beep/gates/<gate>/report.json` and root runs at
 * `.beep/gates/<gate>/<run-id>.json`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  GATES_DIR,
  GateName,
  RecordTarget,
  RepoRelativeDir,
  RunId,
  recordLocation,
} from "@beep/repo-gate-record/GatePaths";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";

const isRunId = S.is(RunId);
const isGateName = S.is(GateName);
const isRepoRelativeDir = S.is(RepoRelativeDir);
const ROOT_PREFIX = `${GATES_DIR}/`;
const PACKAGE_RECORD_TAIL = [".beep", "gates", "<gate>", "report.json"].length;

const packageTargetOfPackageGlobMatch = (segments: ReadonlyArray<string>): O.Option<RecordTarget> =>
  pipe(
    O.all({
      packageDir: O.liftPredicate(A.join(A.dropRight(segments, PACKAGE_RECORD_TAIL), "/"), isRepoRelativeDir),
      gate: O.filter(A.get(segments, segments.length - 2), isGateName),
    }),
    O.map(RecordTarget.cases.PackageTarget.make)
  );

const rootTargetOfRootGlobMatch = (segments: ReadonlyArray<string>): O.Option<RecordTarget> =>
  pipe(
    O.all({
      gate: O.filter(A.get(segments, 2), isGateName),
      runId: O.filter(O.map(A.get(segments, 3), Str.slice(0, -".json".length)), isRunId),
    }),
    O.map(RecordTarget.cases.RootTarget.make)
  );

const recordTargetOf = (file: string): O.Option<RecordTarget> =>
  (Str.startsWith(ROOT_PREFIX)(file) ? rootTargetOfRootGlobMatch : packageTargetOfPackageGlobMatch)(
    Str.split(file, "/")
  );

const byRecordPath = Order.mapInput(Order.String, (target: RecordTarget) => recordLocation(target).record);

/**
 * Find whose gate records a job's checkout holds, without reading them.
 *
 * **Details**
 *
 * A package record is `<package>/.beep/gates/<gate>/report.json`; a root run
 * is `.beep/gates/<gate>/<run-id>.json`. `node_modules` and dot directories
 * other than `.beep` are not searched. Targets come back sorted by record
 * path.
 *
 * **Example** (Inspect the search)
 *
 * ```ts
 * import { findJobGateRecordTargets } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof findJobGateRecordTargets) // "function"
 * ```
 *
 * @param repoRoot - The job's checkout.
 * @returns The targets of the gate records found there.
 * @category use-cases
 * @since 0.0.0
 */
export const findJobGateRecordTargets = Effect.fn("CiGateRecordSearch.findJobGateRecordTargets")(function* (
  repoRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const found = yield* Effect.all(
    [
      fs.glob(`**/${GATES_DIR}/*/report.json`, { root: repoRoot, exclude: ["**/node_modules/**"] }),
      fs.glob(`${GATES_DIR}/*/*.json`, { root: repoRoot }),
    ],
    { concurrency: 1 }
  ).pipe(CiCommandError.mapError("Failed to search the checkout for gate records."));
  return pipe(A.flatten(found), A.dedupe, A.map(recordTargetOf), A.getSomes, A.sort(byRecordPath));
});
