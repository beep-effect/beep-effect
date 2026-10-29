/**
 * Independent managed-launch cohorts projected into existing coverage contracts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ObservationCoverageInput } from "./observation-coverage.ts";
import {
  ObservationInventory,
  ObservationPopulation,
  ObservationRootBinding,
  ObservationRoute,
} from "./observation-inventory.ts";
import { makeObservationClaims, ObservationClaimAnchor, ObservationLaunchOutbox } from "./observation-launch-claims.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import type { ObservationClaimPolicy } from "./observation-launch-claims.ts";

const $I = $RepoAiMetricsId.create("observation-claim-population");
/**
 * Explicit store-route boundary; the inventory window selects claim creation time.
 * **Example** (Inspect the request)
 * ```ts
 * import { ObservationClaimPopulationRequest } from "@beep/repo-ai-metrics/observation-claim-population"
 * console.log(typeof ObservationClaimPopulationRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationClaimPopulationRequest extends S.Opaque<
  ObservationClaimPopulationRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("observation-claim-population-request/v1"),
    inventory: ObservationInventory,
    routeIds: S.NonEmptyArray(Sha256Hex).check(S.isMaxLength(256), S.isUnique()),
  }).pipe(
    $I.annoteSchema("ObservationClaimPopulationRequest", {
      description: "Explicit enrolled routes in one independent store; never all launches on a host.",
    })
  )
) {}
/**
 * Source evidence captured over an interval from immutable producer records.
 * **Example** (Inspect the evidence)
 * ```ts
 * import { ObservationClaimPopulationEvidence } from "@beep/repo-ai-metrics/observation-claim-population"
 * console.log(typeof ObservationClaimPopulationEvidence.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationClaimPopulationEvidence extends S.Opaque<
  ObservationClaimPopulationEvidence,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    scope: S.Literal("claims-created-in-window"),
    anchor: ObservationClaimAnchor,
    request: ObservationClaimPopulationRequest,
    captureStartedAt: S.DateTimeUtcFromString,
    captureFinishedAt: S.DateTimeUtcFromString,
    outboxes: S.Array(ObservationLaunchOutbox).check(S.isMaxLength(256)),
  }).pipe(
    $I.annoteSchema("ObservationClaimPopulationEvidence", {
      description: "One fence and claim cohort; lifecycle evidence may have been recorded after the cohort window.",
    })
  )
) {}
const Ids = S.Array(Sha256Hex)
  .check(S.isMaxLength(256), S.isUnique())
  .pipe($I.annoteSchema("Ids", { description: "Distinct managed attempt IDs within one bounded store." }));
const Row = S.Struct({
  routeId: Sha256Hex,
  claims: Ids,
  started: Ids,
  unresolvedStarts: Ids,
  receiptedStarts: Ids,
}).pipe(
  $I.annoteSchema("Row", {
    description: "Positive producer evidence separate from historical collector acknowledgments.",
  })
);
/**
 * Coverage input and its independently captured provenance, with unresolved intents.
 * **Example** (Inspect the report)
 * ```ts
 * import { ObservationClaimPopulationReport } from "@beep/repo-ai-metrics/observation-claim-population"
 * console.log(typeof ObservationClaimPopulationReport.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationClaimPopulationReport extends S.Opaque<
  ObservationClaimPopulationReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("observation-claim-population-report/v1"),
    evidenceId: Sha256Hex,
    evidence: ObservationClaimPopulationEvidence,
    rows: S.Array(Row).check(S.isMaxLength(256)),
    coverage: ObservationCoverageInput,
  }).pipe(
    $I.annoteSchema("ObservationClaimPopulationReport", {
      description:
        "Independent known launches and non-exhaustive historical receipt observations; event and backend populations stay unknown.",
    })
  )
) {}
/**
 * Content-free boundary or identity refusal; storage errors remain typed separately.
 * **Example** (Inspect refusal)
 * ```ts
 * import { ObservationClaimPopulationError } from "@beep/repo-ai-metrics/observation-claim-population"
 * console.log(ObservationClaimPopulationError.make({ reason: "boundary" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationClaimPopulationError extends S.TaggedError<
  ObservationClaimPopulationError,
  { readonly brand: unique symbol }
>($I`ObservationClaimPopulationError`)(
  "ObservationClaimPopulationError",
  { reason: S.Literals(["boundary", "identity"]) },
  $I.annote("ObservationClaimPopulationError", { description: "No path, owner identity or source content in refusal." })
) {}
const fail = (reason: ObservationClaimPopulationError["reason"]) => ObservationClaimPopulationError.make({ reason });
/**
 * Read one independent claim cohort without collector access or process-launch authority.
 * **Details** Two agreeing bounded scans must finish within ten seconds. A missing
 * Started observation leaves the route denominator unknown, with positive starts
 * still listed. Empty cohorts are zero only for explicitly declared store routes.
 * Unselected routes, expected telemetry events and backend visibility stay unknown.
 * Historical Started receipts are non-exhaustive collector observations, not
 * current backend queries. The original inventory remains in the evidence; its
 * denominator fields are not carried into the newly derived cohort boundary.
 * **Example** (Inspect publication)
 * ```ts
 * import { readObservationClaimPopulation } from "@beep/repo-ai-metrics/observation-claim-population"
 * console.log(typeof readObservationClaimPopulation)
 * ```
 * @category services
 * @since 0.0.0
 */
export const readObservationClaimPopulation = Effect.fn("AiMetrics.readObservationClaimPopulation")(function* (
  policy: ObservationClaimPolicy,
  request: ObservationClaimPopulationRequest,
  uid: number
) {
  const captureStartedAt = yield* DateTime.now;
  const original = request.inventory;
  const from = DateTime.toEpochMillis(original.populationWindowStart);
  const until = DateTime.toEpochMillis(original.populationWindowEnd);
  if (
    until > DateTime.toEpochMillis(captureStartedAt) ||
    !A.some(
      original.hosts,
      (host) => host.hostId === policy.anchor.hostId && host.identityNamespaceId === policy.anchor.namespaceId
    )
  )
    return yield* fail("boundary");
  for (const routeId of request.routeIds) {
    if (
      !A.some(
        original.routes,
        (route) =>
          route.routeId === routeId && route.hostId === policy.anchor.hostId && route.transport === "managed-launch"
      )
    )
      return yield* fail("boundary");
  }
  const claims = yield* makeObservationClaims(policy, uid);
  const all = yield* claims.snapshotOutboxes;
  const captureFinishedAt = yield* DateTime.now;
  if (DateTime.toEpochMillis(captureFinishedAt) < DateTime.toEpochMillis(captureStartedAt))
    return yield* fail("boundary");
  const outboxes = A.filter(all, (state) => state.claim.claimedAt >= from && state.claim.claimedAt < until);
  // An undeclared route cannot silently disappear from this store's cohort.
  for (const state of outboxes) {
    const prepared = state.claim.submission.fact;
    if (prepared._tag !== "Prepared") return yield* fail("identity");
    const route = A.findFirst(original.routes, (route) => route.routeId === prepared.identity.routeId);
    if (
      !A.contains(request.routeIds, prepared.identity.routeId) ||
      O.isNone(route) ||
      route.value.harness !== prepared.identity.harness ||
      route.value.surface !== prepared.identity.surface ||
      !S.toEquivalence(ObservationRootBinding)(route.value.root, prepared.identity.root)
    )
      return yield* fail("identity");
  }
  const evidence = ObservationClaimPopulationEvidence.make({
    scope: "claims-created-in-window",
    anchor: policy.anchor,
    request,
    captureStartedAt,
    captureFinishedAt,
    outboxes,
  });
  const evidenceId = yield* hashPublicTextSha256(
    yield* S.encodeEffect(S.fromJsonString(ObservationClaimPopulationEvidence))(evidence)
  );
  const rows = A.map(request.routeIds, (routeId) => {
    const cohort = A.filter(
      outboxes,
      (state) =>
        state.claim.submission.fact._tag === "Prepared" && state.claim.submission.fact.identity.routeId === routeId
    );
    const ids = A.map(cohort, (state) => state.claim.submission.fact.launchId);
    const started = A.map(
      A.filter(cohort, (state) => A.some(state.submissions, (entry) => entry.fact._tag === "Started")),
      (state) => state.claim.submission.fact.launchId
    );
    const receiptedStarts = A.map(
      A.filter(cohort, (state) => A.some(state.receipts, (entry) => entry.fact._tag === "Started")),
      (state) => state.claim.submission.fact.launchId
    );
    return { routeId, claims: ids, started, unresolvedStarts: A.difference(ids, started), receiptedStarts };
  });
  const unknown = ObservationPopulation.cases.Unknown.make({});
  const inventory = ObservationInventory.make({
    ...original,
    observedAt: captureFinishedAt,
    boundaryEvidenceId: evidenceId,
    routes: A.map(original.routes, (route) => {
      const row = A.findFirst(rows, (row) => row.routeId === route.routeId);
      return ObservationRoute.make({
        ...route,
        expectedEvents: unknown,
        knownLaunches:
          O.isSome(row) && row.value.unresolvedStarts.length === 0
            ? ObservationPopulation.cases.Enumerated.make({ ids: row.value.started, evidenceId })
            : unknown,
      });
    }),
  });
  const coverage = ObservationCoverageInput.make({
    inventory,
    boundaryEvidenceId: evidenceId,
    populationWindowStart: original.populationWindowStart,
    populationWindowEnd: original.populationWindowEnd,
    observedAt: captureFinishedAt,
    routes: A.map(rows, (row) => ({
      routeId: row.routeId,
      launches: { _tag: "Observed", ids: row.receiptedStarts, evidenceId, exhaustive: false },
      acceptedEvents: { _tag: "Unknown" },
      visibleEvents: { _tag: "Unknown" },
    })),
  });
  return ObservationClaimPopulationReport.make({ evidenceId, evidence, rows, coverage });
});
