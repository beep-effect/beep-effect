/**
 * Rebuildable retention reporting.
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  RetentionCalibration,
  RetentionDisposition,
  RetentionEvaluation,
  RetentionGroup,
  RetentionPolicy,
  RetentionPolicyAdmission,
  RetentionQuery,
  RetentionReport,
  RetentionRow,
  RetentionTier,
  RetentionTierSummary,
  retentionDecayAtAge,
  retentionPayloadBytes,
  retentionPolicyDigest,
  retentionTierAtAge,
} from "@beep/epistemic-domain/values/Retention";
import { canonicalDetectionJson } from "@beep/epistemics/ContradictionDetection";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { RetentionAuthorityReader, RetentionCalibrationRegistry, RetentionUnavailable } from "./Retention.ports.ts";
import type { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import type { RetentionSnapshot } from "@beep/epistemic-domain/values/Retention";
import type * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const unavailable =
  (operation: string) =>
  <A, R>(effect: Effect.Effect<A, S.SchemaError, R>): Effect.Effect<A, RetentionUnavailable, R> =>
    effect.pipe(
      Effect.tapError(() =>
        Effect.logWarning("Retention boundary validation failed").pipe(
          Effect.annotateLogs({ operation, errorKind: "SchemaError" })
        )
      ),
      Effect.mapError(() => RetentionUnavailable.make({ operation, message: "Retention boundary validation failed" }))
    );
const dispositionOrder = Order.combine(
  Order.mapInput(N.Order, (d: ClaimDisposition) => DateTime.toEpochMillis(d.resolvedAt)),
  Order.mapInput(N.Order, (d: ClaimDisposition) => d.id)
);
const endpointDisposition = (
  snapshot: RetentionSnapshot,
  query: RetentionQuery,
  claimId: O.Option<Epistemic.CandidateClaimId>
): RetentionDisposition =>
  O.match(claimId, {
    onNone: () => RetentionDisposition.Enum["not-applicable"],
    onSome: (id) =>
      O.getOrElse(
        O.map(
          A.last(
            A.sort(
              A.filter(
                snapshot.dispositions,
                (d) =>
                  Equal.equals(d.orgId, query.orgId) &&
                  Equal.equals(d.claimId, id) &&
                  DateTime.toEpochMillis(d.resolvedAt) <= DateTime.toEpochMillis(query.knownAt)
              ),
              dispositionOrder
            )
          ),
          (d) => d.status
        ),
        () => RetentionDisposition.Enum.unresolved
      ),
  });
const rowOrder = Order.combine(
  Order.mapInput(Str.Order, (row: RetentionRow) => row.logicalKey),
  Order.mapInput(N.Order, (row: RetentionRow) => row.version)
);
const canonicalQuery = (query: RetentionQuery) =>
  RetentionQuery.make({
    ...query,
    logicalKeys: A.sort(A.dedupe(query.logicalKeys), Str.Order),
    dispositions: A.sort(A.dedupe(query.dispositions), Str.Order),
  });

/**
 * Generate a standalone report from a scoped authority snapshot and a trusted calibration registry.
 *
 * **Details**
 * The registry is a server dependency, not request data. Missing or ineligible calibration leaves
 * all policy values inert. Payload pressure measures canonical fact bytes; it never estimates RAM.
 * Disposition filtering happens after the as-of snapshot. Requested absent keys stay visible.
 *
 * **Example** (Inspect the reporting operation)
 * ```ts
 * import { generateRetentionReport } from "@beep/epistemic-use-cases/Retention"
 * console.log(generateRetentionReport)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const generateRetentionReport = Effect.fn("Retention.generateReport")(function* (
  request: RetentionQuery,
  candidate: O.Option<RetentionPolicy>
) {
  const query = canonicalQuery(request);
  const reader = yield* RetentionAuthorityReader;
  const registry = yield* RetentionCalibrationRegistry;
  const snapshot = yield* reader.read(query);
  const knownAt = DateTime.toEpochMillis(query.knownAt);
  const validAt = DateTime.toEpochMillis(query.validAt);
  const calibration = yield* O.match(candidate, {
    onNone: () => Effect.succeedNone,
    onSome: Effect.fn("Retention.calibrate")(function* (policy: RetentionPolicy) {
      const digest = yield* retentionPolicyDigest(policy).pipe(unavailable("policy"));
      const receipt = yield* registry.find(digest, query);
      // Registry membership is necessary; all receipt bindings are also checked here.
      return O.filter(
        receipt,
        (r) =>
          S.is(RetentionCalibration)(r) &&
          r.purpose === "production" &&
          r.mechanism === "retention-v1" &&
          Equal.equals(r.orgId, query.orgId) &&
          r.policyDigest === digest &&
          DateTime.toEpochMillis(r.approvedAt) <= knownAt &&
          knownAt < DateTime.toEpochMillis(r.expiresAt)
      );
    }),
  });
  const policy = O.isSome(calibration) ? candidate : O.none<RetentionPolicy>();
  // Defense in depth: even fixture readers cannot leak another tenant, key or time window.
  const edges = A.filter(
    snapshot.edges,
    (edge) =>
      Equal.equals(edge.orgId, query.orgId) &&
      A.contains(query.logicalKeys, edge.logicalKey) &&
      DateTime.toEpochMillis(edge.validFrom) <= validAt &&
      !O.exists(edge.validTo, (end) => validAt >= DateTime.toEpochMillis(end)) &&
      DateTime.toEpochMillis(edge.recordedAt) <= knownAt &&
      !O.exists(edge.expiredAt, (end) => knownAt >= DateTime.toEpochMillis(end))
  );
  const rows = A.sort(
    A.filter(
      A.map(edges, (edge) => {
        const ageMillis = knownAt - DateTime.toEpochMillis(edge.recordedAt);
        return RetentionRow.make({
          logicalKey: edge.logicalKey,
          edgeVersionId: edge.id,
          version: edge.version,
          sourceDisposition: endpointDisposition(snapshot, query, edge.sourceClaimId),
          targetDisposition: endpointDisposition(snapshot, query, edge.targetClaimId),
          tier: O.match(policy, {
            onNone: () => RetentionTier.Enum.unclassified,
            onSome: (p) => retentionTierAtAge(ageMillis, p),
          }),
          ageMillis,
          payloadBytes: retentionPayloadBytes(edge.fact),
          decay: O.map(policy, (p) => retentionDecayAtAge(ageMillis, p)),
        });
      }),
      (row) =>
        A.isReadonlyArrayEmpty(query.dispositions) ||
        A.contains(query.dispositions, row.sourceDisposition) ||
        A.contains(query.dispositions, row.targetDisposition)
    ),
    rowOrder
  );
  const payloadBytes = A.reduce(rows, 0, (sum, row) => sum + row.payloadBytes);
  const report = RetentionReport.make({
    query,
    candidatePolicy: candidate,
    admission: O.match(O.all([policy, calibration]), {
      onNone: () => RetentionPolicyAdmission.cases.inert.make({}),
      onSome: ([policy, calibration]) => RetentionPolicyAdmission.cases.calibrated.make({ policy, calibration }),
    }),
    missingKeys: A.filter(query.logicalKeys, (key) => !A.some(edges, (edge) => edge.logicalKey === key)),
    rows,
    visibleCount: rows.length,
    payloadBytes,
    pressureRatio: O.map(policy, (p) => payloadBytes / p.payloadBudgetBytes),
    dispositions: A.map(RetentionDisposition.literals, (disposition) => {
      const bucket = A.filter(
        rows,
        (row) => row.sourceDisposition === disposition || row.targetDisposition === disposition
      );
      return RetentionGroup.make({
        disposition,
        count: bucket.length,
        payloadBytes: A.reduce(bucket, 0, (sum, row) => sum + row.payloadBytes),
      });
    }),
    tiers: A.map(RetentionTier.literals, (tier) => {
      const bucket = A.filter(rows, (row) => row.tier === tier);
      return RetentionTierSummary.make({
        tier,
        count: bucket.length,
        payloadBytes: A.reduce(bucket, 0, (sum, row) => sum + row.payloadBytes),
      });
    }),
  });
  // Revalidate field schemas before exposing a report; this does not check cross-field arithmetic.
  return yield* S.encodeEffect(RetentionReport)(report).pipe(
    Effect.flatMap(S.decodeEffect(RetentionReport)),
    unavailable("report")
  );
});

/**
 * Serialize report wire data with stable recursive key ordering and one terminal newline.
 *
 * **Example** (Inspect canonical encoder)
 * ```ts
 * import { encodeRetentionReport } from "@beep/epistemic-use-cases/Retention"
 * console.log(encodeRetentionReport)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const encodeRetentionReport = Effect.fn("Retention.encodeReport")(function* (report: RetentionReport) {
  return `${canonicalDetectionJson(yield* S.encodeEffect(RetentionReport)(report).pipe(unavailable("encode")))}\n`;
});

/**
 * Render an operator-readable report without hidden clock or filesystem metadata.
 *
 * **Example** (Inspect text renderer)
 * ```ts
 * import { renderRetentionReport } from "@beep/epistemic-use-cases/Retention"
 * console.log(renderRetentionReport)
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderRetentionReport = (report: RetentionReport): string =>
  A.join(
    [
      "Retention report (retention-v1)",
      `Organization: ${report.query.orgId}`,
      `Valid as of: ${DateTime.formatIso(report.query.validAt)}`,
      `Known as of: ${DateTime.formatIso(report.query.knownAt)}`,
      `Policy: ${report.admission.state}`,
      `Visible edges: ${report.visibleCount}`,
      `Canonical payload bytes: ${report.payloadBytes}`,
      `Budget ratio: ${O.getOrElse(
        O.map(report.pressureRatio, (ratio) => `${ratio}`),
        () => "uncalibrated"
      )}`,
      `Missing keys: ${A.join(report.missingKeys, ", ")}`,
      "Tier | Edges | Payload bytes",
      ...A.map(report.tiers, (tier) => `${tier.tier} | ${tier.count} | ${tier.payloadBytes}`),
      "Disposition | Edges | Payload bytes (distinct endpoint buckets may overlap)",
      ...A.map(report.dispositions, (d) => `${d.disposition} | ${d.count} | ${d.payloadBytes}`),
      "Edge | Version | Source disposition | Target disposition | Tier | Payload bytes",
      ...A.map(
        report.rows,
        (row) =>
          `${row.logicalKey} | ${row.version} | ${row.sourceDisposition} | ${row.targetDisposition} | ${row.tier} | ${row.payloadBytes}`
      ),
      "Advisory projections only; evictable never authorizes authority deletion.",
      "",
    ],
    "\n"
  );

/**
 * Evaluate a candidate over validated inert report rows without consulting or changing a registry.
 *
 * **Details**
 * The baseline must have inert admission and unclassified rows. Temporal, tenant and disposition
 * selection remain the report's responsibility. This result cannot be submitted as a calibration
 * receipt. No usefulness label or production eligibility is inferred from assertion age.
 *
 * **Example** (Compose offline evaluation)
 * ```ts
 * import { evaluateRetentionCandidate } from "@beep/epistemic-use-cases/Retention"
 * console.log(evaluateRetentionCandidate)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateRetentionCandidate = Effect.fn("Retention.evaluateCandidate")(function* (
  report: RetentionReport,
  candidate: RetentionPolicy
) {
  const baseline = yield* S.encodeEffect(RetentionReport)(report).pipe(
    Effect.flatMap(S.decodeEffect(RetentionReport)),
    unavailable("evaluation-baseline")
  );
  const policy = yield* S.encodeEffect(RetentionPolicy)(candidate).pipe(
    Effect.flatMap(S.decodeEffect(RetentionPolicy)),
    unavailable("evaluation-policy")
  );
  if (
    baseline.admission.state !== "inert" ||
    O.isSome(baseline.pressureRatio) ||
    A.some(baseline.rows, (row) => row.tier !== "unclassified" || O.isSome(row.decay))
  ) {
    return yield* RetentionUnavailable.make({
      operation: "evaluation-baseline",
      message: "Offline evaluation requires an inert baseline",
    });
  }
  const rows = A.map(baseline.rows, (row) =>
    RetentionRow.make({
      ...row,
      tier: retentionTierAtAge(row.ageMillis, policy),
      decay: O.some(retentionDecayAtAge(row.ageMillis, policy)),
    })
  );
  const payloadBytes = A.reduce(rows, 0, (sum, row) => sum + row.payloadBytes);
  if (payloadBytes !== baseline.payloadBytes || rows.length !== baseline.visibleCount) {
    return yield* RetentionUnavailable.make({
      operation: "evaluation-baseline",
      message: "Baseline totals disagree with selected rows",
    });
  }
  const evaluation = RetentionEvaluation.make({
    baseline,
    policy,
    policyDigest: yield* retentionPolicyDigest(policy).pipe(
      Effect.flatMap(S.decodeEffect(RetentionEvaluation.fields.policyDigest)),
      unavailable("evaluation-digest")
    ),
    rows,
    payloadBytes,
    pressureRatio: payloadBytes / policy.payloadBudgetBytes,
    tiers: A.map(RetentionTier.literals, (tier) => {
      const bucket = A.filter(rows, (row) => row.tier === tier);
      return RetentionTierSummary.make({
        tier,
        count: bucket.length,
        payloadBytes: A.reduce(bucket, 0, (sum, row) => sum + row.payloadBytes),
      });
    }),
  });
  return yield* S.encodeEffect(RetentionEvaluation)(evaluation).pipe(
    Effect.flatMap(S.decodeEffect(RetentionEvaluation)),
    unavailable("evaluation-result")
  );
});
