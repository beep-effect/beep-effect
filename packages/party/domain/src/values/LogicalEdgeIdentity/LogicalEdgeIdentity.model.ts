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
import { $PartyDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { EdgeEndpoint } from "../EdgeEndpoint/index.ts";

const schemas = makeLogicalEdgeIdentity({
  $I: $PartyDomainId.create("values/LogicalEdgeIdentity/LogicalEdgeIdentity.model"),
  EdgeEndpoint,
});

/**
 * Organization scope of a logical edge: the stringified owning organization id.
 * Every edge is org-scoped, so this component is never absent.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeOrgScope } from "@beep/party-domain/LogicalEdgeIdentity"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeOrgScope)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeOrgScope = schemas.EdgeOrgScope;

/**
 * Runtime type for {@link EdgeOrgScope}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeOrgScope = typeof EdgeOrgScope.Type;

/**
 * Optional matter scope narrowing a logical edge to one matter. Two edges that
 * differ only in matter scope are different logical edges.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeMatterScope } from "@beep/party-domain/LogicalEdgeIdentity"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeMatterScope)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeMatterScope = schemas.EdgeMatterScope;

/**
 * Runtime type for {@link EdgeMatterScope}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeMatterScope = typeof EdgeMatterScope.Type;

/**
 * Optional evidence-set scope narrowing a logical edge to one evidence set.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeEvidenceScope } from "@beep/party-domain/LogicalEdgeIdentity"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeEvidenceScope)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEvidenceScope = schemas.EdgeEvidenceScope;

/**
 * Runtime type for {@link EdgeEvidenceScope}.
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeQualifiers } from "@beep/party-domain/LogicalEdgeIdentity"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeQualifiers)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeQualifiers = schemas.EdgeQualifiers;

/**
 * Runtime type for {@link EdgeQualifiers}.
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { LogicalEdgeKey } from "@beep/party-domain/LogicalEdgeIdentity"
 * import * as S from "effect/Schema"
 * const accepts = S.is(LogicalEdgeKey)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LogicalEdgeKey = schemas.LogicalEdgeKey;

/**
 * Runtime type for {@link LogicalEdgeKey}.
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { LogicalEdgeIdentity } from "@beep/party-domain/LogicalEdgeIdentity"
 * import * as S from "effect/Schema"
 * const accepts = S.is(LogicalEdgeIdentity)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { encodeLogicalEdgeIdentity } from "@beep/party-domain/LogicalEdgeIdentity"
 * const binding = encodeLogicalEdgeIdentity
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { logicalEdgeKey } from "@beep/party-domain/LogicalEdgeIdentity"
 * const binding = logicalEdgeKey
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const logicalEdgeKey: (identity: LogicalEdgeIdentity) => LogicalEdgeKey = digest.logicalEdgeKey;
