/**
 * Logical edge identity value object and digest.
 *
 * **Details**
 *
 * The identity is the application-side canonicalization whose digest becomes the
 * `logical_key` column every bitemporal backstop partitions on. It exists because
 * a multi-column key cannot carry the partition: SQL treats NULL components as
 * distinct under `=`, so optional scopes would silently split one logical edge
 * into several. Folding every component — including absent ones — into a single
 * total encoding makes "same logical edge" a decidable string equality.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeLogicalEdgeIdentity, makeLogicalEdgeKey } from "@beep/epistemics/LogicalEdgeIdentity";
import { $EpistemicDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { EdgeEndpoint } from "../EdgeEndpoint/index.ts";

const schemas = makeLogicalEdgeIdentity({
  $I: $EpistemicDomainId.create("values/LogicalEdgeIdentity/LogicalEdgeIdentity.model"),
  EdgeEndpoint,
});

/**
 * Organization scope of a logical edge: the stringified owning organization id.
 * Every edge is org-scoped, so this component is never absent.
 *
 * **Example** (Decode org scope string)
 *
 * ```ts
 * import { EdgeOrgScope } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(EdgeOrgScope)("1"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeOrgScope = schemas.EdgeOrgScope;

/**
 * Runtime type for {@link EdgeOrgScope}.
 *
 * **Example** (Annotate org scope type)
 *
 * ```ts
 * import type { EdgeOrgScope } from "@beep/epistemic-domain"
 *
 * const scope: EdgeOrgScope = "1"
 * console.log(scope)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeOrgScope = typeof EdgeOrgScope.Type;

/**
 * Optional matter scope narrowing a logical edge to one matter. Two edges that
 * differ only in matter scope are different logical edges.
 *
 * **Example** (Decode matter scope string)
 *
 * ```ts
 * import { EdgeMatterScope } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(EdgeMatterScope)("matter-1"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeMatterScope = schemas.EdgeMatterScope;

/**
 * Runtime type for {@link EdgeMatterScope}.
 *
 * **Example** (Annotate matter scope type)
 *
 * ```ts
 * import type { EdgeMatterScope } from "@beep/epistemic-domain"
 *
 * const scope: EdgeMatterScope = "matter-1"
 * console.log(scope)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeMatterScope = typeof EdgeMatterScope.Type;

/**
 * Optional evidence-set scope narrowing a logical edge to one evidence set.
 *
 * **Example** (Decode evidence scope string)
 *
 * ```ts
 * import { EdgeEvidenceScope } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(EdgeEvidenceScope)("evidence-set-1"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEvidenceScope = schemas.EdgeEvidenceScope;

/**
 * Runtime type for {@link EdgeEvidenceScope}.
 *
 * **Example** (Annotate evidence scope type)
 *
 * ```ts
 * import type { EdgeEvidenceScope } from "@beep/epistemic-domain"
 *
 * const scope: EdgeEvidenceScope = "evidence-set-1"
 * console.log(scope)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeEvidenceScope = typeof EdgeEvidenceScope.Type;

/**
 * Free-form string qualifiers that further partition a logical edge, for example
 * the statute or claim element an assertion is scoped to. Insertion order is not
 * meaningful: the digest sorts entries by key.
 *
 * **Example** (Decode qualifiers object)
 *
 * ```ts
 * import { EdgeQualifiers } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const qualifiers = S.decodeUnknownSync(EdgeQualifiers)({ statute: "35 USC 103" })
 * console.log(qualifiers.statute)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeQualifiers = schemas.EdgeQualifiers;

/**
 * Runtime type for {@link EdgeQualifiers}.
 *
 * **Example** (Annotate qualifiers type)
 *
 * ```ts
 * import type { EdgeQualifiers } from "@beep/epistemic-domain"
 *
 * const qualifiers: EdgeQualifiers = { statute: "35 USC 103" }
 * console.log(qualifiers.statute)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeQualifiers = typeof EdgeQualifiers.Type;

/**
 * Digest of a {@link LogicalEdgeIdentity}: a lowercase SHA-256 hex string that
 * names one logical edge across all of its bitemporal versions. It refines the
 * shared {@link Sha256Hex} primitive with a domain brand so an arbitrary digest
 * cannot be passed where an edge key is expected.
 *
 * **Example** (Decode SHA-256 edge key)
 *
 * ```ts
 * import { LogicalEdgeKey } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const key = S.decodeUnknownSync(LogicalEdgeKey)(
 *   "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe"
 * )
 * console.log(key.length) // 64
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LogicalEdgeKey = schemas.LogicalEdgeKey;

/**
 * Runtime type for {@link LogicalEdgeKey}.
 *
 * **Example** (Annotate decoded edge key)
 *
 * ```ts
 * import { LogicalEdgeKey } from "@beep/epistemic-domain"
 * import type { LogicalEdgeKey as LogicalEdgeKeyValue } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const key: LogicalEdgeKeyValue = S.decodeUnknownSync(LogicalEdgeKey)(
 *   "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe"
 * )
 * console.log(key.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LogicalEdgeKey = typeof LogicalEdgeKey.Type;

/**
 * Everything that makes two epistemic edge versions versions *of the same edge*:
 * the two endpoints, the relation between them, the org/matter/evidence scopes
 * they were asserted under, and any further qualifiers. Time is deliberately
 * absent — it is what varies between versions of one identity.
 *
 * **Example** (Decode full edge identity)
 *
 * ```ts
 * import { LogicalEdgeIdentity } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(LogicalEdgeIdentity)({
 *   evidenceScope: null,
 *   matterScope: null,
 *   orgScope: "1",
 *   qualifiers: {},
 *   relation: "supports",
 *   source: { kind: "claim", claimId: 1 },
 *   target: { kind: "claim", claimId: 2 }
 * })
 *
 * console.log(identity.relation)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LogicalEdgeIdentity extends S.Opaque<LogicalEdgeIdentity, { readonly brand: unique symbol }>()(
  schemas.LogicalEdgeIdentitySchema
) {}

const digest = makeLogicalEdgeKey({ LogicalEdgeIdentity, LogicalEdgeKey });

/**
 * Total canonical string encoding of a {@link LogicalEdgeIdentity}. Every
 * component is present in every encoding — absent scopes render as a dedicated
 * marker rather than being skipped — and every free-form component is escaped
 * before joining, so no two distinct identities can produce the same string by
 * omission or by delimiter injection.
 *
 * **Example** (Encode identity canonically)
 *
 * ```ts
 * import { encodeLogicalEdgeIdentity, LogicalEdgeIdentity } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(LogicalEdgeIdentity)({
 *   evidenceScope: null,
 *   matterScope: null,
 *   orgScope: "1",
 *   qualifiers: {},
 *   relation: "supports",
 *   source: { kind: "claim", claimId: 1 },
 *   target: { kind: "claim", claimId: 2 }
 * })
 *
 * console.log(encodeLogicalEdgeIdentity(identity))
 * // "v1|supports|claim:1|claim:2|1|<none>|<none>|"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeLogicalEdgeIdentity: (identity: LogicalEdgeIdentity) => string = digest.encodeLogicalEdgeIdentity;

/**
 * The {@link LogicalEdgeKey} naming the logical edge an identity denotes:
 * the SHA-256 digest of its canonical encoding. Equivalent presentations of one
 * edge collapse to one key, and distinct edges never merge.
 *
 * **Example** (Hash identity to key)
 *
 * ```ts
 * import { logicalEdgeKey, LogicalEdgeIdentity } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(LogicalEdgeIdentity)({
 *   evidenceScope: null,
 *   matterScope: null,
 *   orgScope: "1",
 *   qualifiers: {},
 *   relation: "supports",
 *   source: { kind: "claim", claimId: 1 },
 *   target: { kind: "claim", claimId: 2 }
 * })
 *
 * console.log(logicalEdgeKey(identity).length) // 64
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const logicalEdgeKey: (identity: LogicalEdgeIdentity) => LogicalEdgeKey = digest.logicalEdgeKey;
