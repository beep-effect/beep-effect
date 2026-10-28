/**
 * Rebuildable retention reporting.
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  RetentionCalibration,
  RetentionDisposition,
  RetentionGroup,
  RetentionPolicyAdmission,
  RetentionQuery,
  RetentionReport,
  RetentionRow,
  RetentionTier,
  RetentionTierSummary,
  retentionPayloadBytes,
  retentionPolicyDigest,
} from "@beep/epistemic-domain/values/Retention";
import { canonicalDetectionJson } from "@beep/epistemics/ContradictionDetection";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { RetentionAuthorityReader, RetentionCalibrationRegistry, RetentionUnavailable } from "./Retention.ports.ts";
import type { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import type { RetentionPolicy, RetentionSnapshot } from "@beep/epistemic-domain/values/Retention";
import type * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const unavailable = (operation: string) => (_cause: unknown) =>
  RetentionUnavailable.make({ operation, message: "Retention boundary validation failed" });
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
const classify = (ageMillis: number, policy: RetentionPolicy): RetentionTier =>
  Match.value(ageMillis).pipe(
    Match.when(
      (age) => age <= policy.hotThroughMillis,
      () => RetentionTier.Enum.hot
    ),
    Match.when(
      (age) => age <= policy.warmThroughMillis,
      () => RetentionTier.Enum.warm
    ),
    Match.when(
      (age) => age <= policy.coldThroughMillis,
      () => RetentionTier.Enum.cold
    ),
    Match.orElse(() => RetentionTier.Enum.evictable)
  );
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
      const digest = yield* retentionPolicyDigest(policy).pipe(Effect.mapError(unavailable("policy")));
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
        const ageMillis = Duration.toMillis(Duration.millis(knownAt - DateTime.toEpochMillis(edge.recordedAt)));
        return RetentionRow.make({
          logicalKey: edge.logicalKey,
          edgeVersionId: edge.id,
          version: edge.version,
          sourceDisposition: endpointDisposition(snapshot, query, edge.sourceClaimId),
          targetDisposition: endpointDisposition(snapshot, query, edge.targetClaimId),
          tier: O.match(policy, {
            onNone: () => RetentionTier.Enum.unclassified,
            onSome: (p) => classify(ageMillis, p),
          }),
          ageMillis,
          payloadBytes: retentionPayloadBytes(edge.fact),
          decay: O.map(policy, (p) => 1 / (1 + ageMillis / p.decayScaleMillis)),
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
  // Recheck derived numbers and all boundary data before exposing a report.
  return yield* S.decodeEffect(RetentionReport)(yield* S.encodeEffect(RetentionReport)(report)).pipe(
    Effect.mapError(unavailable("report"))
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
  return `${canonicalDetectionJson(yield* S.encodeEffect(RetentionReport)(report).pipe(Effect.mapError(unavailable("encode"))))}\n`;
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
