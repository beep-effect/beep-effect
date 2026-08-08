/**
 * Diagnostic utilities for inspecting, classifying, and summarizing Effect causes and exits.
 *
 * **Details**
 *
 * Provides transport-safe schemas and pure functions for converting runtime
 * failure information into structured diagnostics suitable for logging,
 * metrics, and error reporting.
 *
 * **Example** (Classify and summarize cause)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { classifyCause, summarizeCause } from "@beep/observability"
 *
 * const cause = Cause.fail(new Error("boom"))
 * const classification = classifyCause(cause)
 * const summary = summarizeCause(cause)
 *
 * console.log(classification) // "failure"
 * console.log(summary.primaryMessage) // "boom"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Cause, Exit, flow, Match, Number as N, pipe, Struct } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { decodeNonNegativeInt } from "./internal/decode.ts";

const $I = $ObservabilityId.create("CauseDiagnostics");

/**
 * High-level classification for a full Effect cause.
 *
 * **Details**
 *
 * One of `"empty"`, `"failure"`, `"defect"`, `"interrupted"`, or `"mixed"`.
 *
 * **Example** (Classify empty failure defect)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { classifyCause } from "@beep/observability"
 *
 * console.log(classifyCause(Cause.empty)) // "empty"
 * console.log(classifyCause(Cause.fail("err"))) // "failure"
 * console.log(classifyCause(Cause.die("bug"))) // "defect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CauseClassification = LiteralKit(["empty", "failure", "defect", "interrupted", "mixed"]).pipe(
  $I.annoteSchema("CauseClassification", {
    description: "High-level classification for a full Effect cause.",
  })
);

/**
 * Runtime type for {@link CauseClassification}.
 *
 * **Example** (Assign classification type)
 *
 * ```typescript
 * import type { CauseClassification } from "@beep/observability"
 *
 * const classification: CauseClassification = "failure"
 * console.log(classification)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CauseClassification = typeof CauseClassification.Type;

/**
 * High-level classification for an exit: `"success"` or `"failure"`.
 *
 * **Example** (Read success exit outcome)
 *
 * ```typescript
 * import { Exit } from "effect"
 * import { summarizeExit } from "@beep/observability"
 *
 * const outcome = summarizeExit(Exit.succeed("ok")).outcome
 * console.log(outcome) // "success"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExitOutcome = LiteralKit(["success", "failure"]).pipe(
  $I.annoteSchema("ExitOutcome", {
    description: "High-level classification for an exit.",
  })
);

/**
 * Runtime type for {@link ExitOutcome}.
 *
 * **Example** (Assign exit outcome type)
 *
 * ```typescript
 * import type { ExitOutcome } from "@beep/observability"
 *
 * const outcome: ExitOutcome = "success"
 * console.log(outcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExitOutcome = typeof ExitOutcome.Type;

/**
 * Deterministic string fingerprint for a cause, useful for deduplication and grouping.
 *
 * **Example** (Make cause fingerprint value)
 *
 * ```typescript
 * import { CauseFingerprint } from "@beep/observability"
 *
 * const fp = CauseFingerprint.make({ value: "failure:fail:1:error:boom" })
 * console.log(fp.value) // "failure:fail:1:error:boom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CauseFingerprint extends S.Class<CauseFingerprint>($I`CauseFingerprint`)(
  {
    value: S.String,
  },
  $I.annote("CauseFingerprint", {
    description: "Deterministic string fingerprint for a cause.",
  })
) {}

/**
 * Transport-safe summary of a full Effect cause with classification, fingerprint, and counts.
 *
 * **Example** (Summarize cause field counts)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { summarizeCause } from "@beep/observability"
 *
 * const summary = summarizeCause(Cause.fail(new Error("timeout")))
 *
 * console.log(summary.classification) // "failure"
 * console.log(summary.errorCount) // 1
 * console.log(summary.defectCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const CauseSummaryFields = {
  fingerprint: CauseFingerprint,
  reasonCount: NonNegativeInt,
  errorCount: NonNegativeInt,
  defectCount: NonNegativeInt,
  interruptCount: NonNegativeInt,
  primaryMessage: S.String,
  pretty: S.String,
};

const CauseSummaryTagged = CauseClassification.toTaggedUnion("classification")({
  empty: CauseSummaryFields,
  failure: CauseSummaryFields,
  defect: CauseSummaryFields,
  interrupted: CauseSummaryFields,
  mixed: CauseSummaryFields,
});

const CauseSummary = CauseSummaryTagged.pipe(
  $I.annoteSchema("CauseSummary", {
    description: "Summary information for a full Effect cause.",
  })
);

/**
 * Type of {@link CauseSummary}
 *
 * **Example** (Read summary classification)
 *
 * ```typescript
 * import type { CauseSummary } from "@beep/observability"
 *
 * const renderClassification = (summary: CauseSummary) => summary.classification
 * console.log(renderClassification)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CauseSummary = typeof CauseSummary.Type;

/**
 * Transport-safe summary of an exit with outcome, classification, and fingerprint.
 *
 * **Example** (Summarize success and failure)
 *
 * ```typescript
 * import { Exit, Cause } from "effect"
 * import { summarizeExit } from "@beep/observability"
 *
 * const success = summarizeExit(Exit.succeed(42))
 * console.log(success.outcome) // "success"
 *
 * const failure = summarizeExit(Exit.fail(new Error("oops")))
 * console.log(failure.outcome) // "failure"
 * console.log(failure.classification) // "failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const ObservedExitSummaryFields = {
  fingerprint: CauseFingerprint,
  interrupted: S.Boolean,
  reasonCount: NonNegativeInt,
  primaryMessage: S.String,
};

const ObservedExitSummaryTagged = CauseClassification.toTaggedUnion("classification")({
  empty: {
    outcome: ExitOutcome,
    ...ObservedExitSummaryFields,
  },
  failure: {
    outcome: S.tag(ExitOutcome.Enum.failure),
    ...ObservedExitSummaryFields,
  },
  defect: {
    outcome: S.tag(ExitOutcome.Enum.failure),
    ...ObservedExitSummaryFields,
  },
  interrupted: {
    outcome: S.tag(ExitOutcome.Enum.failure),
    ...ObservedExitSummaryFields,
  },
  mixed: {
    outcome: S.tag(ExitOutcome.Enum.failure),
    ...ObservedExitSummaryFields,
  },
});

/**
 * Summary of an observed Effect exit including outcome classification and cause analysis.
 *
 * **Example** (Decode observed exit summary)
 *
 * ```typescript
 * import { Exit } from "effect"
 * import * as S from "effect/Schema"
 * import { ObservedExitSummary, summarizeExit } from "@beep/observability"
 *
 * const summary = summarizeExit(Exit.fail(new Error("boom")))
 * const decoded = S.decodeUnknownSync(ObservedExitSummary)(summary)
 * console.log(decoded.outcome) // "failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservedExitSummary = ObservedExitSummaryTagged.pipe(
  $I.annoteSchema("ObservedExitSummary", {
    description: "Summary information for an exit.",
  })
);

/**
 * Type of {@link ObservedExitSummary}
 *
 * **Example** (Read summary outcome field)
 *
 * ```typescript
 * import type { ObservedExitSummary } from "@beep/observability"
 *
 * const renderOutcome = (summary: ObservedExitSummary) => summary.outcome
 * console.log(renderOutcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservedExitSummary = typeof ObservedExitSummary.Type;

const pipeFirstPrettyError = flow(Cause.prettyErrors, A.head);

const primaryMessageFromCause = (cause: Cause.Cause<unknown>): string =>
  pipe(
    cause,
    pipeFirstPrettyError,
    O.map(Struct.get("message")),
    O.getOrElse(() => Cause.pretty(cause))
  );

const zeroReasonCounts = {
  errorCount: 0,
  defectCount: 0,
  interruptCount: 0,
  reasonCount: 0,
};

type ReasonCounts = typeof zeroReasonCounts;
type CauseReason = Cause.Cause<unknown>["reasons"][number];

const incrementFailCounts: (counts: ReasonCounts) => ReasonCounts = flow(
  Struct.evolve({
    errorCount: N.increment,
    reasonCount: N.increment,
  })
);

const incrementDefectCounts: (counts: ReasonCounts) => ReasonCounts = flow(
  Struct.evolve({
    defectCount: N.increment,
    reasonCount: N.increment,
  })
);

const incrementInterruptCounts: (counts: ReasonCounts) => ReasonCounts = flow(
  Struct.evolve({
    interruptCount: N.increment,
    reasonCount: N.increment,
  })
);

const summarizeReason = (counts: ReasonCounts, reason: CauseReason): ReasonCounts =>
  Match.value(reason).pipe(
    Match.withReturnType<ReasonCounts>(),
    Match.tagsExhaustive({
      Die: () => incrementDefectCounts(counts),
      Fail: () => incrementFailCounts(counts),
      Interrupt: () => incrementInterruptCounts(counts),
    })
  );

const summarizeReasonCounts = flow(
  (cause: Cause.Cause<unknown>) => cause.reasons,
  A.reduce(zeroReasonCounts, summarizeReason)
);

const fingerprintChunk = flow(Str.trim, Str.replaceAll(/\s+/g, " "), Str.slice(0, 80), Str.toLowerCase);

const fingerprintValue: {
  (cause: Cause.Cause<unknown>, classification: CauseClassification): string;
  (classification: CauseClassification): (cause: Cause.Cause<unknown>) => string;
} = dual(2, (cause: Cause.Cause<unknown>, classification: CauseClassification): string => {
  const prettyErrors = Cause.prettyErrors(cause);
  const reasonTags = pipe(cause.reasons, A.map(flow(Struct.get("_tag"), Str.toLowerCase)), A.join("+"));
  const primaryChunk = pipe(
    cause,
    pipeFirstPrettyError,
    O.map(flow((error) => A.make(error.name, error.message), A.join(":"), fingerprintChunk)),
    O.getOrElse(() => pipe(cause, Cause.pretty, fingerprintChunk))
  );

  return pipe(A.make(classification, reasonTags, `${A.length(prettyErrors)}`, primaryChunk), A.join(":"));
});

const countPresentKinds = flow(
  (counts: ReasonCounts) => A.make(counts.errorCount, counts.defectCount, counts.interruptCount),
  A.filter(N.isGreaterThan(0)),
  A.length
);

const classifyReasonCounts = flow(
  O.liftPredicate<ReasonCounts>(flow(Struct.get("reasonCount"), N.isGreaterThan(0))),
  O.flatMap((counts) =>
    pipe(
      countPresentKinds(counts),
      O.liftPredicate(N.isGreaterThan(1)),
      O.as(CauseClassification.Enum.mixed),
      O.orElse(() =>
        pipe(
          A.make(
            pipe(
              counts.interruptCount,
              O.liftPredicate(N.isGreaterThan(0)),
              O.as(CauseClassification.Enum.interrupted)
            ),
            pipe(counts.defectCount, O.liftPredicate(N.isGreaterThan(0)), O.as(CauseClassification.Enum.defect))
          ),
          O.firstSomeOf,
          O.orElseSome(CauseClassification.thunk.failure)
        )
      )
    )
  ),
  O.getOrElse(CauseClassification.thunk.empty)
);

/**
 * Classify a cause by its reason makeup into a single {@link CauseClassification} label.
 *
 * **Details**
 *
 * Returns `"empty"` for empty causes, `"mixed"` when multiple reason kinds are
 * present, or the single kind (`"failure"`, `"defect"`, `"interrupted"`) otherwise.
 *
 * **Example** (Classify empty failure defect)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { classifyCause } from "@beep/observability"
 *
 * console.log(classifyCause(Cause.empty)) // "empty"
 * console.log(classifyCause(Cause.fail("err"))) // "failure"
 * console.log(classifyCause(Cause.die("bug"))) // "defect"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const classifyCause = flow(summarizeReasonCounts, classifyReasonCounts);

/**
 * Generate a deterministic fingerprint for a cause.
 *
 * **Details**
 *
 * The fingerprint combines the classification, reason tags, reason count,
 * and a truncated primary message chunk for grouping similar failures.
 *
 * **Example** (Fingerprint failed cause)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { fingerprintCause } from "@beep/observability"
 *
 * const fp = fingerprintCause(Cause.fail(new Error("connection refused")))
 * console.log(fp.value) // "failure:fail:1:error:connection refused"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const fingerprintCause = (cause: Cause.Cause<unknown>): CauseFingerprint =>
  CauseFingerprint.make({
    value: pipe(cause, fingerprintValue(classifyCause(cause))),
  });

/**
 * Summarize a cause into a transport-safe {@link CauseSummary} with classification,
 * fingerprint, reason counts, primary message, and pretty-printed output.
 *
 * **Example** (Summarize failed cause fields)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { summarizeCause } from "@beep/observability"
 *
 * const summary = summarizeCause(Cause.fail(new Error("timeout")))
 *
 * console.log(summary.classification) // "failure"
 * console.log(summary.errorCount) // 1
 * console.log(summary.primaryMessage) // "timeout"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const summarizeCause = (cause: Cause.Cause<unknown>): CauseSummary => {
  const counts = summarizeReasonCounts(cause);
  const classification = classifyReasonCounts(counts);
  const fields = {
    fingerprint: CauseFingerprint.make({
      value: fingerprintValue(cause, classification),
    }),
    reasonCount: decodeNonNegativeInt(counts.reasonCount),
    errorCount: decodeNonNegativeInt(counts.errorCount),
    defectCount: decodeNonNegativeInt(counts.defectCount),
    interruptCount: decodeNonNegativeInt(counts.interruptCount),
    primaryMessage: primaryMessageFromCause(cause),
    pretty: Cause.pretty(cause),
  };

  return pipe(
    classification,
    CauseClassification.$match({
      defect: () => CauseSummaryTagged.cases.defect.make(fields),
      empty: () => CauseSummaryTagged.cases.empty.make(fields),
      failure: () => CauseSummaryTagged.cases.failure.make(fields),
      interrupted: () => CauseSummaryTagged.cases.interrupted.make(fields),
      mixed: () => CauseSummaryTagged.cases.mixed.make(fields),
    })
  );
};

/**
 * Summarize an exit into a transport-safe {@link ObservedExitSummary}.
 *
 * **Details**
 *
 * For successful exits the outcome is `"success"` with an empty classification.
 * For failed exits the cause is analyzed via {@link summarizeCause}.
 *
 * **Example** (Summarize success and failure)
 *
 * ```typescript
 * import { Exit } from "effect"
 * import { summarizeExit } from "@beep/observability"
 *
 * const ok = summarizeExit(Exit.succeed("done"))
 * console.log(ok.outcome) // "success"
 *
 * const err = summarizeExit(Exit.fail(new Error("oops")))
 * console.log(err.outcome) // "failure"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const summarizeExit = <A, E>(exit: Exit.Exit<A, E>): ObservedExitSummary =>
  Exit.match(exit, {
    onSuccess: () =>
      ObservedExitSummaryTagged.cases.empty.make({
        outcome: ExitOutcome.Enum.success,
        fingerprint: CauseFingerprint.make({ value: "success" }),
        interrupted: false,
        reasonCount: decodeNonNegativeInt(0),
        primaryMessage: "success",
      }),
    onFailure: flow(
      (cause) => [summarizeCause(cause), cause] as const,
      ([summary, cause]) => {
        const fields = {
          outcome: ExitOutcome.Enum.failure,
          fingerprint: summary.fingerprint,
          interrupted: Cause.hasInterrupts(cause),
          reasonCount: summary.reasonCount,
          primaryMessage: summary.primaryMessage,
        };

        return pipe(
          summary.classification,
          CauseClassification.$match({
            defect: () => ObservedExitSummaryTagged.cases.defect.make(fields),
            empty: () => ObservedExitSummaryTagged.cases.empty.make(fields),
            failure: () => ObservedExitSummaryTagged.cases.failure.make(fields),
            interrupted: () => ObservedExitSummaryTagged.cases.interrupted.make(fields),
            mixed: () => ObservedExitSummaryTagged.cases.mixed.make(fields),
          })
        );
      }
    ),
  });

/**
 * Render a compact human-readable representation of a cause.
 *
 * **Details**
 *
 * Combines the classification, fingerprint, and pretty-printed cause into
 * a single multiline string suitable for console or log output.
 *
 * **Example** (Render compact cause string)
 *
 * ```typescript
 * import { Cause } from "effect"
 * import { renderObservedCause } from "@beep/observability"
 *
 * const rendered = renderObservedCause(Cause.fail(new Error("boom")))
 * console.log(rendered)
 * // [failure] failure:fail:1:error:boom
 * // Error: boom
 * // ...
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const renderObservedCause = flow(
  summarizeCause,
  (summary): string => `[${summary.classification}] ${summary.fingerprint.value}\n${summary.pretty}`
);
