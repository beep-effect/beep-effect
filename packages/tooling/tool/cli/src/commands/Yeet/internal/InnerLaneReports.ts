/**
 * Durable inner-lane report reader and lane-run selectors shared by the Yeet
 * verdict and the failure packet path.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubCheckLaneRunStatus, QualityTaskLaneRunReport } from "../../Quality/Quality.schemas.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import type { Path } from "effect";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { QualityTaskLaneRun } from "../../Quality/Quality.schemas.ts";

/**
 * File name of the durable inner-lane report inside the Yeet run directory.
 *
 * **Details**
 *
 * Wrapper lanes append one `quality-task-lane-run/v1` line per inner lane to
 * this file through the side channel Yeet attaches to every planned step. The
 * run resets it at start, so its rows describe the current attempt only.
 *
 * **Example** (Reference the report file name)
 *
 * ```ts
 * import { INNER_LANE_REPORT_FILE_NAME } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(INNER_LANE_REPORT_FILE_NAME) // "inner-lanes.ndjson"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const INNER_LANE_REPORT_FILE_NAME = "inner-lanes.ndjson";

const decodeInnerLaneReportOption = S.decodeUnknownOption(S.fromJsonString(QualityTaskLaneRunReport));

/**
 * Read every decodable inner-lane report recorded for the current Yeet run.
 *
 * **Details**
 *
 * A missing file yields no reports. Rows that fail to decode are skipped so a
 * truncated append never hides the rows that landed before it.
 *
 * **Example** (Read the run's inner-lane reports)
 *
 * ```ts
 * import { readInnerLaneReports, RepoRunContext, TurboPlanSnapshot } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] })
 * })
 *
 * console.log(Effect.isEffect(readInnerLaneReports(context))) // true
 * ```
 *
 * @param context - Repo run context whose run directory owns the report.
 * @returns Decoded reports in append order, or an empty array when the file is
 * absent.
 * @category diagnostics
 * @since 0.0.0
 */
export const readInnerLaneReports = Effect.fn("Yeet.readInnerLaneReports")(function* (
  context: RepoRunContext
): Effect.fn.Return<ReadonlyArray<QualityTaskLaneRunReport>, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const reportPath = yield* runArtifactPathForContext(context, INNER_LANE_REPORT_FILE_NAME);
  if (!(yield* fs.exists(reportPath).pipe(Effect.orElseSucceed(() => false)))) {
    return A.empty();
  }
  const text = yield* fs
    .readFileString(reportPath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read durable inner-lane report "${reportPath}".`)));
  const lines = pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty));
  return A.getSomes(A.map(lines, (line) => decodeInnerLaneReportOption(line)));
});

/**
 * Select the inner lanes one wrapper lane recorded, in record order.
 *
 * **Example** (Keep only the pre-push wrapper's lanes)
 *
 * ```ts
 * import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/test/Quality"
 * import { laneRunsForWrapper } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const report = (parent: string, id: string) =>
 *   QualityTaskLaneRunReport.make({
 *     schemaVersion: "quality-task-lane-run/v1",
 *     parentLaneId: O.some(parent),
 *     lanes: [QualityTaskLaneRun.make({ id, label: id, status: "failed", inputDigest: O.none() })]
 *   })
 *
 * const lanes = laneRunsForWrapper([report("full:pre-push", "quality:coverage"), report("full:other", "quality:osv")], "full:pre-push")
 * console.log(lanes.map((lane) => lane.id)) // ["quality:coverage"]
 * ```
 *
 * @param reports - Every report read from the durable inner-lane file.
 * @param wrapperLaneId - Step id of the wrapper lane whose lanes are wanted.
 * @returns The wrapper's recorded lanes, flattened in append order.
 * @category utilities
 * @since 0.0.0
 */
export const laneRunsForWrapper: {
  (wrapperLaneId: string): (reports: ReadonlyArray<QualityTaskLaneRunReport>) => ReadonlyArray<QualityTaskLaneRun>;
  (reports: ReadonlyArray<QualityTaskLaneRunReport>, wrapperLaneId: string): ReadonlyArray<QualityTaskLaneRun>;
} = dual(
  2,
  (reports: ReadonlyArray<QualityTaskLaneRunReport>, wrapperLaneId: string): ReadonlyArray<QualityTaskLaneRun> =>
    pipe(
      reports,
      A.filter((report) => O.contains(report.parentLaneId, wrapperLaneId)),
      A.flatMap((report) => report.lanes)
    )
);

/**
 * Find the first recorded lane that went red, in record order.
 *
 * **Example** (Skip passing lanes)
 *
 * ```ts
 * import { QualityTaskLaneRun } from "@beep/repo-cli/test/Quality"
 * import { firstRedLaneRun } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const lane = (id: string, status: QualityTaskLaneRun["status"]) =>
 *   QualityTaskLaneRun.make({ id, label: id, status, inputDigest: O.none() })
 *
 * const red = firstRedLaneRun([lane("quality:security", "passed"), lane("quality:coverage", "failed")])
 * console.log(O.map(red, (value) => value.id)) // Some("quality:coverage")
 * ```
 *
 * @param lanes - Recorded inner lanes of one wrapper.
 * @returns The first lane whose status is `failed`.
 * @category utilities
 * @since 0.0.0
 */
export const firstRedLaneRun = (lanes: ReadonlyArray<QualityTaskLaneRun>): O.Option<QualityTaskLaneRun> =>
  A.findFirst(lanes, (lane) => GithubCheckLaneRunStatus.is.failed(lane.status));

/**
 * Collect the labels of every recorded inner lane.
 *
 * **Details**
 *
 * The output-segment scan uses these labels as segment boundaries: a sibling's
 * launch line ends the red lane's own segment.
 *
 * **Example** (Collect sibling labels)
 *
 * ```ts
 * import { QualityTaskLaneRun } from "@beep/repo-cli/test/Quality"
 * import { laneRunLabels } from "@beep/repo-cli/test/Yeet"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const lane = (id: string) => QualityTaskLaneRun.make({ id, label: id, status: "passed", inputDigest: O.none() })
 *
 * console.log(HashSet.has(laneRunLabels([lane("quality:security"), lane("quality:coverage")]), "quality:coverage")) // true
 * ```
 *
 * @param lanes - Recorded inner lanes of one wrapper.
 * @returns The set of their labels.
 * @category utilities
 * @since 0.0.0
 */
export const laneRunLabels = (lanes: ReadonlyArray<QualityTaskLaneRun>): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.map(lanes, (lane) => lane.label));
