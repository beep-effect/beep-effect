/**
 * Execution grant value object: the unit of pre-authorized agent authority.
 *
 * A grant names what one principal may do — one operation against one sink —
 * under a pinned policy revision and an expiry. Grants are held only by the
 * enforcement boundary and are never issued to the agent as a credential, so
 * there is nothing for a prompt-injected agent to leak, replay, or forward
 * (exploration decision 3). Sinks are modeled as (class, audience, destination)
 * so an outbound HTTP POST and an MCP workspace write are the same schema
 * differing only in class, and policy keys on audience rather than transport
 * (exploration decision 2).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("values/ExecutionGrant/ExecutionGrant.model");

/**
 * Governed sink classes: the two kinds of externally observable effect the
 * first slice governs. An outbound network request and an MCP workspace write
 * are the same schema differing only in this discriminant, because the
 * incident record shows exfiltration composes through *any* permitted sink,
 * not through one protocol.
 *
 * **Example** (Access network-egress enum)
 *
 * ```ts
 * import { SinkClass } from "@beep/epistemic-domain"
 *
 * console.log(SinkClass.Enum["network-egress"])
 * // "network-egress"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SinkClass = LiteralKit(["network-egress", "mcp-write"]).pipe(
  $I.annoteSchema("SinkClass", {
    description: "Governed sink class: outbound network egress or an MCP workspace write.",
  })
);

/**
 * Runtime type for {@link SinkClass}.
 *
 * **Example** (Assign mcp-write type)
 *
 * ```ts
 * import type { SinkClass } from "@beep/epistemic-domain"
 *
 * const sinkClass: SinkClass = "mcp-write"
 * console.log(sinkClass)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SinkClass = typeof SinkClass.Type;

/**
 * Sink audience classification. Policy keys on audience — who can observe the
 * effect — never on transport. `local-workspace` is degenerate in v1: every
 * governed MCP write lands under the local workspace root behind loopback, so
 * only `external-network` is genuinely exercised by the first fixture. Stated
 * here so the axis is never mistaken for validated.
 *
 * **Details**
 *
 * The destination→audience mapping is owned by a resolver at the boundary; a
 * caller can never self-declare a friendlier audience.
 *
 * **Example** (Access external-network enum)
 *
 * ```ts
 * import { SinkAudience } from "@beep/epistemic-domain"
 *
 * console.log(SinkAudience.Enum["external-network"])
 * // "external-network"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SinkAudience = LiteralKit(["local-workspace", "external-network"]).pipe(
  $I.annoteSchema("SinkAudience", {
    description: "Audience able to observe a sink's effect: the local workspace or the external network.",
  })
);

/**
 * Runtime type for {@link SinkAudience}.
 *
 * **Example** (Assign external-network type)
 *
 * ```ts
 * import type { SinkAudience } from "@beep/epistemic-domain"
 *
 * const audience: SinkAudience = "external-network"
 * console.log(audience)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SinkAudience = typeof SinkAudience.Type;

/**
 * Raw sink destination as granted: an origin for network egress, a
 * workspace-root selector for MCP writes. Exists only on the grant side of the
 * boundary — execution records never carry a raw destination, only its digest.
 *
 * **Example** (Decode destination URL)
 *
 * ```ts
 * import { SinkDestination } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(SinkDestination)("https://registry.example"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SinkDestination = S.NonEmptyString.pipe(
  S.brand("SinkDestination"),
  $I.annoteSchema("SinkDestination", {
    description: "Raw granted sink destination; grant-side only, never persisted in execution records.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link SinkDestination}.
 *
 * **Example** (Make destination value)
 *
 * ```ts
 * import { SinkDestination } from "@beep/epistemic-domain"
 *
 * const destination: SinkDestination = SinkDestination.make("https://registry.example")
 * console.log(destination)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SinkDestination = typeof SinkDestination.Type;

/**
 * A governed sink: (class, audience, destination). The triple that makes an
 * outbound POST and a workspace write comparable under one policy.
 *
 * **Example** (Decode execution sink)
 *
 * ```ts
 * import { ExecutionSink } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const sink = S.decodeUnknownSync(ExecutionSink)({
 *   audience: "external-network",
 *   destination: "https://registry.example",
 *   sinkClass: "network-egress"
 * })
 * console.log(sink.sinkClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionSink extends S.Class<ExecutionSink>($I`ExecutionSink`)(
  {
    sinkClass: SinkClass.annotateKey({
      description: "Which governed sink class this sink belongs to.",
    }),
    audience: SinkAudience.annotateKey({
      description: "Resolver-owned audience classification of the destination.",
    }),
    destination: SinkDestination.annotateKey({
      description: "Raw granted destination; never persisted in execution records.",
    }),
  },
  $I.annote("ExecutionSink", {
    description: "Governed sink triple (class, audience, destination).",
  })
) {
  static readonly is = S.is(ExecutionSink);
}

/**
 * Purpose a grant was issued for. Opaque to the evaluator; recorded only via
 * the grant-set digest, never as ledger text.
 *
 * **Example** (Make grant purpose)
 *
 * ```ts
 * import { GrantPurpose } from "@beep/epistemic-domain"
 *
 * console.log(GrantPurpose.make("provenance-publication"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GrantPurpose = S.NonEmptyString.pipe(
  S.brand("GrantPurpose"),
  $I.annoteSchema("GrantPurpose", {
    description: "Purpose a grant was issued for; opaque to evaluation.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link GrantPurpose}.
 *
 * **Example** (Assign grant purpose type)
 *
 * ```ts
 * import { GrantPurpose } from "@beep/epistemic-domain"
 *
 * const purpose: GrantPurpose = GrantPurpose.make("provenance-publication")
 * console.log(purpose)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GrantPurpose = typeof GrantPurpose.Type;

/**
 * Resource selector the grant covers. Opaque to the evaluator in v1.
 *
 * **Example** (Make grant resource)
 *
 * ```ts
 * import { GrantResource } from "@beep/epistemic-domain"
 *
 * console.log(GrantResource.make("ontology-workspace"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GrantResource = S.NonEmptyString.pipe(
  S.brand("GrantResource"),
  $I.annoteSchema("GrantResource", {
    description: "Resource selector a grant covers; opaque to evaluation in v1.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link GrantResource}.
 *
 * **Example** (Assign grant resource type)
 *
 * ```ts
 * import { GrantResource } from "@beep/epistemic-domain"
 *
 * const resource: GrantResource = GrantResource.make("ontology-workspace")
 * console.log(resource)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GrantResource = typeof GrantResource.Type;

/**
 * Operation a grant authorizes — for the MCP sink this is a tool name. A
 * request whose operation matches no grant is denied fail-closed; there is no
 * wildcard operation.
 *
 * **Example** (Make grant operation)
 *
 * ```ts
 * import { GrantOperation } from "@beep/epistemic-domain"
 *
 * console.log(GrantOperation.make("ontology_publish_provenance"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GrantOperation = S.NonEmptyString.pipe(
  S.brand("GrantOperation"),
  $I.annoteSchema("GrantOperation", {
    description: "Operation a grant authorizes; exact match, no wildcard.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link GrantOperation}.
 *
 * **Example** (Assign grant operation type)
 *
 * ```ts
 * import { GrantOperation } from "@beep/epistemic-domain"
 *
 * const operation: GrantOperation = GrantOperation.make("ontology_publish_provenance")
 * console.log(operation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GrantOperation = typeof GrantOperation.Type;

/**
 * Policy revision a grant was evaluated under, pinned at composition time and
 * carried into every execution record. Load-bearing per the Zanzibar new-enemy
 * analysis: a record that cannot name its policy revision cannot prove which
 * policy allowed the action (exploration decision 3, consequence a).
 *
 * **Example** (Decode policy revision)
 *
 * ```ts
 * import { PolicyRevision } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PolicyRevision)("1.0.0"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PolicyRevision = SemanticVersion.pipe(
  S.brand("PolicyRevision"),
  $I.annoteSchema("PolicyRevision", {
    description: "Pinned policy revision a grant and its records were evaluated under.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PolicyRevision}.
 *
 * **Example** (Assign policy revision type)
 *
 * ```ts
 * import { PolicyRevision } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const revision: PolicyRevision = S.decodeUnknownSync(PolicyRevision)("1.0.0")
 * console.log(revision)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PolicyRevision = typeof PolicyRevision.Type;

/**
 * Grant budget: carried and recorded, deliberately not enforced in v1. Live
 * token/cost accounting is a constant fixture today, so a spend ceiling would
 * be theatre; the field exists so records are complete when enforcement lands.
 *
 * **Example** (Decode grant budget)
 *
 * ```ts
 * import { GrantBudget } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const budget = S.decodeUnknownSync(GrantBudget)({ maxToolCalls: 8 })
 * console.log(budget.maxToolCalls)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GrantBudget extends S.Class<GrantBudget>($I`GrantBudget`)(
  {
    maxToolCalls: NonNegativeInt.pipe(S.OptionFromNullOr, SchemaUtils.withNoneDefault).annotateKey({
      description: "Recorded ceiling on tool calls; not enforced in v1.",
    }),
  },
  $I.annote("GrantBudget", {
    description: "Recorded, unenforced grant budget (v1 carries the field, denies on nothing).",
  })
) {
  static readonly is = S.is(GrantBudget);
}

/**
 * One unit of pre-authorized authority: a principal may perform one operation
 * against one sink until expiry, under a pinned policy revision. Grants are
 * `effect/Schema` values held only by the boundary — never a bearer credential.
 *
 * **Example** (Decode execution grant)
 *
 * ```ts
 * import { ExecutionGrant } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const grant = S.decodeUnknownSync(ExecutionGrant)({
 *   budget: { maxToolCalls: null },
 *   expiresAt: 1,
 *   operation: "ontology_publish_provenance",
 *   policyRevision: "1.0.0",
 *   principal: { component: "Runtime", kind: "System" },
 *   purpose: "provenance-publication",
 *   resource: "ontology-workspace",
 *   sink: {
 *     audience: "external-network",
 *     destination: "https://registry.example",
 *     sinkClass: "network-egress"
 *   }
 * })
 * console.log(grant.operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionGrant extends S.Class<ExecutionGrant>($I`ExecutionGrant`)(
  {
    principal: Principal.annotateKey({
      description: "Principal the authority belongs to; the agent never holds the grant itself.",
    }),
    purpose: GrantPurpose.annotateKey({
      description: "Purpose the grant was issued for.",
    }),
    resource: GrantResource.annotateKey({
      description: "Resource selector the grant covers.",
    }),
    operation: GrantOperation.annotateKey({
      description: "Single operation the grant authorizes; exact match only.",
    }),
    sink: ExecutionSink.annotateKey({
      description: "Governed sink the operation may reach.",
    }),
    budget: GrantBudget.annotateKey({
      description: "Recorded budget; not enforced in v1.",
    }),
    policyRevision: PolicyRevision.annotateKey({
      description: "Policy revision the grant was issued under.",
    }),
    expiresAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Instant after which the grant no longer authorizes anything.",
    }),
  },
  $I.annote("ExecutionGrant", {
    description:
      "Pre-authorized authority unit: principal, purpose, resource, operation, sink, budget, policy revision, expiry.",
  })
) {
  static readonly is = S.is(ExecutionGrant);
}
