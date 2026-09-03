/**
 * Schema-first machine-readable run verdict for yeet.
 *
 * Every non-plan yeet run writes one verdict document so agents can read the
 * outcome, per-lane status, and repair commands without scanning logs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { O } from "@beep/utils";
import { Effect, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import { dual, identity, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { commandTextForStep, RepoPlanStep, RepoStepRunResult } from "../../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { FlakeQuarantineIncident } from "../../Quality/internal/FlakeQuarantine.ts";
import {
  GITHUB_CHECK_RUN_REPORT_PREFIX,
  GithubCheckFailurePolicy,
  GithubCheckRunReport,
  QUALITY_TASK_LANE_RUN_REPORT_PREFIX,
  QualityTaskLaneRunReport,
} from "../../Quality/Quality.schemas.ts";
import { GIT_PUSH_STEP_ID, YeetProofTier } from "./Planner.ts";
import { knownSubLaneRemediationFromOutput } from "./QualityIssueIndex.ts";
import type { GithubCheckLaneRun, QualityTaskLaneRun } from "../../Quality/Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Verdict");
const OptionalVerdictString = S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);
const NullableInputDigest = S.OptionFromNullOr(S.String).pipe(
  SchemaUtils.withNoneDefault,
  S.withDecodingDefaultKey(Effect.succeed(null))
);

/**
 * Execution status of one planned yeet lane.
 *
 * **Example** (List the lane status options)
 *
 * ```ts
 * import { YeetLaneStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetLaneStatus.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetLaneStatus = LiteralKit([
  "passed",
  "reused",
  "failed",
  "skipped",
  "not-run",
  "not-run-early-stop",
]).pipe(
  $I.annoteSchema("YeetLaneStatus", {
    title: "Yeet Lane Status",
    description: "Execution status of one planned yeet lane.",
  })
);

/**
 * Execution status of one planned yeet lane.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetLaneStatus = typeof YeetLaneStatus.Type;

/**
 * Recorded stash identity for staged-only publish residue.
 *
 * **Example** (Construct a yeet stash state)
 *
 * ```ts
 * import { YeetStashState } from "@beep/repo-cli/test/Yeet"
 *
 * const stash = YeetStashState.make({
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   marker: "yeet-staged-only/branch/2026-06-11T00:00:00.000Z",
 *   stashSha: "0123456789abcdef",
 * })
 * console.log(stash.marker)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStashState extends S.Class<YeetStashState>($I`YeetStashState`)(
  {
    createdAt: S.String,
    marker: S.String,
    stashSha: S.String,
  },
  $I.annote("YeetStashState", {
    description: "Recorded stash identity for staged-only publish residue parking and restore.",
  })
) {}

/**
 * Divergence assessment between the publish branch and its refreshed base.
 *
 * **Example** (Construct a yeet base freshness)
 *
 * ```ts
 * import { YeetBaseFreshness } from "@beep/repo-cli/test/Yeet"
 *
 * const freshness = YeetBaseFreshness.make({
 *   behindCount: 0,
 *   mergeBase: "0123456789abcdef",
 *   overlappingPaths: [],
 * })
 * console.log(freshness.behindCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetBaseFreshness extends S.Class<YeetBaseFreshness>($I`YeetBaseFreshness`)(
  {
    behindCount: S.Finite,
    mergeBase: S.String,
    overlappingPaths: S.Array(S.String),
  },
  $I.annote("YeetBaseFreshness", {
    description: "Divergence assessment between the publish branch and its refreshed base ref.",
  })
) {}

/**
 * One planned lane with its execution status and repair command.
 *
 * **Example** (Construct a yeet verdict lane)
 *
 * ```ts
 * import { YeetVerdictLane } from "@beep/repo-cli/test/Yeet"
 *
 * const lane = YeetVerdictLane.make({
 *   id: "full:pre-push",
 *   label: "full:pre-push",
 *   phase: "full",
 *   status: "failed",
 * })
 * console.log(lane.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetVerdictLane extends S.Class<YeetVerdictLane>($I`YeetVerdictLane`)(
  {
    id: S.String,
    label: S.String,
    phase: S.String,
    status: YeetLaneStatus,
    durationMs: S.optionalKey(S.Finite),
    peakRssKb: S.optionalKey(S.Finite),
    exitCode: S.optionalKey(S.Finite),
    repairCommand: S.optionalKey(S.String),
    tier: YeetProofTier.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    startedAt: OptionalVerdictString,
    endedAt: OptionalVerdictString,
    inputDigest: NullableInputDigest,
  },
  $I.annote("YeetVerdictLane", {
    description: "One planned yeet lane with its execution status and repair command.",
  })
) {}

/**
 * Terminal outcome for one yeet run.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetOutcome = LiteralKit(["success", "failure"]).pipe(
  $I.annoteSchema("YeetOutcome", {
    description: "Terminal outcome for one yeet run.",
  })
);

/**
 * Failure classification retained when a Yeet attempt terminates unsuccessfully.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetFailureKind = LiteralKit(["step-exit", "handler-error"]).pipe(
  $I.annoteSchema("YeetFailureKind", {
    description: "Whether a Yeet attempt failed through a returned step result or the handler error channel.",
  })
);

/**
 * One hard criterion of the merge protocol, named when it is the blocker.
 *
 * **Details**
 *
 * Only hard criteria appear here. The Greptile score is a displayed
 * target rather than a gate, so it is carried on
 * {@link YeetMergeReadyCriteria} for the operator to read and can never be the
 * value of {@link YeetMergeReady.failing}.
 *
 * **Example** (List the merge-ready criteria)
 *
 * ```ts
 * import { YeetMergeReadyCriterion } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMergeReadyCriterion.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMergeReadyCriterion = LiteralKit([
  "pr-open",
  "not-draft",
  "closeout-run",
  "required-checks-green",
  "threads-resolved",
  "mergeable",
  "merge-state-acceptable",
  "review-decision-acceptable",
]).pipe(
  $I.annoteSchema("YeetMergeReadyCriterion", {
    title: "Yeet Merge Ready Criterion",
    description: "One hard criterion of the truthful merge protocol.",
  })
);

/**
 * One hard criterion of the merge protocol.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMergeReadyCriterion = typeof YeetMergeReadyCriterion.Type;

/**
 * The observed state of each merge-protocol criterion.
 *
 * **Example** (Construct merge-ready criteria)
 *
 * ```ts
 * import { YeetMergeReadyCriteria } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const criteria = YeetMergeReadyCriteria.make({
 *   prOpen: true,
 *   notDraft: true,
 *   closeoutRun: true,
 *   requiredChecksGreen: true,
 *   threadsResolved: false,
 *   mergeable: true,
 *   mergeStateAcceptable: true,
 *   reviewDecisionAcceptable: true,
 *   greptileScore: O.some("5/5"),
 * })
 * console.log(criteria.requiredChecksGreen)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMergeReadyCriteria extends S.Class<YeetMergeReadyCriteria>($I`YeetMergeReadyCriteria`)(
  {
    prOpen: S.Boolean,
    notDraft: S.Boolean,
    closeoutRun: S.Boolean,
    requiredChecksGreen: S.Boolean,
    threadsResolved: S.Boolean,
    mergeable: S.Boolean,
    mergeStateAcceptable: S.Boolean,
    reviewDecisionAcceptable: S.Boolean,
    greptileScore: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetMergeReadyCriteria", {
    description: "Observed state of every truthful merge-protocol criterion; the Greptile score is display-only.",
  })
) {}

/**
 * Whether one hard merge-protocol criterion is satisfied in an observed set.
 *
 * **Example** (Read one criterion)
 *
 * ```ts
 * import { mergeReadyCriterionHolds, YeetMergeReadyCriteria } from "@beep/repo-cli/test/Yeet"
 *
 * const criteria = YeetMergeReadyCriteria.make({
 *   prOpen: true, notDraft: true, closeoutRun: true, requiredChecksGreen: false,
 *   threadsResolved: true, mergeable: true, mergeStateAcceptable: true, reviewDecisionAcceptable: true
 * })
 * console.log(mergeReadyCriterionHolds(criteria, "required-checks-green")) // false
 * ```
 *
 * @param criteria - Observed state of every merge-protocol criterion.
 * @param criterion - The criterion to read.
 * @returns Whether the named criterion holds.
 * @category predicates
 * @since 0.0.0
 */
export const mergeReadyCriterionHolds: {
  (criterion: YeetMergeReadyCriterion): (criteria: YeetMergeReadyCriteria) => boolean;
  (criteria: YeetMergeReadyCriteria, criterion: YeetMergeReadyCriterion): boolean;
} = dual(2, (criteria: YeetMergeReadyCriteria, criterion: YeetMergeReadyCriterion): boolean =>
  YeetMergeReadyCriterion.$match(criterion, {
    "pr-open": () => criteria.prOpen,
    "not-draft": () => criteria.notDraft,
    "closeout-run": () => criteria.closeoutRun,
    "required-checks-green": () => criteria.requiredChecksGreen,
    "threads-resolved": () => criteria.threadsResolved,
    mergeable: () => criteria.mergeable,
    "merge-state-acceptable": () => criteria.mergeStateAcceptable,
    "review-decision-acceptable": () => criteria.reviewDecisionAcceptable,
  })
);

/**
 * Cross-field requirement that the three merge-readiness surfaces agree.
 *
 * `ready`, `failing`, and `criteria` restate one fact three ways, so without a
 * filter a document could decode cleanly while carrying
 * `{"ready":true,"failing":"checks-green"}` — an answer and its own refutation.
 * Whoever read the field they trusted would act on the wrong one, and nothing
 * would attribute the contradiction back to the writer that produced it. The
 * issue is reported at `failing` because that is the field an operator reads to
 * decide what to do next.
 */
const YeetMergeReadyCoherenceCheck = S.makeFilter(
  (value: {
    readonly ready: boolean;
    readonly failing: O.Option<YeetMergeReadyCriterion>;
    readonly criteria: YeetMergeReadyCriteria;
  }) =>
    O.match(value.failing, {
      onNone: () =>
        value.ready &&
        A.every(YeetMergeReadyCriterion.Options, (criterion) => mergeReadyCriterionHolds(value.criteria, criterion))
          ? undefined
          : {
              path: ["failing"],
              issue:
                "A merge-ready verdict naming no failing criterion must be ready with every hard criterion satisfied.",
            },
      onSome: (criterion) =>
        !value.ready && !mergeReadyCriterionHolds(value.criteria, criterion)
          ? undefined
          : {
              path: ["failing"],
              issue: `A merge-ready verdict blocked on ${criterion} must not be ready and must record ${criterion} as unsatisfied.`,
            },
    }),
  {
    identifier: $I`YeetMergeReadyCoherenceCheck`,
    title: "Yeet merge readiness coherence",
    description: "Merge readiness must agree with the named blocking criterion and the observed criteria.",
  }
);

const YeetMergeReadyEncoded = S.Struct({
  ready: S.Boolean,
  failing: S.Union([YeetMergeReadyCriterion, S.Literal("checks-green")]).pipe(S.optionalKey),
  criteria: S.Struct({
    prOpen: S.optionalKey(S.Boolean),
    notDraft: S.optionalKey(S.Boolean),
    closeoutRun: S.optionalKey(S.Boolean),
    requiredChecksGreen: S.optionalKey(S.Boolean),
    checksGreen: S.optionalKey(S.Boolean),
    threadsResolved: S.Boolean,
    mergeable: S.optionalKey(S.Boolean),
    mergeStateAcceptable: S.optionalKey(S.Boolean),
    reviewDecisionAcceptable: S.optionalKey(S.Boolean),
    greptileScore: S.optionalKey(S.String),
  }),
}).pipe(
  $I.annoteSchema("YeetMergeReadyEncoded", {
    description: "Encoded merge readiness shape accepted from current and legacy v2 verdict artifacts.",
  })
);

type EncodedMergeReady = typeof YeetMergeReadyEncoded.Type;

const normalizeLegacyMergeReadyCriteria = (value: EncodedMergeReady) => ({
  prOpen: value.criteria.prOpen ?? false,
  notDraft: value.criteria.notDraft ?? false,
  closeoutRun: value.criteria.closeoutRun ?? false,
  requiredChecksGreen: value.criteria.requiredChecksGreen ?? false,
  threadsResolved: value.criteria.threadsResolved,
  mergeable: value.criteria.mergeable ?? false,
  mergeStateAcceptable: value.criteria.mergeStateAcceptable ?? false,
  reviewDecisionAcceptable: value.criteria.reviewDecisionAcceptable ?? false,
  ...O.getSomesStruct({ greptileScore: O.fromUndefinedOr(value.criteria.greptileScore) }),
});

const legacyMergeReadyCriteriaComplete = (value: EncodedMergeReady): boolean =>
  value.criteria.prOpen !== undefined &&
  value.criteria.notDraft !== undefined &&
  value.criteria.closeoutRun !== undefined &&
  value.criteria.requiredChecksGreen !== undefined &&
  value.criteria.mergeable !== undefined &&
  value.criteria.mergeStateAcceptable !== undefined &&
  value.criteria.reviewDecisionAcceptable !== undefined;

const normalizeLegacyYeetMergeReady = (value: typeof YeetMergeReadyEncoded.Type): typeof YeetMergeReady.Encoded => {
  const criteria = normalizeLegacyMergeReadyCriteria(value);
  const complete = legacyMergeReadyCriteriaComplete(value);
  const firstFailing = A.findFirst(
    YeetMergeReadyCriterion.Options,
    (criterion) =>
      !mergeReadyCriterionHolds(
        YeetMergeReadyCriteria.make({
          ...criteria,
          greptileScore: O.fromUndefinedOr(value.criteria.greptileScore),
        }),
        criterion
      )
  );
  const encodedFailing = O.fromUndefinedOr(value.failing);
  const currentFailing = O.map(encodedFailing, (criterion) =>
    criterion === "checks-green" ? YeetMergeReadyCriterion.Enum["required-checks-green"] : criterion
  );
  return {
    ready: complete ? value.ready : false,
    ...O.getSomesStruct({ failing: complete ? currentFailing : firstFailing }),
    criteria,
  };
};

/**
 * Merge readiness as data: the verdict plus the criterion that blocks it.
 *
 * **Details**
 *
 * The merge protocol is otherwise enforced by a human reading three surfaces
 * that status and monitor already fetch. Folding them into one record with a
 * named blocker is what lets `--until-merged` decide without re-deriving the
 * protocol at every call site. Legacy v2 records without `closeoutRun` are
 * admitted at decode boundaries by {@link YeetMergeReadyFromEncoded}.
 *
 * **Gotchas**
 *
 * The three fields are mutually derivable, so a cross-field check makes an
 * incoherent record undecodable rather than merely wrong: `ready` is true
 * exactly when `failing` is `None` and all three hard criteria hold, and a named
 * `failing` criterion must be the one recorded as unsatisfied. The Greptile
 * score is display-only and is not part of the check.
 *
 * **Example** (Construct a blocked merge-ready verdict)
 *
 * ```ts
 * import { YeetMergeReady, YeetMergeReadyCriteria } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const mergeReady = YeetMergeReady.make({
 *   ready: false,
 *   failing: O.some("threads-resolved"),
 *   criteria: YeetMergeReadyCriteria.make({
 *     prOpen: true, notDraft: true, closeoutRun: true, requiredChecksGreen: true,
 *     threadsResolved: false, mergeable: true, mergeStateAcceptable: true, reviewDecisionAcceptable: true
 *   }),
 * })
 * console.log(mergeReady.ready)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMergeReady extends S.Class<YeetMergeReady>($I`YeetMergeReady`)(
  S.Struct({
    ready: S.Boolean,
    failing: YeetMergeReadyCriterion.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    criteria: YeetMergeReadyCriteria,
  }).pipe(S.check(YeetMergeReadyCoherenceCheck)),
  $I.annote("YeetMergeReady", {
    description: "Merge readiness as data, naming the criterion that blocks the merge when one does.",
  })
) {}

/**
 * Merge-readiness codec that admits legacy v2 verdict artifacts.
 *
 * **Details**
 *
 * Artifacts written before `closeoutRun` existed carry a two-field
 * `criteria`; decoding through the class alone would reject them outright.
 * This codec accepts the legacy encoded shape, supplies `closeoutRun: false`,
 * and downgrades a formerly ready record to `failing: "closeout-run"` before
 * the coherence check runs, so old readiness is safely blocked while the
 * artifact's outcome and repair guidance stay readable. Construction stays on
 * {@link YeetMergeReady} — this codec exists only at decode boundaries.
 *
 * **Example** (Decode a legacy merge-ready record)
 *
 * ```ts
 * import { YeetMergeReadyFromEncoded } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const legacy = { ready: true, criteria: { checksGreen: true, threadsResolved: true } }
 * const decoded = S.decodeUnknownSync(YeetMergeReadyFromEncoded)(legacy)
 * console.log(decoded.ready) // false
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetMergeReadyFromEncoded = YeetMergeReadyEncoded.pipe(
  S.decodeTo(
    YeetMergeReady,
    SchemaTransformation.transform<typeof YeetMergeReady.Encoded, typeof YeetMergeReadyEncoded.Type>({
      decode: normalizeLegacyYeetMergeReady,
      encode: identity,
    })
  ),
  $I.annoteSchema("YeetMergeReadyFromEncoded", {
    description: "Merge readiness with safe normalization for legacy v2 verdict artifacts.",
  })
);

/**
 * Machine-readable verdict for one yeet run.
 *
 * **Gotchas**
 *
 * Attempt identity, immutable input facts (`resolvedHeadSha`,
 * `diffFingerprint`, `proofTier`), and the run-timing trio (`startedAt`,
 * `endedAt`, `elapsedMs`) are `Option`-typed optional keys. Verdict documents
 * written before those facts landed still decode as `None`; current attempt
 * writers supply every fact.
 *
 * **Example** (Construct a yeet verdict)
 *
 * ```ts
 * import { YeetVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetVerdict.make({
 *   schemaVersion: "yeet-verdict/v2",
 *   attemptId: O.some("550e8400-e29b-41d4-a716-446655440000"),
 *   base: "origin/main",
 *   branch: "feature",
 *   committed: false,
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   startedAt: O.some("2026-06-11T00:00:00.000Z"),
 *   endedAt: O.some("2026-06-11T00:00:01.000Z"),
 *   elapsedMs: O.some(1000),
 *   head: "HEAD",
 *   lanes: [],
 *   message: "yeet verification proof passed.",
 *   mode: "verify",
 *   outcome: "success",
 *   packetPaths: [],
 *   pushed: false,
 *   runId: "feature",
 * })
 * console.log(verdict.outcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetVerdict extends S.Class<YeetVerdict>($I`YeetVerdict`)(
  {
    schemaVersion: S.Literal("yeet-verdict/v2"),
    base: S.String,
    branch: S.String,
    committed: S.Boolean,
    createdAt: S.String,
    failurePolicy: GithubCheckFailurePolicy.pipe(
      S.withConstructorDefault(Effect.succeed(GithubCheckFailurePolicy.Enum["fail-fast"])),
      S.withDecodingDefault(Effect.succeed(GithubCheckFailurePolicy.Enum["fail-fast"]))
    ),
    head: S.String,
    lanes: S.Array(YeetVerdictLane),
    message: S.String,
    mode: S.String,
    outcome: YeetOutcome,
    packetPaths: S.Array(S.String),
    pushed: S.Boolean,
    runId: S.String,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    resolvedHeadSha: OptionalVerdictString,
    diffFingerprint: OptionalVerdictString,
    proofTier: YeetProofTier.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    startedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    endedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    elapsedMs: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    indexPath: S.optionalKey(S.String),
    baseFreshness: S.optionalKey(YeetBaseFreshness),
    stash: S.optionalKey(YeetStashState),
    flakeQuarantine: FlakeQuarantineIncident.pipe(S.Array, S.optionalKey),
    failedStepId: S.optionalKey(S.String),
    failureKind: YeetFailureKind.pipe(S.optionalKey),
    mergeReady: YeetMergeReadyFromEncoded.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetVerdict", {
    description: "Machine-readable verdict for one yeet run, including per-lane repair commands.",
  })
) {}

/**
 * JSON-string codec for the `verdict.json` artifact.
 *
 * **Gotchas**
 *
 * Every writer of the verdict artifact must go through this codec. Rendering a
 * decoded {@link YeetVerdict} with a generic JSON encoder serializes its
 * `Option` fields as their runtime representation
 * (`{"_id":"Option","_tag":"Some","value":…}`), which no longer decodes — the
 * failure surfaces much later as `verdict artifact could not be decoded` from
 * `yeet status`, with nothing pointing back at the writer.
 *
 * **Example** (Round-trip a verdict)
 *
 * ```ts
 * import { YeetVerdict, YeetVerdictJson } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetVerdict.make({
 *   schemaVersion: "yeet-verdict/v2",
 *   attemptId: O.some("550e8400-e29b-41d4-a716-446655440000"),
 *   base: "origin/main",
 *   branch: "feature",
 *   committed: false,
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   head: "HEAD",
 *   lanes: [],
 *   message: "yeet verification proof passed.",
 *   mode: "verify",
 *   outcome: "success",
 *   packetPaths: [],
 *   pushed: false,
 *   runId: "feature",
 * })
 * console.log(Effect.runSync(YeetVerdictJson.encode(verdict)))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetVerdictJson = JsonStringCodec(YeetVerdict);

/**
 * One executed plan step paired with its run result.
 *
 * **Example** (Inspect the executed step schema)
 *
 * ```ts
 * import { YeetExecutedStep } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetExecutedStep.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetExecutedStep extends S.Class<YeetExecutedStep>($I`YeetExecutedStep`)(
  {
    durationMs: S.optionalKey(S.Finite),
    result: RepoStepRunResult,
    step: RepoPlanStep,
  },
  $I.annote("YeetExecutedStep", {
    description: "One executed yeet plan step paired with its run result.",
  })
) {}

const laneFromExecuted = (executed: YeetExecutedStep, tier: O.Option<YeetProofTier>): YeetVerdictLane => {
  const failed = executed.result.exitCode !== 0;
  const repairCommand = failed
    ? O.some(
        pipe(
          knownSubLaneRemediationFromOutput(executed.result.output),
          O.getOrElse(() => commandTextForStep(executed.step))
        )
      )
    : O.none<string>();
  return YeetVerdictLane.make({
    id: executed.step.id,
    label: executed.step.label,
    phase: executed.step.phase,
    status: failed ? "failed" : "passed",
    exitCode: executed.result.exitCode,
    tier,
    inputDigest: O.none(),
    ...O.getSomesStruct({
      durationMs: pipe(
        O.fromUndefinedOr(executed.result.elapsedMs),
        O.orElse(() => O.fromUndefinedOr(executed.durationMs))
      ),
      peakRssKb: O.fromUndefinedOr(executed.result.peakRssKb),
      repairCommand,
    }),
  });
};

const laneFromPlanned = (step: RepoPlanStep, tier: O.Option<YeetProofTier>): YeetVerdictLane =>
  YeetVerdictLane.make({
    id: step.id,
    label: step.label,
    phase: step.phase,
    status: "not-run",
    tier,
    inputDigest: O.none(),
  });

const githubCheckRunReportJson = JsonStringCodec(GithubCheckRunReport);
const qualityTaskLaneRunReportJson = JsonStringCodec(QualityTaskLaneRunReport);

const githubCheckRunReportFromOutput = (output: string): O.Option<GithubCheckRunReport> =>
  pipe(
    Str.split("\n")(output),
    A.findLast(Str.startsWith(GITHUB_CHECK_RUN_REPORT_PREFIX)),
    O.flatMap((line) => githubCheckRunReportJson.decodeOption(Str.slice(GITHUB_CHECK_RUN_REPORT_PREFIX.length)(line)))
  );

const qualityTaskLaneRunReportFromOutput = (output: string): O.Option<QualityTaskLaneRunReport> =>
  pipe(
    Str.split("\n")(output),
    A.findLast(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
    O.flatMap((line) =>
      qualityTaskLaneRunReportJson.decodeOption(Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(line))
    )
  );

const laneFromGithubCheckRun = (lane: GithubCheckLaneRun, tier: O.Option<YeetProofTier>): YeetVerdictLane =>
  YeetVerdictLane.make({
    id: lane.id,
    label: lane.id,
    phase: "full",
    status: lane.status,
    tier,
    inputDigest: O.none(),
  });

const laneFromQualityTaskRun = (lane: QualityTaskLaneRun, tier: O.Option<YeetProofTier>): YeetVerdictLane =>
  YeetVerdictLane.make({
    id: lane.id,
    label: lane.label,
    phase: "full",
    status: lane.status,
    tier,
    inputDigest: lane.inputDigest,
    startedAt: lane.startedAt,
    endedAt: lane.endedAt,
    ...O.getSomesStruct({
      durationMs: lane.durationMs,
      exitCode: lane.exitCode,
    }),
  });

const innerLanesFromOutput = (output: string, tier: O.Option<YeetProofTier>): ReadonlyArray<YeetVerdictLane> =>
  pipe(
    qualityTaskLaneRunReportFromOutput(output),
    O.match({
      onNone: () =>
        pipe(
          githubCheckRunReportFromOutput(output),
          O.map((report) => A.map(report.lanes, (lane) => laneFromGithubCheckRun(lane, tier))),
          O.getOrElse(A.empty<YeetVerdictLane>)
        ),
      onSome: (report) => A.map(report.lanes, (lane) => laneFromQualityTaskRun(lane, tier)),
    })
  );

/**
 * Run identity, outcome, planned steps, and executed results used to build the run verdict.
 *
 * @category models
 * @since 0.0.0
 */
export class BuildYeetVerdictInput extends S.Class<BuildYeetVerdictInput>($I`BuildYeetVerdictInput`)(
  {
    base: S.String,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    resolvedHeadSha: OptionalVerdictString,
    diffFingerprint: OptionalVerdictString,
    proofTier: YeetProofTier.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    baseFreshness: S.optionalKey(YeetBaseFreshness),
    branch: S.String,
    createdAt: S.String,
    startedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    endedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    elapsedMs: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    executed: S.Array(YeetExecutedStep),
    failurePolicy: GithubCheckFailurePolicy.pipe(
      S.withConstructorDefault(Effect.succeed(GithubCheckFailurePolicy.Enum["fail-fast"]))
    ),
    flakeQuarantine: FlakeQuarantineIncident.pipe(S.Array, S.optionalKey),
    head: S.String,
    indexPath: S.optionalKey(S.String),
    message: S.String,
    mode: S.String,
    outcome: YeetOutcome,
    packetPaths: S.Array(S.String),
    planned: S.Array(RepoPlanStep),
    runId: S.String,
    stash: S.optionalKey(YeetStashState),
    failedStepId: S.optionalKey(S.String),
    failureKind: S.optionalKey(YeetFailureKind),
    mergeReady: S.optionalKey(YeetMergeReady),
  },
  $I.annote("BuildYeetVerdictInput", {
    description: "Run identity, outcome, planned steps, and executed results used to build the run verdict.",
  })
) {}

/**
 * Build the run verdict from planned steps and executed results.
 *
 * **Example** (Build a yeet verdict)
 *
 * ```ts
 * import { BuildYeetVerdictInput, buildYeetVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = buildYeetVerdict(BuildYeetVerdictInput.make({
 *   attemptId: O.some("550e8400-e29b-41d4-a716-446655440000"),
 *   base: "origin/main",
 *   branch: "feature",
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   startedAt: O.some("2026-06-11T00:00:00.000Z"),
 *   endedAt: O.some("2026-06-11T00:00:01.000Z"),
 *   elapsedMs: O.some(1000),
 *   executed: [],
 *   head: "HEAD",
 *   message: "yeet verification proof passed.",
 *   mode: "verify",
 *   outcome: "success",
 *   packetPaths: [],
 *   planned: [],
 *   runId: "feature",
 * }))
 * console.log(verdict.lanes.length)
 * ```
 *
 * @param input - Run identity, outcome, planned steps, and executed results.
 * @returns Schema-valid verdict document for the run.
 * @category constructors
 * @since 0.0.0
 */
export const buildYeetVerdict = (input: BuildYeetVerdictInput): YeetVerdict => {
  const executedIds = pipe(
    input.executed,
    A.map((entry) => entry.step.id)
  );
  const lanes = pipe(
    input.executed,
    A.map((entry) => laneFromExecuted(entry, input.proofTier)),
    A.appendAll(
      pipe(
        input.executed,
        A.flatMap((entry) =>
          pipe(
            O.fromUndefinedOr(entry.result.output),
            O.map((output) => innerLanesFromOutput(output, input.proofTier)),
            O.getOrElse(A.empty<YeetVerdictLane>)
          )
        )
      )
    ),
    A.appendAll(
      pipe(
        input.planned,
        A.filter((step) => !A.contains(executedIds, step.id)),
        A.map((step) => laneFromPlanned(step, input.proofTier))
      )
    )
  );
  return YeetVerdict.make({
    schemaVersion: "yeet-verdict/v2",
    base: input.base,
    branch: input.branch,
    committed: pipe(
      input.executed,
      A.some((entry) => entry.step.phase === "commit" && entry.result.exitCode === 0)
    ),
    createdAt: input.createdAt,
    failurePolicy: input.failurePolicy,
    head: input.head,
    lanes,
    message: input.message,
    mode: input.mode,
    outcome: input.outcome,
    packetPaths: input.packetPaths,
    pushed: pipe(
      input.executed,
      A.some((entry) => entry.step.id === GIT_PUSH_STEP_ID && entry.result.exitCode === 0)
    ),
    runId: input.runId,
    attemptId: input.attemptId,
    resolvedHeadSha: input.resolvedHeadSha,
    diffFingerprint: input.diffFingerprint,
    proofTier: input.proofTier,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    elapsedMs: input.elapsedMs,
    mergeReady: O.fromUndefinedOr(input.mergeReady),
    ...O.getSomesStruct({
      indexPath: O.fromUndefinedOr(input.indexPath),
      baseFreshness: O.fromUndefinedOr(input.baseFreshness),
      stash: O.fromUndefinedOr(input.stash),
      flakeQuarantine: pipe(O.fromUndefinedOr(input.flakeQuarantine), O.filter(A.isReadonlyArrayNonEmpty)),
      failedStepId: O.fromUndefinedOr(input.failedStepId),
      failureKind: O.fromUndefinedOr(input.failureKind),
    }),
  });
};

/**
 * Build the run verdict from planned steps and executed results.
 *
 * @category testing
 * @since 0.0.0
 */
export const buildYeetVerdictForTesting = buildYeetVerdict;
