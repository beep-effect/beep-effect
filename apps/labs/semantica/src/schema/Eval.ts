import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Equal, HashMap, HashSet, identity, Number as N, Option, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { F1FixtureId } from "@/fixtures/F1";
import { DegradedKind } from "@/schema/Degraded";
import { contentDigestSync, digestOmittingSync } from "@/schema/Digest";
import { Origin } from "@/schema/Document";
import { ExtractionLane } from "@/schema/Evidence";
import { GoldRef } from "@/schema/Gold";
import { DocumentId, RunId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";

const $I = $SemanticaId.create("schema/Eval");

/**
 * Canary stages exposed by the headless Semantica command.
 *
 * **Example** (Check a stage)
 *
 * ```ts
 * import { CanaryStage } from "@/schema/Eval"
 *
 * console.log(CanaryStage.is.c0("c0")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CanaryStage = LiteralKit(["c0", "c1", "c2"]).pipe(
  $I.annoteSchema("CanaryStage", {
    description: "Headless Semantica canary stages available through the lab command.",
  })
);

/**
 * Decoded Semantica canary stage.
 *
 * **Example** (Annotate a canary stage)
 *
 * ```ts
 * import type { CanaryStage } from "@/schema/Eval"
 *
 * const stage: CanaryStage = "c0"
 * console.log(stage) // "c0"
 * ```
 *
 * @see {@link CanaryStage} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type CanaryStage = typeof CanaryStage.Type;

const EvalRunBody = S.Struct({
  stage: CanaryStage,
  corpusHash: Sha256Hex,
  fixtureIndexDigest: Sha256Hex,
  gold: GoldRef,
  extractor: ModelIdentity,
  patternLane: ModelIdentity,
});

const EvalRunFields = S.Struct({
  id: RunId,
  ...EvalRunBody.fields,
});

type EvalRunFields = typeof EvalRunFields.Type;

const EvalRunChecks = S.makeFilterGroup([
  S.makeFilter((run: EvalRunFields) => !Str.Equivalence(run.gold.proposer.provider, run.extractor.provider), {
    identifier: $I`EvalRunIndependentProviders`,
    title: "Evaluation provider independence",
    description: "Requires the gold proposer and scored hosted extractor to use different provider families.",
    message: "EvalRun gold proposer provider must differ from extractor provider.",
  }),
  S.makeFilter((run: EvalRunFields) => run.extractor.taskType === "extraction", {
    identifier: $I`EvalRunExtractorTask`,
    title: "Evaluation extractor task",
    description: "Requires the hosted model identity to represent extraction rather than gold proposal.",
    message: "EvalRun extractor.taskType must equal extraction.",
  }),
  S.makeFilter(
    (run: EvalRunFields) =>
      contentDigestSync(EvalRunBody)({
        stage: run.stage,
        corpusHash: run.corpusHash,
        fixtureIndexDigest: run.fixtureIndexDigest,
        gold: run.gold,
        extractor: run.extractor,
        patternLane: run.patternLane,
      }).pipe(
        Result.match({
          onFailure: () => false,
          onSuccess: (digest) => Str.Equivalence(digest, run.id),
        })
      ),
    {
      identifier: $I`EvalRunIdentity`,
      title: "Evaluation run identity",
      description: "Requires id to hash the canonical encoded stage, corpus, gold, and model identities.",
      message: "EvalRun id must match the canonical run body digest.",
    }
  ),
]);

/**
 * Content-addressed canary protocol inputs and independent model identities.
 *
 * **Example** (Inspect the stage field)
 *
 * ```ts
 * import { EvalRun } from "@/schema/Eval"
 *
 * console.log(EvalRun.fields.stage !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvalRun extends S.Class<EvalRun>($I`EvalRun`)(
  EvalRunFields.mapFields(identity).check(EvalRunChecks),
  $I.annote("EvalRun", {
    description: "Replay-stable evaluation inputs with independent gold and hosted-extraction provider families.",
  })
) {}

/**
 * C0 correctness metric names adopted from the upstream issue-574 vocabulary.
 *
 * **Example** (Check entity span F1)
 *
 * ```ts
 * import { MetricName } from "@/schema/Eval"
 *
 * console.log(MetricName.is["entity-span-f1"]("entity-span-f1")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetricName = LiteralKit([
  "structure-span-f1",
  "entity-span-f1",
  "rebel-end-to-end-triple-f1",
  "pairwise-f1",
  "b-cubed",
]).pipe(
  $I.annoteSchema("MetricName", {
    description:
      "Structure span, entity span, REBEL-style triple, pairwise, and B-Cubed correctness metrics used by C0 (structure-span-f1 is lab-local; the rest are the #574 names the law table adopts).",
  })
);

/**
 * Decoded evaluation metric name.
 *
 * **Example** (Annotate a metric name)
 *
 * ```ts
 * import type { MetricName } from "@/schema/Eval"
 *
 * const name: MetricName = "entity-span-f1"
 * console.log(name) // "entity-span-f1"
 * ```
 *
 * @see {@link MetricName} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type MetricName = typeof MetricName.Type;

/**
 * Gold subset addressed by one metric score.
 *
 * **Example** (Check the all-documents subset)
 *
 * ```ts
 * import { MetricSubset } from "@/schema/Eval"
 *
 * console.log(MetricSubset.is.all("all")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetricSubset = LiteralKit(["structure", "entity", "relation", "all"]).pipe(
  $I.annoteSchema("MetricSubset", {
    description: "Structure, entity, relation, or all-document evaluation subset.",
  })
);

/**
 * Decoded metric subset.
 *
 * **Example** (Annotate a metric subset)
 *
 * ```ts
 * import type { MetricSubset } from "@/schema/Eval"
 *
 * const subset: MetricSubset = "relation"
 * console.log(subset) // "relation"
 * ```
 *
 * @see {@link MetricSubset} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type MetricSubset = typeof MetricSubset.Type;

/**
 * Whether a metric was scored or explicitly unsupported by the lane.
 *
 * **Example** (Check an unsupported score)
 *
 * ```ts
 * import { MetricStatus } from "@/schema/Eval"
 *
 * console.log(MetricStatus.is.unsupported("unsupported")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetricStatus = LiteralKit(["scored", "unsupported"]).pipe(
  $I.annoteSchema("MetricStatus", {
    description: "Computed score or explicit unsupported-capability status.",
  })
);

/**
 * Decoded metric status.
 *
 * **Example** (Annotate a metric status)
 *
 * ```ts
 * import type { MetricStatus } from "@/schema/Eval"
 *
 * const status: MetricStatus = "unsupported"
 * console.log(status) // "unsupported"
 * ```
 *
 * @see {@link MetricStatus} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type MetricStatus = typeof MetricStatus.Type;

const MetricScoreFields = S.Struct({
  name: MetricName,
  subset: MetricSubset,
  lane: ExtractionLane,
  status: MetricStatus,
  value: UnitInterval,
  support: NonNegativeInt,
});

const MetricScoreSupportCheck = S.makeFilter(
  (score: typeof MetricScoreFields.Type) => score.status !== "scored" || N.isGreaterThanOrEqualTo(score.support, 1),
  {
    identifier: $I`MetricScoreSupportCheck`,
    title: "Scored metric support",
    description: "Requires every computed metric score to have at least one supporting gold item.",
    message: "MetricScore support must be at least one when status is scored.",
  }
);

/**
 * One lane-specific correctness score or explicit unsupported result.
 *
 * **Example** (Inspect the support field)
 *
 * ```ts
 * import { MetricScore } from "@/schema/Eval"
 *
 * console.log(MetricScore.fields.support !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MetricScore extends S.Class<MetricScore>($I`MetricScore`)(
  MetricScoreFields.mapFields(identity).check(MetricScoreSupportCheck),
  $I.annote("MetricScore", {
    description: "Unit-interval metric value with subset, lane, support count, and explicit support status.",
  })
) {}

/**
 * One required metric/subset/lane coordinate in the stage metric table.
 *
 * **Example** (Inspect the lane field)
 *
 * ```ts
 * import { RequiredMetric } from "@/schema/Eval"
 *
 * console.log(RequiredMetric.fields.lane !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RequiredMetric extends S.Class<RequiredMetric>($I`RequiredMetric`)(
  {
    name: MetricName,
    subset: MetricSubset,
    lane: ExtractionLane,
  },
  $I.annote("RequiredMetric", {
    description: "Required evaluation coordinate composed of metric name, gold subset, and extraction lane.",
  })
) {}

const C0RequiredMetrics: ReadonlyArray<RequiredMetric> = [
  RequiredMetric.make({ name: "structure-span-f1", subset: "structure", lane: "hosted" }),
  RequiredMetric.make({ name: "structure-span-f1", subset: "structure", lane: "pattern" }),
  RequiredMetric.make({ name: "entity-span-f1", subset: "entity", lane: "hosted" }),
  RequiredMetric.make({ name: "entity-span-f1", subset: "entity", lane: "pattern" }),
  RequiredMetric.make({ name: "rebel-end-to-end-triple-f1", subset: "relation", lane: "hosted" }),
  RequiredMetric.make({ name: "rebel-end-to-end-triple-f1", subset: "relation", lane: "pattern" }),
  RequiredMetric.make({ name: "pairwise-f1", subset: "entity", lane: "hosted" }),
  RequiredMetric.make({ name: "pairwise-f1", subset: "entity", lane: "pattern" }),
  RequiredMetric.make({ name: "b-cubed", subset: "entity", lane: "hosted" }),
  RequiredMetric.make({ name: "b-cubed", subset: "entity", lane: "pattern" }),
];

/**
 * Readonly stage table of exact metric coordinates required by each canary report.
 *
 * **Details**
 *
 * C1 and C2 retain the C0 correctness floor until their own metric laws are
 * introduced; lookup is data-driven and contains no stage branches.
 *
 * **Example** (Look up C0 requirements)
 *
 * ```ts
 * import { RequiredMetrics } from "@/schema/Eval"
 * import { HashMap, Option } from "effect"
 *
 * console.log(Option.getOrThrow(HashMap.get(RequiredMetrics, "c0")).length) // 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
const RequiredMetricEntries: ReadonlyArray<readonly [CanaryStage, ReadonlyArray<RequiredMetric>]> = [
  ["c0", C0RequiredMetrics],
  ["c1", C0RequiredMetrics],
  ["c2", C0RequiredMetrics],
];

export const RequiredMetrics: HashMap.HashMap<CanaryStage, ReadonlyArray<RequiredMetric>> = HashMap.fromIterable(
  RequiredMetricEntries
);

const DocumentParseOutcome = LiteralKit(["parsed", ...DegradedKind.Options]);
const DocumentExtractionOutcome = LiteralKit(["extracted", ...DegradedKind.Options]);
const DocumentClaimCounts = S.Struct({
  entity: NonNegativeInt,
  relation: NonNegativeInt,
  structure: NonNegativeInt,
});

/**
 * Per-document parse, extraction, claim, anchor, and cache accounting.
 *
 * **Example** (Inspect the anchor-failure field)
 *
 * ```ts
 * import { DocumentOutcome } from "@/schema/Eval"
 *
 * console.log(DocumentOutcome.fields.anchorsFailed !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentOutcome extends S.Class<DocumentOutcome>($I`DocumentOutcome`)(
  {
    document: DocumentId,
    origin: Origin,
    parse: DocumentParseOutcome,
    extraction: S.Struct({
      hosted: DocumentExtractionOutcome,
      pattern: DocumentExtractionOutcome,
    }),
    chunks: NonNegativeInt,
    claims: S.Struct({
      hosted: DocumentClaimCounts,
      pattern: DocumentClaimCounts,
    }),
    degradedClaims: NonNegativeInt,
    anchorsVerified: NonNegativeInt,
    anchorsFailed: NonNegativeInt,
    cacheKeys: S.Array(Sha256Hex),
  },
  $I.annote("DocumentOutcome", {
    description:
      "Per-document accounting for parsing, both extraction lanes, claims, anchors, and provider cache keys.",
  })
) {}

const expectedF1Parse = HashMap.make(
  [F1FixtureId.make("md-structure"), "parsed"],
  [F1FixtureId.make("md-unicode"), "parsed"],
  [F1FixtureId.make("md-invalid-utf8"), "invalid-utf8"],
  [F1FixtureId.make("html-article"), "parsed"],
  [F1FixtureId.make("html-entities-tables"), "parsed"],
  [F1FixtureId.make("html-truncated"), "truncated"],
  [F1FixtureId.make("pdf-two-column"), "parsed"],
  [F1FixtureId.make("pdf-multipage"), "parsed"],
  [F1FixtureId.make("pdf-truncated"), "extraction-failed"]
);

const EvalReportFields = S.Struct({
  schemaVersion: S.Literal("eval-report/v1"),
  run: EvalRun,
  documents: S.NonEmptyArray(DocumentOutcome),
  metrics: S.NonEmptyArray(MetricScore),
  unexpectedDegraded: NonNegativeInt,
  reportDigest: Sha256Hex,
});

type EvalReportFields = typeof EvalReportFields.Type;

const metricCoordinate = (metric: Pick<MetricScore, "lane" | "name" | "subset">): string =>
  `${metric.name}:${metric.subset}:${metric.lane}`;

const hasCompleteMetrics = (report: EvalReportFields): boolean => {
  const required = HashMap.get(RequiredMetrics, report.run.stage).pipe(Option.getOrElse(() => []));
  const actualCoordinates = HashSet.fromIterable(A.map(report.metrics, metricCoordinate));
  return (
    Equal.equals(A.length(report.metrics), A.length(required)) &&
    Equal.equals(HashSet.size(actualCoordinates), A.length(report.metrics)) &&
    A.every(required, (metric) => HashSet.has(actualCoordinates, metricCoordinate(metric)))
  );
};

const patternLaneUnsupportedSubsets = HashSet.fromIterable<MetricSubset>(["relation", "structure"]);

const unsupportedMetricIsDeclared = (score: MetricScore): boolean =>
  score.status !== "unsupported" ||
  (score.lane === "pattern" && HashSet.has(patternLaneUnsupportedSubsets, score.subset));

const fixtureParseIsExpected = (document: DocumentOutcome): boolean =>
  Origin.match(document.origin, {
    W1Paper: () => true,
    Fixture: (origin) =>
      HashMap.get(expectedF1Parse, origin.fixtureId).pipe(
        Option.match({
          onNone: () => false,
          onSome: (expected) => Str.Equivalence(expected, document.parse),
        })
      ),
  });

const isUnexpectedlyDegraded = (document: DocumentOutcome): boolean =>
  Origin.match(document.origin, {
    W1Paper: () => document.parse !== "parsed" || document.extraction.hosted !== "extracted",
    Fixture: () => !fixtureParseIsExpected(document),
  });

const EvalReportChecks = S.makeFilterGroup([
  S.makeFilter(hasCompleteMetrics, {
    identifier: $I`EvalReportCompleteMetrics`,
    title: "Evaluation report metric completeness",
    description: "Requires exactly one score for every stage-required metric, subset, and lane coordinate.",
    message: "EvalReport metrics must exactly equal the stage's RequiredMetrics coordinates.",
  }),
  S.makeFilter(
    (report: EvalReportFields) =>
      A.every(report.metrics, (score) => score.lane !== "hosted" || score.status === "scored"),
    {
      identifier: $I`EvalReportHostedMetricsScored`,
      title: "Hosted evaluation metric status",
      description: "Requires every hosted-lane metric entry to carry a computed score.",
      message: "EvalReport hosted metrics must all be scored.",
    }
  ),
  S.makeFilter((report: EvalReportFields) => A.every(report.metrics, unsupportedMetricIsDeclared), {
    identifier: $I`EvalReportUnsupportedMetricsDeclared`,
    title: "Unsupported evaluation metrics",
    description:
      "Allows unsupported status only for the pattern lane's declared relation and structure capability losses.",
    message: "EvalReport unsupported metrics must match a declared pattern-lane loss.",
  }),
  S.makeFilter(
    (report: EvalReportFields) =>
      Equal.equals(A.length(A.filter(report.documents, isUnexpectedlyDegraded)), report.unexpectedDegraded),
    {
      identifier: $I`EvalReportUnexpectedDegradedArithmetic`,
      title: "Unexpected degraded document arithmetic",
      description:
        "Requires unexpectedDegraded to equal failed W1 parses/hosted extracts plus F1 expectation mismatches.",
      message: "EvalReport unexpectedDegraded must equal the derived document count.",
    }
  ),
  S.makeFilter(
    (report: EvalReportFields) => A.every(report.documents, (document) => Equal.equals(document.anchorsFailed, 0)),
    {
      identifier: $I`EvalReportAnchorsVerified`,
      title: "Evaluation report anchor verification",
      description: "Requires every reported document to have zero failed anchor verifications.",
      message: "EvalReport documents must all have anchorsFailed equal to zero.",
    }
  ),
  S.makeFilter(
    (report: EvalReportFields) =>
      digestOmittingSync(
        EvalReportFields,
        "reportDigest"
      )(report).pipe(
        Result.match({
          onFailure: () => false,
          onSuccess: (digest) => Str.Equivalence(digest, report.reportDigest),
        })
      ),
    {
      identifier: $I`EvalReportDigest`,
      title: "Evaluation report digest",
      description: "Requires reportDigest to hash the canonical encoded report after removing only reportDigest.",
      message: "EvalReport reportDigest must match the canonical field-omitting digest.",
    }
  ),
]);

/**
 * Replay-stable C0 evaluation report with complete metrics and zero failed anchors.
 *
 * **Example** (Inspect the self-digest field)
 *
 * ```ts
 * import { EvalReport } from "@/schema/Eval"
 *
 * console.log(EvalReport.fields.reportDigest !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvalReport extends S.Class<EvalReport>($I`EvalReport`)(
  EvalReportFields.mapFields(identity).check(EvalReportChecks),
  $I.annote("EvalReport", {
    description: "Content-addressed evaluation report with exact stage metrics and derived degradation accounting.",
  })
) {}
