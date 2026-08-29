/**
 * Schema models for fail-closed gates and audited verdict values.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { ISOStr } from "@beep/schema/Timestamp";
import { HashSet, Tuple } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { SchemaReference } from "./SchemaReference.ts";
import type { LiteralKit as LiteralKitSchema } from "@beep/schema/LiteralKit";
import type { Effect } from "effect";

const $I = $SkillContractId.create("Gate");

type GateIdLiterals = readonly [string, ...ReadonlyArray<string>];

/**
 * Branded wire identifier shared by every gate declaration and audit record.
 *
 * **Example** (Construct a gate identifier)
 *
 * ```ts import.meta.vitest name="Construct a gate identifier"
 * import { GateId } from "@beep/skill-contract"
 *
 * const id = GateId.make("artifact-exists")
 * id // => "artifact-exists"
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
 * vocabulary and the helpers derived from that vocabulary. Each invocation is
 * annotated with an identity derived from the complete literal domain.
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
    S.check(S.isNonEmpty()),
    S.brand("GateId"),
    $I.annoteSchema(`ConsumerGateId(${A.join(ids.Options, "|")})`, {
      description: "Consumer-owned finite gate identifier domain carrying the kernel GateId brand.",
    })
  );

/**
 * Whether a denied gate blocks progress or records advisory evidence.
 *
 * **Example** (Inspect severity options)
 *
 * ```ts import.meta.vitest name="Inspect severity options"
 * import { GateSeverity } from "@beep/skill-contract"
 *
 * GateSeverity.Options // => ["blocking", "advisory"]
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
 * Closed applicability variants persisted by gate declarations.
 *
 * **Example** (Inspect applicability kinds)
 *
 * ```ts import.meta.vitest name="Inspect applicability kinds"
 * import { GateApplicabilityKind } from "@beep/skill-contract"
 *
 * GateApplicabilityKind.Options // => ["always", "conditional"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateApplicabilityKind = LiteralKit(["always", "conditional"]).pipe(
  $I.annoteSchema("GateApplicabilityKind", {
    description: "Closed gate applicability variants.",
  })
);

/**
 * Runtime type decoded by {@link GateApplicabilityKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateApplicabilityKind = typeof GateApplicabilityKind.Type;

/**
 * Applicability value for a gate that always runs.
 *
 * **Example** (Construct unconditional applicability)
 *
 * ```ts import.meta.vitest name="Construct unconditional applicability"
 * import { AlwaysGateApplicability } from "@beep/skill-contract"
 *
 * AlwaysGateApplicability.make({}).kind // => "always"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AlwaysGateApplicability extends S.Class<AlwaysGateApplicability>($I`AlwaysGateApplicability`)(
  { kind: S.tag("always") },
  $I.annote("AlwaysGateApplicability", {
    description: "Applicability value for a gate that always runs.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Applicability value bound to a versioned condition schema reference.
 *
 * **Details**
 *
 * The reference names a runtime-bound decoder or evaluator contract. It does
 * not persist a function or define an expression language.
 *
 * **Example** (Construct conditional applicability)
 *
 * ```ts import.meta.vitest name="Construct conditional applicability"
 * import { ConditionalGateApplicability, SchemaReference, SchemaReferenceId } from "@beep/skill-contract"
 *
 * const applicability = ConditionalGateApplicability.make({
 *   condition: SchemaReference.make({ schemaId: SchemaReferenceId.make("qa.condition/v1") })
 * })
 * applicability.kind // => "conditional"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConditionalGateApplicability extends S.Class<ConditionalGateApplicability>(
  $I`ConditionalGateApplicability`
)(
  {
    condition: SchemaReference,
    kind: S.tag("conditional"),
  },
  $I.annote("ConditionalGateApplicability", {
    description: "Conditional gate applicability bound to a persisted schema reference.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Persisted applicability of a gate declaration.
 *
 * **Example** (Match an unconditional applicability value)
 *
 * ```ts
 * import { AlwaysGateApplicability, GateApplicability } from "@beep/skill-contract"
 *
 * const value = AlwaysGateApplicability.make({})
 * console.log(GateApplicability.match(value, {
 *   always: () => true,
 *   conditional: () => false
 * })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateApplicability = GateApplicabilityKind.mapMembers(
  Tuple.evolve([AlwaysGateApplicability.thunkThis, ConditionalGateApplicability.thunkThis])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("GateApplicability", {
    description: "Gate applicability as an unconditional value or a versioned condition reference.",
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
 *   AlwaysGateApplicability,
 *   EvidencePredicateType,
 *   GateDeclaration,
 *   GateEvidenceRequirement,
 *   GateId
 * } from "@beep/skill-contract"
 *
 * const gate = GateDeclaration.make({
 *   applicability: AlwaysGateApplicability.make({}),
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
      description: "Whether this declaration always applies or names a condition schema.",
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
    description: "Persistable declaration of a gate's identity, policy, applicability, and typed evidence requirement.",
  })
) {}

const GateRegistryFields = S.Struct({ declarations: S.Array(GateDeclaration) });
const UniqueGateIdsCheck = S.makeFilter(
  (registry: typeof GateRegistryFields.Type) => {
    const ids = A.map(registry.declarations, (declaration) => declaration.id);
    return Eq.equals(HashSet.size(HashSet.fromIterable(ids)), A.length(ids))
      ? undefined
      : {
          path: ["declarations"],
          issue: "Gate registry declarations must use unique gate ids.",
        };
  },
  {
    identifier: $I`UniqueGateIdsCheck`,
    title: "Unique gate ids",
    description: "A gate registry preserves declaration order while rejecting duplicate gate ids.",
  }
);

/**
 * Ordered gate declarations whose identifiers are unique at decode.
 *
 * **Example** (Construct a gate registry)
 *
 * ```ts import.meta.vitest name="Construct a gate registry"
 * import { GateRegistry } from "@beep/skill-contract"
 *
 * GateRegistry.make({ declarations: [] }).declarations.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateRegistry extends S.Class<GateRegistry>($I`GateRegistry`)(
  GateRegistryFields.check(UniqueGateIdsCheck),
  $I.annote("GateRegistry", {
    description: "Ordered gate declarations with unique ids enforced at schema decode.",
  })
) {}

/**
 * Closed outcome vocabulary shared by gate verdicts and summary rows.
 *
 * **Example** (Inspect gate outcomes)
 *
 * ```ts import.meta.vitest name="Inspect gate outcomes"
 * import { GateOutcome } from "@beep/skill-contract"
 *
 * GateOutcome.Options // => ["allowed", "denied"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateOutcome = LiteralKit(["allowed", "denied"]).pipe(
  $I.annoteSchema("GateOutcome", {
    description: "Allowed and denied gate outcomes.",
  })
);

/**
 * Runtime type decoded by {@link GateOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type GateOutcome = typeof GateOutcome.Type;

const gateAuditRecordImpl = <const Identifier extends string, const Outcome extends GateOutcome, Detail extends S.Top>(
  identifier: Identifier,
  outcome: Outcome,
  detail: Detail
) =>
  S.Struct({
    detail,
    evaluator: S.NonEmptyString,
    gateId: GateId,
    occurredAt: ISOStr,
    outcome: S.Literal(outcome),
    reason: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema(
      GateOutcome.$match(outcome, {
        allowed: () => `${identifier}AllowedAudit`,
        denied: () => `${identifier}DeniedAudit`,
      }),
      {
        description: GateOutcome.$match(outcome, {
          allowed: () => "Audit record carried by an allowed gate verdict.",
          denied: () => "Audit record carried by a denied gate verdict.",
        }),
      }
    )
  );

/**
 * Builds a distinctly identified audit-record schema with coherent outcome and detail.
 *
 * **Example** (Build a denied audit schema)
 *
 * ```ts
 * import { GateAuditRecord } from "@beep/skill-contract"
 * import * as S from "effect/Schema"
 *
 * const DeniedAudit = GateAuditRecord(
 *   "ArtifactExists",
 *   "denied",
 *   S.Struct({ missing: S.Array(S.String) })
 * )
 * console.log(S.is(DeniedAudit))
 * ```
 *
 * @param identifier - Distinct identity stem for this parameterized schema instance.
 * @param outcome - Verdict literal pinned into the audit record.
 * @param detail - Consumer-owned schema for evaluator observations.
 * @returns Schema for one coherent audited outcome.
 * @category factories
 * @since 0.0.0
 */
export const GateAuditRecord: {
  <const Outcome extends GateOutcome, Detail extends S.Top>(
    outcome: Outcome,
    detail: Detail
  ): <const Identifier extends string>(
    identifier: Identifier
  ) => ReturnType<typeof gateAuditRecordImpl<Identifier, Outcome, Detail>>;
  <const Identifier extends string, const Outcome extends GateOutcome, Detail extends S.Top>(
    identifier: Identifier,
    outcome: Outcome,
    detail: Detail
  ): ReturnType<typeof gateAuditRecordImpl<Identifier, Outcome, Detail>>;
} = dual(3, gateAuditRecordImpl);

const gateVerdictImpl = <const Identifier extends string, AllowedDetail extends S.Top, DeniedDetail extends S.Top>(
  identifier: Identifier,
  allowedDetail: AllowedDetail,
  deniedDetail: DeniedDetail
) => {
  const schemaIdentifier: string = identifier;
  return GateOutcome.toTaggedUnion("verdict")({
    allowed: { audit: GateAuditRecord(identifier, "allowed", allowedDetail) },
    denied: { audit: GateAuditRecord(identifier, "denied", deniedDetail) },
  }).pipe(
    $I.annoteSchema(schemaIdentifier, {
      description: "Fail-closed allowed or denied verdict; both cases carry a coherent audit record.",
    })
  );
};

/**
 * Builds a distinctly identified audited `allowed | denied` verdict schema.
 *
 * **Details**
 *
 * Both cases carry an audit record. Denial is a successful return value, not an
 * Effect error; only genuine evaluator boundary failures belong in the error channel.
 *
 * **Example** (Construct an allowed verdict)
 *
 * ```ts import.meta.vitest name="Construct an allowed verdict"
 * import { GateId, GateVerdict } from "@beep/skill-contract"
 * import { ISOStr } from "@beep/schema/Timestamp"
 * import * as S from "effect/Schema"
 *
 * const Detail = S.Struct({ paths: S.Array(S.String) })
 * const Verdict = GateVerdict("ArtifactExistsVerdict", Detail, Detail)
 * const verdict = Verdict.cases.allowed.make({
 *   audit: {
 *     detail: { paths: ["report.md"] },
 *     evaluator: "example",
 *     gateId: GateId.make("artifact-exists"),
 *     occurredAt: ISOStr.make("2026-08-24T00:00:00.000Z"),
 *     outcome: "allowed",
 *     reason: "Every artifact exists."
 *   }
 * })
 * verdict.verdict // => "allowed"
 * ```
 *
 * @param identifier - Distinct identity for this parameterized verdict schema.
 * @param allowedDetail - Schema for observations attached to an allowed verdict.
 * @param deniedDetail - Schema for observations attached to a denied verdict.
 * @returns Tagged verdict schema with coherent audit records in both cases.
 * @category factories
 * @since 0.0.0
 */
export const GateVerdict: {
  <AllowedDetail extends S.Top, DeniedDetail extends S.Top>(
    allowedDetail: AllowedDetail,
    deniedDetail: DeniedDetail
  ): <const Identifier extends string>(
    identifier: Identifier
  ) => ReturnType<typeof gateVerdictImpl<Identifier, AllowedDetail, DeniedDetail>>;
  <const Identifier extends string, AllowedDetail extends S.Top, DeniedDetail extends S.Top>(
    identifier: Identifier,
    allowedDetail: AllowedDetail,
    deniedDetail: DeniedDetail
  ): ReturnType<typeof gateVerdictImpl<Identifier, AllowedDetail, DeniedDetail>>;
} = dual(3, gateVerdictImpl);

/**
 * Total evaluator contract for a typed gate.
 *
 * **Details**
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
