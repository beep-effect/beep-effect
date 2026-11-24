/**
 * The CI projection of gate reports (`beep ci append-gate-reports`): a GitHub
 * job summary, a grouped log and annotations, rendered from the gate records a
 * job wrote and never from its log.
 *
 * **Details**
 *
 * The summary holds, per report, the same lines the local agent console
 * prints (verdict, failing items, cap line), under a 64 KiB budget, then how
 * many failing items were not annotated and the record artifact's name. The
 * log holds one `::group::` per unit after the tool's raw stream, with each
 * report's verdict line last outside any group. Annotations follow the
 * model's order and GitHub's caps: 10 per level per step and 50 per job.
 * Every tool-provided string passes through `CommandNeutralizer`, so text
 * inside a diagnostic never becomes a workflow command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Doc } from "@beep/cli-kit/Doc";
import { Render } from "@beep/cli-kit/Render";
import { ConsoleBudget, ConsoleDocument, ConsoleEntry, RecordPaths } from "@beep/gate-report/ConsoleDocument";
import { ConsoleInput, dispatch } from "@beep/gate-report/Dispatch";
import { projectLines } from "@beep/gate-report/PlainText";
import { Count, Text } from "@beep/gate-report/Scalars";
import { RunOutcome } from "@beep/gate-report/Vocabulary";
import { CommandNeutralizer } from "@beep/github-commands/CommandNeutralizer";
import { $RepoCliId } from "@beep/identity/packages";
import { RecordTarget, recordLocation } from "@beep/repo-gate-record/GatePaths";
import { foldFixesFor } from "@beep/repo-gate-run/ConsoleDefaults";
import { agentBudget, ConsoleRequest, ConsoleSettings, makeGateConsole } from "@beep/repo-gate-run/GateConsole";
import { repoPointerTableFor } from "@beep/repo-gate-run/RepoPointers";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { dual, identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import {
  annotationsUsedTotal,
  CI_ANNOTATIONS_USED_PATH,
  GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP,
  readAnnotationsUsed,
} from "./CiAnnotationsUsed.ts";
import { appendStepSummary, CiRunnerOutputsLive } from "./CiRunnerOutputs.ts";
import { findJobGateRecords, JobGateRecord } from "./CiTaskOutcomes.ts";
import type { AnnotationOptions, Block } from "@beep/cli-kit/Doc";
import type { AnnotationLevel } from "@beep/cli-kit/GithubAnnotation";
import type { FailureEntry } from "@beep/gate-report/ConsoleDocument";
import type { Item } from "@beep/gate-report/Item";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

const $I = $RepoCliId.create("commands/Ci/CiGateProjection");

/**
 * The GitHub limits the CI projection keeps, as laws of the renderer.
 *
 * **Details**
 *
 * GitHub shows at most 10 annotations of each level per step and 50 per
 * job, accepts a step summary of at most 1 MiB and shows at most 20 step
 * summaries per job. The renderer keeps the summary under its own 64 KiB
 * budget, well inside GitHub's limit. A job's workflow writes one summary
 * per gate step, so the 20-summary limit binds the workflow wiring.
 *
 * **Example** (Read the limits)
 *
 * ```ts
 * import { ciProjectionLimits } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciProjectionLimits.annotationsPerLevelPerStep) // 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiProjectionLimits extends S.Opaque<CiProjectionLimits, { readonly brand: unique symbol }>()(
  S.Struct({
    annotationsPerLevelPerStep: Count,
    annotationsPerJob: Count,
    summaryBudgetBytes: Count,
    summaryLimitBytes: Count,
    stepSummariesPerJob: Count,
  }).pipe(
    $I.annoteSchema("CiProjectionLimits", {
      description: "GitHub's annotation, step summary and summary count limits the CI projection keeps.",
    })
  )
) {}

/**
 * GitHub's limits as of the `ci-gate-reports` goal: 10 annotations per level
 * per step, 50 per job, a 64 KiB summary budget under the 1 MiB limit, 20
 * step summaries per job.
 *
 * **Example** (Read the summary budget)
 *
 * ```ts
 * import { ciProjectionLimits } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciProjectionLimits.summaryBudgetBytes) // 65536
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ciProjectionLimits: CiProjectionLimits = CiProjectionLimits.make({
  annotationsPerLevelPerStep: GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP,
  annotationsPerJob: 50,
  summaryBudgetBytes: 64 * 1024,
  summaryLimitBytes: 1024 * 1024,
  stepSummariesPerJob: 20,
});

/**
 * What one CI projection renders: the gate records a job wrote, the name of
 * the artifact that carries them, and the annotations earlier steps of the
 * job already wrote.
 *
 * **Example** (Request a projection)
 *
 * ```ts
 * import { CiProjectionRequest } from "@beep/repo-cli/commands/Ci"
 *
 * const request = CiProjectionRequest.make({ records: [], artifact: "task-outcomes-1-1-lint-shard-lint-1" })
 * console.log(request.annotationsUsed) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiProjectionRequest extends S.Opaque<CiProjectionRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    records: S.Array(JobGateRecord),
    artifact: Text,
    annotationsUsed: Count.pipe(S.withConstructorDefault(Effect.succeed(0))),
  }).pipe(
    $I.annoteSchema("CiProjectionRequest", {
      description: "The gate records a job wrote, their artifact's name and the annotations the job already wrote.",
    })
  )
) {}

/**
 * How many failing items the projection annotated, by level, and how many it
 * could not annotate under GitHub's caps.
 *
 * **Example** (Build a tally)
 *
 * ```ts
 * import { AnnotationTally } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(AnnotationTally.make({ errors: 10, warnings: 0, unannotated: 190 }).unannotated) // 190
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnnotationTally extends S.Opaque<AnnotationTally, { readonly brand: unique symbol }>()(
  S.Struct({
    errors: Count,
    warnings: Count,
    unannotated: Count,
  }).pipe(
    $I.annoteSchema("AnnotationTally", {
      description: "The failing items annotated by level and those left unannotated by GitHub's caps.",
    })
  )
) {}

/**
 * **Example** (Build a projection)
 *
 * ```ts
 * import { AnnotationTally, CiProjection } from "@beep/repo-cli/commands/Ci"
 *
 * const projection = CiProjection.make({
 *   summary: "### Gate reports",
 *   log: "",
 *   tally: AnnotationTally.make({ errors: 0, warnings: 0, unannotated: 0 }),
 * })
 * console.log(projection.tally.errors) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiProjection extends S.Opaque<CiProjection, { readonly brand: unique symbol }>()(
  S.Struct({
    summary: S.String,
    log: S.String,
    tally: AnnotationTally,
  }).pipe(
    $I.annoteSchema("CiProjection", {
      description: "A rendered CI projection: step summary Markdown, grouped log with annotations, annotation tally.",
    })
  )
) {}

const CONSOLE_SHARE_OF_SUMMARY_BYTES = 60 * 1024;
const MAX_UTF8_BYTES_PER_UTF16_UNIT = 3;
const EIGHT_AGENT_LINE_FRAME_CHARS = 8 * (agentBudget.maxLineChars + 1);
const unboundedLogBudget = ConsoleBudget.make({ ...agentBudget, maxChars: 1_000_000 });

const HEADING = "Gate reports";
const MARKDOWN_BLOCK_SEPARATOR = "\n\n";

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

const perRedReportConsoleBudget = (reds: number): ConsoleBudget =>
  ConsoleBudget.make({
    ...agentBudget,
    maxChars: Math.max(
      EIGHT_AGENT_LINE_FRAME_CHARS,
      Math.floor(CONSOLE_SHARE_OF_SUMMARY_BYTES / MAX_UTF8_BYTES_PER_UTF16_UNIT / Math.max(1, reds))
    ),
  });

const isRed = (found: JobGateRecord): boolean => !RunOutcome.is["all-pass"](found.report.outcome);

const byRedFirst = Order.mapInput(Order.Boolean, (found: JobGateRecord) => !isRed(found));

const consoleRequestOf = (found: JobGateRecord): ConsoleRequest => {
  const location = recordLocation(found.target);
  return ConsoleRequest.make({
    report: found.report,
    paths: O.map(found.logBytes, (logBytes) =>
      RecordPaths.make({ record: location.record, log: location.log, logBytes })
    ),
    pointers: O.some(repoPointerTableFor(found.target)),
  });
};

const agentConsoleLines = (found: JobGateRecord, budget: ConsoleBudget): A.NonEmptyReadonlyArray<string> =>
  Str.split(
    makeGateConsole(ConsoleSettings.make({ audience: "ci", budget })).render(consoleRequestOf(found)).text,
    "\n"
  );

const dispatchedDocumentBeforeBudget = (found: JobGateRecord): ConsoleDocument =>
  dispatch(
    ConsoleInput.make({
      report: found.report,
      pointers: repoPointerTableFor(found.target),
      fixes: foldFixesFor(found.report.subject),
    })
  );

const consoleLinesBetweenVerdicts = (
  document: ConsoleDocument,
  entries: ReadonlyArray<ConsoleEntry>,
  folds: ConsoleDocument["folds"]
): ReadonlyArray<string> =>
  A.drop(
    A.dropRight(
      projectLines({
        document: ConsoleDocument.make({ verdict: document.verdict, entries, folds }),
        budget: unboundedLogBudget,
      }),
      1
    ),
    1
  );

const isFailureEntry = ConsoleEntry.guards.FailureEntry;

const unitGroups = (found: JobGateRecord, document: ConsoleDocument): ReadonlyArray<Block> => {
  const failures = A.filter(document.entries, isFailureEntry);
  const units = A.dedupe(A.map(failures, (entry: FailureEntry) => entry.unit));
  return A.map(units, (unit) =>
    Doc.collapsible(`${found.report.gate} ${found.report.subject}: ${unit}`, [
      Doc.verbatim(
        A.join(
          consoleLinesBetweenVerdicts(
            document,
            A.filter(failures, (entry) => entry.unit === unit),
            []
          ),
          "\n"
        )
      ),
    ])
  );
};

const unitlessNoteAndFoldLines = (document: ConsoleDocument): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(document.folds) && A.every(document.entries, isFailureEntry)
    ? []
    : consoleLinesBetweenVerdicts(document, A.filter(document.entries, ConsoleEntry.guards.NoteEntry), document.folds);

type Candidate = { readonly level: AnnotationLevel; readonly options: AnnotationOptions; readonly message: string };

const firstLine = (text: string): string => A.headNonEmpty(Str.split(text, "\n"));

const repoRelativeAnnotationFile = (target: RecordTarget, file: string): O.Option<string> =>
  O.map(
    O.liftPredicate(file, P.not(Str.startsWith("/"))),
    RecordTarget.match(target, {
      PackageTarget: (pkg) => (relative: string) => `${pkg.packageDir}/${relative}`,
      RootTarget: () => identity<string>,
    })
  );

const ANNOTATION_LEVEL_BY_OUTCOME: Readonly<Record<string, AnnotationLevel>> = { failed: "error", warned: "warning" };

const codeTitleAndFirstMessageLine = (item: Item): string => {
  const head = A.join(
    A.getSomes([
      O.orElse(item.code, () => item.rule),
      O.liftPredicate(A.join(A.append(item.path, item.name), " > "), Str.isNonEmpty),
    ]),
    " "
  );
  return pipe(
    item.detail,
    O.map((detail) => firstLine(detail.message)),
    O.match({ onNone: () => head, onSome: (message) => (Str.isEmpty(head) ? message : `${head}: ${message}`) })
  );
};

const candidateOf =
  (found: JobGateRecord) =>
  (item: Item): O.Option<Candidate> =>
    O.map(R.get(ANNOTATION_LEVEL_BY_OUTCOME, item.outcome), (level): Candidate => {
      const position = O.flatMap(item.location, (location) =>
        O.map(repoRelativeAnnotationFile(found.target, location.file), (file) => ({
          file,
          line: location.line,
          col: location.column,
        }))
      );
      return {
        level,
        options: { level, title: `${found.report.gate} ${found.report.subject}`, ...O.getOrElse(position, () => ({})) },
        message: CommandNeutralizer.text(codeTitleAndFirstMessageLine(item)),
      };
    });

const candidatesOf = (found: JobGateRecord): ReadonlyArray<Candidate> =>
  A.getSomes(A.map(found.report.items, candidateOf(found)));

type Plan = {
  readonly chosen: ReadonlyArray<ReadonlyArray<Candidate>>;
  readonly tally: AnnotationTally;
};

const planAnnotationsInModelOrder = (perRecord: ReadonlyArray<ReadonlyArray<Candidate>>, used: number): Plan => {
  const limits = ciProjectionLimits;
  const initial = { chosen: A.empty<ReadonlyArray<Candidate>>(), errors: 0, warnings: 0, unannotated: 0 };
  const final = A.reduce(perRecord, initial, (state, candidates) => {
    const step = A.reduce(
      candidates,
      { kept: A.empty<Candidate>(), errors: state.errors, warnings: state.warnings, unannotated: state.unannotated },
      (acc, candidate) => {
        const levelCount = candidate.level === "error" ? acc.errors : acc.warnings;
        const fits =
          levelCount < limits.annotationsPerLevelPerStep && used + acc.errors + acc.warnings < limits.annotationsPerJob;
        return fits
          ? {
              kept: A.append(acc.kept, candidate),
              errors: acc.errors + (candidate.level === "error" ? 1 : 0),
              warnings: acc.warnings + (candidate.level === "warning" ? 1 : 0),
              unannotated: acc.unannotated,
            }
          : { ...acc, unannotated: acc.unannotated + 1 };
      }
    );
    return {
      chosen: A.append(state.chosen, step.kept),
      errors: step.errors,
      warnings: step.warnings,
      unannotated: step.unannotated,
    };
  });
  return {
    chosen: final.chosen,
    tally: AnnotationTally.make({ errors: final.errors, warnings: final.warnings, unannotated: final.unannotated }),
  };
};

const neutralizingCiContext = Render.contextOf({ audience: "ci" });

const markdownOf = (blocks: ReadonlyArray<Block>): string => Render.markdown(blocks, neutralizingCiContext);

type Fitted = { readonly sections: ReadonlyArray<string>; readonly bytes: number; readonly omitted: number };

const keepSectionsUntilOneOverflows = (sections: ReadonlyArray<string>, room: number): Fitted =>
  A.reduce(sections, { sections: A.empty<string>(), bytes: 0, omitted: 0 }, (fitted, section) => {
    const bytes = utf8Length(section) + MARKDOWN_BLOCK_SEPARATOR.length;
    return fitted.omitted === 0 && fitted.bytes + bytes <= room
      ? { sections: A.append(fitted.sections, section), bytes: fitted.bytes + bytes, omitted: 0 }
      : { ...fitted, omitted: fitted.omitted + 1 };
  });

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const footerBlocks = (request: CiProjectionRequest, tally: AnnotationTally, omitted: number): ReadonlyArray<Block> => [
  ...(omitted === 0
    ? []
    : [Doc.paragraph(`${plural(omitted, "more report is", "more reports are")} in the record artifact only.`)]),
  ...(tally.errors + tally.warnings + tally.unannotated === 0
    ? []
    : [
        Doc.paragraph(
          `Annotated ${plural(tally.errors, "error", "errors")} and ${plural(tally.warnings, "warning", "warnings")}; ${plural(
            tally.unannotated,
            "failing item was",
            "failing items were"
          )} not annotated (GitHub keeps ${ciProjectionLimits.annotationsPerLevelPerStep} per level per step and ${ciProjectionLimits.annotationsPerJob} per job).`
        ),
      ]),
  Doc.paragraph("Records: artifact ", Doc.code(request.artifact)),
];

/**
 * Render the CI projection of a job's gate records.
 *
 * **Details**
 *
 * Reports render red first, then in the feed's order. Each report's summary
 * section is its agent console, fenced, under a budget that splits 60 KiB
 * among the red reports; the footer states the annotation tally and names
 * the artifact. The log gives each report its annotations, one group per
 * unit, its notes and folds, and its verdict line last.
 *
 * UTF-8 spends at most three bytes per UTF-16 code unit, so the character
 * budget is a third of the console share in bytes, never below the eight
 * agent lines every console budget holds; the heading, fences and footer
 * fit in the 4 KiB left. Red reports come first so that, when sections must
 * be left out, the green ones go; once one section overflows, it and every
 * later one stay in the record artifact only. A package gate records
 * locations relative to its package, so an annotation prefixes the package
 * directory; an absolute path names no repository file and carries no
 * position.
 *
 * **Example** (Render an empty projection)
 *
 * ```ts
 * import { CiProjectionRequest, renderCiProjection } from "@beep/repo-cli/commands/Ci"
 *
 * const projection = renderCiProjection(CiProjectionRequest.make({ records: [], artifact: "task-outcomes-1-1-labs" }))
 * console.log(projection.log) // ""
 * ```
 *
 * @param request - The records, artifact name and annotations already used.
 * @returns The summary, log and tally.
 * @category utilities
 * @since 0.0.0
 */
export const renderCiProjection = (request: CiProjectionRequest): CiProjection => {
  const records = A.sort(request.records, byRedFirst);
  const budget = perRedReportConsoleBudget(A.filter(records, isRed).length);
  const consoles = A.map(records, (found) => agentConsoleLines(found, budget));
  const plan = planAnnotationsInModelOrder(A.map(records, candidatesOf), request.annotationsUsed);
  const heading = markdownOf([Doc.heading(3, HEADING)]);
  const sections = A.map(consoles, (lines) => markdownOf([Doc.codeBlock(A.join(lines, "\n"), "text")]));
  const room =
    ciProjectionLimits.summaryBudgetBytes -
    utf8Length(heading) -
    utf8Length(markdownOf(footerBlocks(request, plan.tally, records.length))) -
    MARKDOWN_BLOCK_SEPARATOR.length;
  const fitted = keepSectionsUntilOneOverflows(sections, room);
  const summary = A.join(
    [heading, ...fitted.sections, markdownOf(footerBlocks(request, plan.tally, fitted.omitted))],
    MARKDOWN_BLOCK_SEPARATOR
  );
  const projected = A.zipWith(
    records,
    A.zipWith(consoles, plan.chosen, (lines, chosen) => ({ lines, chosen })),
    (found, rendered) => ({ found, ...rendered })
  );
  const logBlocks = A.flatMap(projected, ({ found, lines, chosen }): ReadonlyArray<Block> => {
    const document = dispatchedDocumentBeforeBudget(found);
    const rest = unitlessNoteAndFoldLines(document);
    return [
      ...A.map(chosen, (candidate) => Doc.annotation(candidate.options, candidate.message)),
      ...unitGroups(found, document),
      ...(A.isReadonlyArrayEmpty(rest) ? [] : [Doc.verbatim(A.join(rest, "\n"))]),
      Doc.verbatim(A.headNonEmpty(lines)),
    ];
  });
  return CiProjection.make({ summary, log: Render.githubLog(logBlocks, neutralizingCiContext), tally: plan.tally });
};

/**
 * The CI projection service's operations.
 *
 * **Example** (Use the shape)
 *
 * ```ts
 * import type { CiGateProjectionShape } from "@beep/repo-cli/commands/Ci"
 *
 * const renderOf = (projection: CiGateProjectionShape) => projection.render
 * console.log(typeof renderOf) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface CiGateProjectionShape {
  readonly render: (request: CiProjectionRequest) => CiProjection;
}

/**
 * The CI projection service: renders a job's gate records as a step
 * summary, a grouped log and annotations.
 *
 * **Example** (Provide the projection)
 *
 * ```ts
 * import { CiGateProjection } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(CiGateProjection.layer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiGateProjection extends Context.Service<CiGateProjection, CiGateProjectionShape>()($I`CiGateProjection`) {
  /**
   * The projection over {@link renderCiProjection}.
   *
   * **Example** (Build the layer)
   *
   * ```ts
   * import { CiGateProjection } from "@beep/repo-cli/commands/Ci"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(CiGateProjection.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<CiGateProjection> = Layer.succeed(
    CiGateProjection,
    CiGateProjection.of({ render: renderCiProjection })
  );
}

/**
 * Print the CI projection of the gate records a job's checkout holds and
 * append its summary to the step summary.
 *
 * **Details**
 *
 * The grouped log and annotations go to stdout; the summary goes to
 * `$GITHUB_STEP_SUMMARY`, or to stdout off a runner. A checkout with no gate
 * record prints one line and appends nothing. The artifact name and the
 * annotation count are checked before the checkout is searched.
 *
 * **Example** (Inspect the use case)
 *
 * ```ts
 * import { appendGateReports } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof appendGateReports) // "function"
 * ```
 *
 * @param repoRoot - The job's checkout.
 * @param artifact - The name of the artifact that uploads the records.
 * @param annotationsUsed - Annotations earlier steps of the job wrote.
 * @returns The projection, when there was a record to project.
 * @category use-cases
 * @since 0.0.0
 */
export const appendGateReports = Effect.fn("CiGateProjection.appendGateReports")(function* (
  repoRoot: string,
  artifact: string,
  annotationsUsed: number
) {
  const empty = yield* Effect.fromOption(
    CiProjectionRequest.makeOption({ records: [], artifact, annotationsUsed }),
    () => CiCommandError.make({ message: "The artifact name must be non-empty and --annotations-used at least 0." })
  );
  const records = yield* findJobGateRecords(repoRoot);
  if (A.isReadonlyArrayEmpty(records)) {
    yield* Console.log("[ci] no gate records in this checkout; no gate report summary appended.");
    return O.none<CiProjection>();
  }
  const request = CiProjectionRequest.make({ ...empty, records });
  const projection = (yield* CiGateProjection).render(request);
  yield* Console.log(projection.log);
  yield* appendStepSummary(projection.summary, (path) => `Failed to append the gate report summary to ${path}.`);
  return O.some(projection);
});

/**
 * The annotations a job already wrote: the count given on the command line,
 * or else the count its `ci lane` steps kept.
 *
 * **Details**
 *
 * Each `ci lane` step adds the annotations its output created to
 * `.beep/ci/annotations-used.json`; a job whose steps wrote none has no file
 * and spent none.
 *
 * **Example** (Take the given count)
 *
 * ```ts
 * import { resolveAnnotationsUsed } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * console.log(typeof resolveAnnotationsUsed("/home/alice/beep-effect", O.some(3))) // "object"
 * ```
 *
 * @param repoRoot - The job's checkout.
 * @param given - The `--annotations-used` count, when one was given.
 * @returns How many annotations the job already wrote.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveAnnotationsUsed: {
  (
    given: O.Option<number>
  ): (repoRoot: string) => Effect.Effect<number, CiCommandError, FileSystem.FileSystem | Path.Path>;
  (repoRoot: string, given: O.Option<number>): Effect.Effect<number, CiCommandError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  (
    repoRoot: string,
    given: O.Option<number>
  ): Effect.Effect<number, CiCommandError, FileSystem.FileSystem | Path.Path> =>
    O.match(given, {
      onSome: Effect.succeed,
      onNone: () => Effect.map(readAnnotationsUsed(repoRoot), annotationsUsedTotal),
    })
);

/**
 * `beep ci append-gate-reports --artifact <name> [--annotations-used <n>]`.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciAppendGateReportsCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciAppendGateReportsCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciAppendGateReportsCommand = Command.make(
  "append-gate-reports",
  {
    artifact: Flag.String("artifact").pipe(Flag.withDescription("The artifact that uploads this job's gate records")),
    annotationsUsed: Flag.Int("annotations-used").pipe(
      Flag.optional,
      Flag.withDescription(
        `Annotations earlier steps of this job already wrote (default: the count \`ci lane\` steps kept in ${CI_ANNOTATIONS_USED_PATH})`
      )
    ),
  },
  ({ artifact, annotationsUsed }) =>
    findRepoRoot().pipe(
      CiCommandError.mapError("Failed to locate repository root."),
      Effect.flatMap((repoRoot) =>
        Effect.flatMap(resolveAnnotationsUsed(repoRoot, annotationsUsed), (used) =>
          appendGateReports(repoRoot, artifact, used)
        )
      ),
      Effect.asVoid,
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(
  Command.withDescription("Print this job's gate reports as a grouped log with annotations and append their summary"),
  Command.provide(Layer.merge(CiRunnerOutputsLive, CiGateProjection.layer))
);
