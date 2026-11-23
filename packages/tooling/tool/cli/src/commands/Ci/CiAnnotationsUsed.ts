/**
 * How many annotations a job's earlier steps already wrote, counted from the
 * workflow commands `beep ci lane` streamed and read by
 * `beep ci append-gate-reports`.
 *
 * **Details**
 *
 * GitHub turns a `::error`, `::warning` or `::notice` workflow command into
 * an annotation and keeps at most 10 per level per step and 50 per job. A
 * lane step tallies the commands in the output it streams, caps each level
 * at the per-step limit, and adds the result to
 * `.beep/ci/annotations-used.json`. The projection step reads that total as
 * the annotations its job already spent (goals/ci-gate-reports, decision
 * `annotations-used-tally`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Count } from "@beep/gate-report/Scalars";
import { $RepoCliId } from "@beep/identity/packages";
import { writeArtifact } from "@beep/repo-cli-kit/artifacts/ArtifactIo";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";

const $I = $RepoCliId.create("commands/Ci/CiAnnotationsUsed");

/**
 * The annotations GitHub shows per level for one step.
 *
 * **Example** (Read the per-step cap)
 *
 * ```ts
 * import { GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP) // 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP = 10;

/**
 * Where a job keeps the annotations its lane steps already wrote.
 *
 * **Example** (Name the file)
 *
 * ```ts
 * import { CI_ANNOTATIONS_USED_PATH } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_ANNOTATIONS_USED_PATH) // ".beep/ci/annotations-used.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_ANNOTATIONS_USED_PATH = ".beep/ci/annotations-used.json";

/**
 * **Example** (Check a level)
 *
 * ```ts
 * import { WorkflowCommandLevel } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(WorkflowCommandLevel.is.notice("notice")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorkflowCommandLevel = LiteralKit(["error", "warning", "notice"]).pipe(
  $I.annoteSchema("WorkflowCommandLevel", {
    description: "A workflow command GitHub turns into an annotation: error, warning or notice.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type WorkflowCommandLevel = typeof WorkflowCommandLevel.Type;

/**
 * How many annotation workflow commands were written, by level.
 *
 * **Example** (Build a tally)
 *
 * ```ts
 * import { WorkflowCommandTally } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(WorkflowCommandTally.make({ errors: 2, warnings: 0, notices: 1 }).errors) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkflowCommandTally extends S.Opaque<WorkflowCommandTally, { readonly brand: unique symbol }>()(
  S.Struct({
    errors: Count,
    warnings: Count,
    notices: Count,
  }).pipe(
    $I.annoteSchema("WorkflowCommandTally", {
      description: "The error, warning and notice workflow commands a step wrote.",
    })
  )
) {}

/**
 * A tally with no command counted.
 *
 * **Example** (Start from nothing)
 *
 * ```ts
 * import { emptyWorkflowCommandTally } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(emptyWorkflowCommandTally.notices) // 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const emptyWorkflowCommandTally: WorkflowCommandTally = WorkflowCommandTally.make({
  errors: 0,
  warnings: 0,
  notices: 0,
});

/**
 * A line scan in progress: the partial line a chunk ended inside, and the
 * commands counted on the whole lines before it.
 *
 * **Example** (Start a scan)
 *
 * ```ts
 * import { emptyWorkflowCommandTally, WorkflowCommandScan } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(WorkflowCommandScan.make({ carry: "", tally: emptyWorkflowCommandTally }).carry) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkflowCommandScan extends S.Opaque<WorkflowCommandScan, { readonly brand: unique symbol }>()(
  S.Struct({
    carry: S.String,
    tally: WorkflowCommandTally,
  }).pipe(
    $I.annoteSchema("WorkflowCommandScan", {
      description: "A workflow command scan in progress: the unfinished line and the tally of the lines before it.",
    })
  )
) {}

/**
 * The record a job keeps under {@link CI_ANNOTATIONS_USED_PATH}: the
 * annotations its lane steps wrote, each level already capped per step.
 *
 * **Example** (Build the record)
 *
 * ```ts
 * import { CiAnnotationsUsed } from "@beep/repo-cli/commands/Ci"
 *
 * const record = CiAnnotationsUsed.make({ schemaVersion: "ci-annotations-used/v1", errors: 10, warnings: 0, notices: 0 })
 * console.log(record.errors) // 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiAnnotationsUsed extends S.Opaque<CiAnnotationsUsed, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("ci-annotations-used/v1"),
    errors: Count,
    warnings: Count,
    notices: Count,
  }).pipe(
    $I.annoteSchema("CiAnnotationsUsed", {
      description: "The annotations a job's lane steps wrote, by level, each capped at GitHub's per-step limit.",
    })
  )
) {}

const COMMAND_PREFIX = "::";
const LEVEL_FIELD = { error: "errors", warning: "warnings", notice: "notices" } as const;
const isLevel = S.is(WorkflowCommandLevel);

/**
 * The annotation level of one output line, when the line is an annotation
 * workflow command.
 *
 * **Details**
 *
 * The runner reads a command at the start of a line, after leading
 * whitespace, as `::<name>[ <properties>]::<message>`, and matches the name
 * without regard to case. A line with no closing `::` is not a command.
 *
 * **Example** (Read three lines)
 *
 * ```ts
 * import { workflowCommandLevelOf } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(workflowCommandLevelOf("::error file=a.ts,line=1::boom")) // { _id: "Option", _tag: "Some", value: "error" }
 * console.log(workflowCommandLevelOf("::group::tests")._tag) // "None"
 * console.log(workflowCommandLevelOf("plain")._tag) // "None"
 * ```
 *
 * @param line - One output line.
 * @returns Its level, when it writes an annotation.
 * @category utilities
 * @since 0.0.0
 */
export const workflowCommandLevelOf = (line: string): O.Option<WorkflowCommandLevel> =>
  pipe(
    O.liftPredicate(Str.trimStart(line), Str.startsWith(COMMAND_PREFIX)),
    O.map(Str.slice(COMMAND_PREFIX.length)),
    O.flatMap((command) => O.map(Str.indexOf(COMMAND_PREFIX)(command), (end) => Str.slice(0, end)(command))),
    O.map(flow(Str.split(" "), A.headNonEmpty, Str.toLowerCase)),
    O.filter(isLevel)
  );

const countLine = (tally: WorkflowCommandTally, line: string): WorkflowCommandTally =>
  O.match(workflowCommandLevelOf(line), {
    onNone: () => tally,
    onSome: (level) => WorkflowCommandTally.make({ ...tally, [LEVEL_FIELD[level]]: tally[LEVEL_FIELD[level]] + 1 }),
  });

/**
 * Count the annotation commands on the whole lines of the next chunk of
 * output.
 *
 * **Details**
 *
 * The chunk continues the scan's unfinished line; the part after the
 * chunk's last newline is carried to the next chunk.
 *
 * **Example** (Scan a chunk that splits a line)
 *
 * ```ts
 * import { emptyWorkflowCommandTally, scanWorkflowCommands, WorkflowCommandScan } from "@beep/repo-cli/commands/Ci"
 *
 * const scan = scanWorkflowCommands(WorkflowCommandScan.make({ carry: "::err", tally: emptyWorkflowCommandTally }), "or::x\n::warn")
 * console.log(scan.tally.errors, scan.carry) // 1 "::warn"
 * ```
 *
 * @param scan - The scan so far.
 * @param text - The next decoded chunk.
 * @returns The scan after the chunk.
 * @category utilities
 * @since 0.0.0
 */
export const scanWorkflowCommands: {
  (text: string): (scan: WorkflowCommandScan) => WorkflowCommandScan;
  (scan: WorkflowCommandScan, text: string): WorkflowCommandScan;
} = dual(2, (scan: WorkflowCommandScan, text: string): WorkflowCommandScan => {
  const lines = Str.split(`${scan.carry}${text}`, "\n");
  return WorkflowCommandScan.make({
    carry: A.lastNonEmpty(lines),
    tally: A.reduce(A.initNonEmpty(lines), scan.tally, countLine),
  });
});

/**
 * The tally of a finished scan, its unfinished last line counted.
 *
 * **Example** (Finish on a line with no newline)
 *
 * ```ts
 * import { emptyWorkflowCommandTally, finishWorkflowCommandScan, WorkflowCommandScan } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(finishWorkflowCommandScan(WorkflowCommandScan.make({ carry: "::notice::done", tally: emptyWorkflowCommandTally })).notices) // 1
 * ```
 *
 * @param scan - The scan at the end of the output.
 * @returns Every annotation command the output wrote.
 * @category utilities
 * @since 0.0.0
 */
export const finishWorkflowCommandScan = (scan: WorkflowCommandScan): WorkflowCommandTally =>
  countLine(scan.tally, scan.carry);

/**
 * The annotations GitHub shows for one step's commands: each level capped at
 * {@link GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP}.
 *
 * **Example** (Cap a noisy step)
 *
 * ```ts
 * import { shownAnnotationsOf, WorkflowCommandTally } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(shownAnnotationsOf(WorkflowCommandTally.make({ errors: 200, warnings: 3, notices: 0 })).errors) // 10
 * ```
 *
 * @param tally - The commands one step wrote.
 * @returns The annotations that step created.
 * @category utilities
 * @since 0.0.0
 */
export const shownAnnotationsOf = (tally: WorkflowCommandTally): WorkflowCommandTally =>
  WorkflowCommandTally.make({
    errors: Math.min(tally.errors, GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP),
    warnings: Math.min(tally.warnings, GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP),
    notices: Math.min(tally.notices, GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP),
  });

/**
 * The annotations of every level in a record.
 *
 * **Example** (Total a record)
 *
 * ```ts
 * import { annotationsUsedTotal, CiAnnotationsUsed } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(annotationsUsedTotal(CiAnnotationsUsed.make({ schemaVersion: "ci-annotations-used/v1", errors: 10, warnings: 2, notices: 1 }))) // 13
 * ```
 *
 * @param used - A job's record.
 * @returns How many annotations the job's lane steps wrote.
 * @category utilities
 * @since 0.0.0
 */
export const annotationsUsedTotal = (used: CiAnnotationsUsed): number => used.errors + used.warnings + used.notices;

const emptyRecord = CiAnnotationsUsed.make({
  schemaVersion: "ci-annotations-used/v1",
  errors: 0,
  warnings: 0,
  notices: 0,
});
const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(CiAnnotationsUsed));
const encodeRecord = S.encodeEffect(S.fromJsonString(CiAnnotationsUsed));

/**
 * Read the annotations a job's lane steps wrote.
 *
 * **Details**
 *
 * A checkout with no record has spent none. A record that does not decode
 * fails the read, so a broken count is never taken for zero.
 *
 * **Example** (Inspect the reader)
 *
 * ```ts
 * import { readAnnotationsUsed } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof readAnnotationsUsed) // "function"
 * ```
 *
 * @param repoRoot - The job's checkout.
 * @returns The job's record.
 * @category use-cases
 * @since 0.0.0
 */
export const readAnnotationsUsed = Effect.fn("CiAnnotationsUsed.read")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, CI_ANNOTATIONS_USED_PATH);
  const present = yield* fs.exists(file).pipe(CiCommandError.mapError(`Failed to stat ${CI_ANNOTATIONS_USED_PATH}.`));
  if (!present) return emptyRecord;
  const text = yield* fs
    .readFileString(file)
    .pipe(CiCommandError.mapError(`Failed to read ${CI_ANNOTATIONS_USED_PATH}.`));
  return yield* decodeRecord(text).pipe(
    CiCommandError.mapError(`${CI_ANNOTATIONS_USED_PATH} is not a ci-annotations-used/v1 record.`)
  );
});

/**
 * Add one step's shown annotations to the job's record.
 *
 * **Example** (Inspect the writer)
 *
 * ```ts
 * import { addAnnotationsUsed } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof addAnnotationsUsed) // "function"
 * ```
 *
 * @param repoRoot - The job's checkout.
 * @param shown - The annotations the step created, from {@link shownAnnotationsOf}.
 * @returns The job's record after the step.
 * @category use-cases
 * @since 0.0.0
 */
export const addAnnotationsUsed = Effect.fn("CiAnnotationsUsed.add")(function* (
  repoRoot: string,
  shown: WorkflowCommandTally
) {
  const path = yield* Path.Path;
  const before = yield* readAnnotationsUsed(repoRoot);
  const after = CiAnnotationsUsed.make({
    schemaVersion: "ci-annotations-used/v1",
    errors: before.errors + shown.errors,
    warnings: before.warnings + shown.warnings,
    notices: before.notices + shown.notices,
  });
  const text = yield* encodeRecord(after).pipe(CiCommandError.mapError("Failed to encode the annotation count."));
  yield* writeArtifact({
    path: path.join(repoRoot, CI_ANNOTATIONS_USED_PATH),
    body: `${text}\n`,
    onError: CiCommandError.new(`Failed to write ${CI_ANNOTATIONS_USED_PATH}.`),
  });
  return after;
});
