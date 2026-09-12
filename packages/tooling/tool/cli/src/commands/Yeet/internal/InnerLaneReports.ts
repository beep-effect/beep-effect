/**
 * Durable inner-lane report reader shared by the verdict and packet writers.
 *
 * **Details**
 *
 * Wrapper lanes append one `quality-task-lane-run/v1` line per inner lane to
 * `inner-lanes.ndjson` under the run artifact directory. The verdict builder
 * and the failure-packet writer both read it back, so repair hints follow the
 * lane that actually went red instead of a marker scan of the whole log.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { QualityTaskLaneRunReport } from "../../Quality/Quality.schemas.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import type { Path } from "effect";
import type { RepoRunContext } from "../../../internal/repo-run/RepoRun.models.ts";
import type { QualityTaskLaneRun } from "../../Quality/Quality.schemas.ts";

/**
 * File name of the durable inner-lane report inside the run artifact directory.
 *
 * **Example** (Resolve the report path for a run)
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
 * Read every decodable inner-lane report line recorded for the run.
 *
 * **Details**
 *
 * A missing file yields an empty list; undecodable lines are skipped so one
 * truncated append never hides the lanes that were recorded cleanly.
 *
 * **Example** (Inspect the reader)
 *
 * ```ts
 * import { readInnerLaneReports } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(readInnerLaneReports)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context that locates the run artifact directory.
 * @returns Every decodable report, in append order.
 * @category utilities
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
 * Collect the inner lane runs recorded under one wrapper lane, in append order.
 *
 * **Example** (Select one wrapper's lanes)
 *
 * ```ts
 * import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/test/Quality"
 * import { laneRunsForWrapper } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const report = QualityTaskLaneRunReport.make({
 *   schemaVersion: "quality-task-lane-run/v1",
 *   parentLaneId: O.some("full:01-pre-push"),
 *   lanes: [QualityTaskLaneRun.make({ id: "quality:check", label: "quality:check", status: "passed", inputDigest: O.none() })],
 * })
 *
 * console.log(laneRunsForWrapper([report], "full:01-pre-push").length) // 1
 * ```
 *
 * @param reports - Every report read for the run.
 * @param wrapperLaneId - Plan step id of the wrapper lane.
 * @returns The lane runs whose report names that wrapper as parent.
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
