/**
 * Schema models for fail-closed gates and audited verdict values.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { LiteralKit as LiteralKitSchema } from "@beep/schema/LiteralKit";
import type { Effect } from "effect";

const $I = $SkillContractId.create("Gate");
const GateVerdictTag = LiteralKit(["allowed", "denied"]);

type GateIdLiterals = readonly [string, ...ReadonlyArray<string>];
type GateVerdictTag = typeof GateVerdictTag.Type;

/**
 * Branded wire identifier shared by every gate declaration and audit record.
 *
 * **Example** (Construct a gate identifier)
 *
 * ```ts
 * import { GateId } from "@beep/skill-contract"
 *
 * const id = GateId.make("artifact-exists")
 * console.log(id) // "artifact-exists"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const GateId = S.NonEmptyString.pipe(
  S.brand("GateId"),
  $I.annoteSchema("GateId", {
    description: "Stable branded identifier carried by gate declarations and verdict audits.",
  })
);

/**
 * Runtime type decoded by {@link GateId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type GateId = typeof GateId.Type;

/**
 * Narrows {@link GateId} to a consumer-owned `LiteralKit` domain.
 *
 * **Details**
 *
 * The kernel owns the wire brand, while each consumer owns its finite gate-id
 * vocabulary and the helpers derived from that vocabulary.
 *
 * **Example** (Define consumer gate identifiers)
 *
 * ```ts
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 * import { makeGateId } from "@beep/skill-contract"
 *
 * const QaGateId = makeGateId(LiteralKit(["cited-artifact-exists"]))
 * console.log(QaGateId.make("cited-artifact-exists"))
 * ```
 *
 * @param ids - Consumer-local finite gate identifier domain.
 * @returns Branded schema retaining the consumer's literal type.
 * @category factories
 * @since 0.0.0
 */
export const makeGateId = <const Ids extends GateIdLiterals>(ids: LiteralKitSchema<Ids>) =>
  ids.pipe(
    S.brand("GateId"),
    $I.annoteSchema("ConsumerGateId", {
      description: "Consumer-owned finite gate identifier domain carrying the kernel GateId brand.",
    })
  );

/**
 * Whether a denied gate blocks progress or records advisory evidence.
 *
 * **Example** (Inspect severity options)
 *
 * ```ts
 * import { GateSeverity } from "@beep/skill-contract"
 *
 * console.log(GateSeverity.Options) // ["blocking", "advisory"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateSeverity = LiteralKit(["blocking", "advisory"]).pipe(
  $I.annoteSchema("GateSeverity", {
    description: "Whether denial blocks contract progress or remains advisory.",
  })
);

/**
 * Runtime type decoded by {@link GateSeverity}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateSeverity = typeof GateSeverity.Type;

/**
 * Applicability mode persisted by a gate declaration.
 *
 * **Gotchas**
 *
 * `conditional` reserves the wire value for the widening slice. This package
 * does not define or execute a condition expression language yet.
 *
 * **Example** (Declare an unconditional gate)
 *
 * ```ts
 * import { GateApplicability } from "@beep/skill-contract"
 *
 * console.log(GateApplicability.make("always")) // "always"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateApplicability = LiteralKit(["always", "conditional"]).pipe(
  $I.annoteSchema("GateApplicability", {
    description: "Whether a gate always applies or uses a condition model reserved for a later slice.",
  })
);

/**
 * Runtime type decoded by {@link GateApplicability}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateApplicability = typeof GateApplicability.Type;

/**
 * Stable, versioned identity of a typed evidence predicate.
 *
 * **Example** (Construct a predicate type)
 *
 * ```ts
 * import { EvidencePredicateType } from "@beep/skill-contract"
 *
 * const type = EvidencePredicateType.make("https://beep.dev/evidence/artifact-exists/v1")
 * console.log(type)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EvidencePredicateType = S.NonEmptyString.pipe(
  S.brand("EvidencePredicateType"),
  $I.annoteSchema("EvidencePredicateType", {
    description: "Stable, versioned identity of the schema used for a gate's evidence predicate.",
  })
);

/**
 * Runtime type decoded by {@link EvidencePredicateType}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type EvidencePredicateType = typeof EvidencePredicateType.Type;

/**
 * Typed evidence a gate requires before it can allow progress.
 *
 * **Example** (Require a versioned predicate)
 *
 * ```ts
 * import { EvidencePredicateType, GateEvidenceRequirement } from "@beep/skill-contract"
 *
 * const requirement = GateEvidenceRequirement.make({
 *   predicateType: EvidencePredicateType.make("https://beep.dev/evidence/artifact-exists/v1")
 * })
 * console.log(requirement.predicateType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateEvidenceRequirement extends S.Class<GateEvidenceRequirement>($I`GateEvidenceRequirement`)(
  {
    predicateType: EvidencePredicateType.annotateKey({
      description: "Versioned predicate identity expected by the gate evaluator.",
    }),
  },
  $I.annote("GateEvidenceRequirement", {
    description: "Typed predicate identity a gate requires as evidence.",
  })
) {}

/**
 * Persistable declaration of a gate's identity, policy, and evidence contract.
 *
 * **Example** (Declare a blocking gate)
 *
 * ```ts
 * import {
 *   EvidencePredicateType,
 *   GateDeclaration,
 *   GateEvidenceRequirement,
 *   GateId
 * } from "@beep/skill-contract"
 *
 * const gate = GateDeclaration.make({
 *   applicability: "always",
 *   evidence: GateEvidenceRequirement.make({
 *     predicateType: EvidencePredicateType.make("https://beep.dev/evidence/artifact-exists/v1")
 *   }),
 *   id: GateId.make("artifact-exists"),
 *   remediationOwner: "qa",
 *   severity: "blocking"
 * })
 * console.log(gate.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateDeclaration extends S.Class<GateDeclaration>($I`GateDeclaration`)(
  {
    applicability: GateApplicability.annotateKey({
      description: "Whether this declaration always applies or reserves conditional applicability.",
    }),
    evidence: GateEvidenceRequirement,
    id: GateId.annotateKey({
      description: "Stable gate identifier.",
    }),
    remediationOwner: S.NonEmptyString.annotateKey({
      description: "Team, package, or role responsible for clearing a denial.",
    }),
    severity: GateSeverity.annotateKey({
      description: "Whether denial blocks progress or remains advisory.",
    }),
  },
  $I.annote("GateDeclaration", {
    description: "Persistable declaration of a gate's identity, policy, and typed evidence requirement.",
  })
) {}

const gateAuditRecordImpl = <const Outcome extends GateVerdictTag, Detail extends S.Top>(
  outcome: Outcome,
  detail: Detail
) =>
  S.Struct({
    detail,
    evaluator: S.NonEmptyString,
    gateId: GateId,
    occurredAt: S.NonEmptyString,
    outcome: S.Literal(outcome),
    reason: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("GateAuditRecord", {
      description: "Audit record carried by an allowed or denied gate verdict.",
    })
  );

/**
 * Builds an audit-record schema whose outcome and detail stay coherent.
 *
 * **Example** (Build a denied audit schema)
 *
 * ```ts
 * import { GateAuditRecord } from "@beep/skill-contract"
 * import * as S from "effect/Schema"
 *
 * const DeniedAudit = GateAuditRecord("denied", S.Struct({ missing: S.Array(S.String) }))
 * console.log(S.is(DeniedAudit))
 * ```
 *
 * @param outcome - Verdict literal pinned into the audit record.
 * @param detail - Consumer-owned schema for evaluator observations.
 * @returns Schema for one coherent audited outcome.
 * @category factories
 * @since 0.0.0
 */
export const GateAuditRecord: {
  <Detail extends S.Top>(
    detail: Detail
  ): <const Outcome extends GateVerdictTag>(
    outcome: Outcome
  ) => ReturnType<typeof gateAuditRecordImpl<Outcome, Detail>>;
  <const Outcome extends GateVerdictTag, Detail extends S.Top>(
    outcome: Outcome,
    detail: Detail
  ): ReturnType<typeof gateAuditRecordImpl<Outcome, Detail>>;
} = dual(2, gateAuditRecordImpl);

const gateVerdictImpl = <AllowedDetail extends S.Top, DeniedDetail extends S.Top>(
  allowedDetail: AllowedDetail,
  deniedDetail: DeniedDetail
) =>
  GateVerdictTag.toTaggedUnion("verdict")({
    allowed: { audit: GateAuditRecord("allowed", allowedDetail) },
    denied: { audit: GateAuditRecord("denied", deniedDetail) },
  }).pipe(
    $I.annoteSchema("GateVerdict", {
      description: "Fail-closed allowed or denied verdict; both cases carry a coherent audit record.",
    })
  );

/**
 * Builds an audited `allowed | denied` verdict schema with consumer-owned details.
 *
 * **Details**
 *
 * Both cases carry an audit record. Denial is a successful return value, not an
 * Effect error; only genuine evaluator boundary failures belong in the error channel.
 *
 * **Example** (Construct an allowed verdict)
 *
 * ```ts
 * import { GateId, GateVerdict } from "@beep/skill-contract"
 * import * as S from "effect/Schema"
 *
 * const Verdict = GateVerdict(S.Struct({ checked: S.Array(S.String) }), S.Struct({ missing: S.Array(S.String) }))
 * const verdict = Verdict.cases.allowed.make({
 *   audit: {
 *     detail: { checked: ["report.md"] },
 *     evaluator: "example",
 *     gateId: GateId.make("artifact-exists"),
 *     occurredAt: "2026-08-24T00:00:00.000Z",
 *     outcome: "allowed",
 *     reason: "Every artifact exists."
 *   }
 * })
 * console.log(verdict.verdict) // "allowed"
 * ```
 *
 * @param allowedDetail - Schema for observations attached to an allowed verdict.
 * @param deniedDetail - Schema for observations attached to a denied verdict.
 * @returns Tagged verdict schema with coherent audit records in both cases.
 * @category factories
 * @since 0.0.0
 */
export const GateVerdict: {
  <DeniedDetail extends S.Top>(
    deniedDetail: DeniedDetail
  ): <AllowedDetail extends S.Top>(
    allowedDetail: AllowedDetail
  ) => ReturnType<typeof gateVerdictImpl<AllowedDetail, DeniedDetail>>;
  <AllowedDetail extends S.Top, DeniedDetail extends S.Top>(
    allowedDetail: AllowedDetail,
    deniedDetail: DeniedDetail
  ): ReturnType<typeof gateVerdictImpl<AllowedDetail, DeniedDetail>>;
} = dual(2, gateVerdictImpl);

/**
 * Total evaluator contract for a typed gate.
 *
 * Denials belong in `Verdict`. `Failure` is reserved for genuine boundary
 * failures such as decoding an external evidence payload.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GateEvaluator<Input, Verdict, Failure = never, Requirements = never> = (
  input: Input
) => Effect.Effect<Verdict, Failure, Requirements>;
