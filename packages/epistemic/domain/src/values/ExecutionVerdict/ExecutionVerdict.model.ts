/**
 * Execution verdict vocabulary: bounded denial reasons, the allowed/denied
 * verdict union, and the three-way egress classification.
 *
 * Denial reasons are a closed literal domain, never free text — free text is a
 * payload-smuggling channel into a no-payload ledger (exploration decision 4).
 * Guidance is a constant per reason from a total lookup, never interpolated
 * with request data. Reasons are recorded and logged but never returned to the
 * agent (exploration decision 13): a differential denial reason is an oracle
 * an attacker can use to reconstruct the grant set by enumeration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as S from "effect/Schema";
import { GrantOperation, SinkAudience, SinkClass, SinkDestination } from "../ExecutionGrant/index.ts";

const $I = $EpistemicDomainId.create("values/ExecutionVerdict/ExecutionVerdict.model");

/**
 * Bounded denial reasons. Eight are produced by the pure evaluator; two —
 * `no-grant-in-scope` and `ledger-unavailable` — are produced only at the
 * enforcement boundary (no frozen grant set exists, or the write-ahead
 * decision write failed). See {@link evaluatorDenialReasons} and
 * {@link boundaryDenialReasons} for the split.
 *
 * **Example** (Usage)
 * ```ts
 * import { DenialReason } from "@beep/epistemic-domain"
 *
 * console.log(DenialReason.Enum["grant-expired"])
 * // "grant-expired"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DenialReason = LiteralKit([
  "no-grant-in-scope",
  "grant-set-digest-mismatch",
  "principal-not-granted",
  "operation-not-granted",
  "sink-class-not-granted",
  "audience-not-granted",
  "destination-not-granted",
  "grant-expired",
  "policy-revision-mismatch",
  "ledger-unavailable",
]).pipe(
  $I.annoteSchema("DenialReason", {
    description: "Closed denial-reason domain; recorded and logged, never returned to the agent.",
  })
);

/**
 * Runtime type for {@link DenialReason}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { DenialReason } from "@beep/epistemic-domain"
 *
 * const reason: DenialReason = "destination-not-granted"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DenialReason = typeof DenialReason.Type;

/**
 * The denial reasons the pure evaluator can produce, in evaluation-precedence
 * order: seal, then revision, then principal, operation, sink class, audience,
 * destination, and expiry. The seal check comes first because a grant set
 * whose digest does not match its contents cannot be trusted to answer any
 * later question. Each subsequent check narrows the candidate grant set; the
 * first narrowing that empties it names the reason.
 *
 * **Example** (Usage)
 * ```ts
 * import { evaluatorDenialReasons } from "@beep/epistemic-domain"
 *
 * console.log(evaluatorDenialReasons.length)
 * // 8
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const evaluatorDenialReasons = DenialReason.pickOptions([
  "grant-set-digest-mismatch",
  "policy-revision-mismatch",
  "principal-not-granted",
  "operation-not-granted",
  "sink-class-not-granted",
  "audience-not-granted",
  "destination-not-granted",
  "grant-expired",
]);

/**
 * The denial reasons only the enforcement boundary can produce: a request with
 * no frozen grant set in scope (the common case, not an edge — layer-build
 * HTTP, health probes, loopback RPC), and a failed write-ahead decision write
 * (no record, no action).
 *
 * **Example** (Usage)
 * ```ts
 * import { boundaryDenialReasons } from "@beep/epistemic-domain"
 *
 * console.log(boundaryDenialReasons.length)
 * // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const boundaryDenialReasons = DenialReason.pickOptions(["no-grant-in-scope", "ledger-unavailable"]);

/**
 * Constant operator guidance per denial reason — a total lookup, never
 * interpolated with request data, so guidance can never smuggle a payload
 * into a log line or ledger row.
 *
 * **Example** (Usage)
 * ```ts
 * import { denialGuidance } from "@beep/epistemic-domain"
 *
 * console.log(denialGuidance["grant-expired"])
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const denialGuidance: Readonly<Record<DenialReason, string>> = {
  "no-grant-in-scope": "No frozen grant set is in scope for this execution; open a governed run before dispatching.",
  "grant-set-digest-mismatch":
    "The frozen grant set's digest does not match its contents; it was altered after freezing and cannot authorize anything.",
  "principal-not-granted": "No grant in the frozen set belongs to the requesting principal.",
  "operation-not-granted": "No grant in the frozen set names this operation.",
  "sink-class-not-granted": "A grant names this operation but not this sink class.",
  "audience-not-granted": "A grant covers this sink class but not the resolved audience.",
  "destination-not-granted": "A grant covers this audience but not this destination.",
  "grant-expired": "Every matching grant expired before the request was evaluated.",
  "policy-revision-mismatch": "The frozen grant set was pinned to a different policy revision; open a new run.",
  "ledger-unavailable": "The write-ahead decision record could not be written; the action was refused fail-closed.",
};

/**
 * The request the evaluator decides: one operation against one sink class and
 * destination, with the audience already resolved by the boundary's resolver.
 * The caller never supplies the audience — a request cannot self-declare a
 * friendlier classification.
 *
 * **Example** (Usage)
 * ```ts
 * import { ExecutionRequest } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const request = S.decodeUnknownSync(ExecutionRequest)({
 *   destination: "https://registry.example",
 *   operation: "ontology_publish_provenance",
 *   principal: { component: "Runtime", kind: "System" },
 *   resolvedAudience: "external-network",
 *   sinkClass: "network-egress"
 * })
 * console.log(request.operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionRequest extends S.Class<ExecutionRequest>($I`ExecutionRequest`)(
  {
    operation: GrantOperation.annotateKey({
      description: "Operation being attempted.",
    }),
    principal: Principal.annotateKey({
      description: "Principal attempting the governed operation.",
    }),
    sinkClass: SinkClass.annotateKey({
      description: "Sink class the operation would reach.",
    }),
    destination: SinkDestination.annotateKey({
      description: "Destination the operation would reach.",
    }),
    resolvedAudience: SinkAudience.annotateKey({
      description: "Audience resolved by the boundary's resolver, never by the caller.",
    }),
  },
  $I.annote("ExecutionRequest", {
    description:
      "One governed execution request: principal, operation, sink class, destination, resolver-owned audience.",
  })
) {
  static readonly is = S.is(ExecutionRequest);
}

const ExecutionVerdictTag = LiteralKit(["allowed", "denied"]);

/**
 * Typed evaluation verdict in the repo's blessed gate shape (`ClaimGate`, then
 * `TierGate`, now this): refusal is a value, the error channel is `never`,
 * and unknown anything denies. The denied variant carries the bounded reason
 * for the ledger and the log — the agent never sees it.
 *
 * **Example** (Usage)
 * ```ts
 * import { ExecutionVerdict } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const verdict = S.decodeUnknownSync(ExecutionVerdict)({
 *   reason: "destination-not-granted",
 *   verdict: "denied"
 * })
 * console.log(verdict.verdict)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExecutionVerdict = ExecutionVerdictTag.toTaggedUnion("verdict")({
  allowed: {},
  denied: { reason: DenialReason },
}).pipe(
  $I.annoteSchema("ExecutionVerdict", {
    description: "Typed allowed/denied evaluation verdict; denied carries the bounded reason.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ExecutionVerdict}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { ExecutionVerdict } from "@beep/epistemic-domain"
 *
 * const verdict: ExecutionVerdict = { verdict: "allowed" }
 * console.log(verdict.verdict)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionVerdict = typeof ExecutionVerdict.Type;

/**
 * Three-way classification of an outbound request at the policy seam. Exactly
 * one branch writes no ledger record: `ungoverned-infrastructure`, whose
 * membership is the closed set {@link ungovernedInfrastructureDestinations} —
 * empty in this slice, and kept closed so a future contributor cannot land in
 * a fail-open branch by default.
 *
 * **Example** (Usage)
 * ```ts
 * import { EgressClassification } from "@beep/epistemic-domain"
 *
 * console.log(EgressClassification.Enum["governed-denied"])
 * // "governed-denied"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EgressClassification = LiteralKit([
  "governed-allowed",
  "governed-denied",
  "ungoverned-infrastructure",
]).pipe(
  $I.annoteSchema("EgressClassification", {
    description: "Three-way policy-seam classification; only ungoverned-infrastructure writes no record.",
  })
);

/**
 * Runtime type for {@link EgressClassification}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { EgressClassification } from "@beep/epistemic-domain"
 *
 * const classification: EgressClassification = "governed-allowed"
 * console.log(classification)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EgressClassification = typeof EgressClassification.Type;

/**
 * The closed set of destinations exempt from governance as infrastructure.
 * **Empty in this slice** — `ObservabilityLive` is built inside `RuntimeLive`,
 * so the OTLP exporter never runs in the governed branch's context and no
 * exemption is needed. The element type is `never`: adding a member is a
 * deliberate type-level act, not a string push, and a test asserts the exact
 * membership so an addition cannot land silently.
 *
 * **Example** (Usage)
 * ```ts
 * import { ungovernedInfrastructureDestinations } from "@beep/epistemic-domain"
 *
 * console.log(ungovernedInfrastructureDestinations.length)
 * // 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ungovernedInfrastructureDestinations: ReadonlyArray<never> = [];
