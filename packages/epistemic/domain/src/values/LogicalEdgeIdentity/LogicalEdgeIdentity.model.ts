/**
 * Logical edge identity value object and digest.
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
import { $EpistemicDomainId } from "@beep/identity/packages";
import { SchemaUtils, Sha256Hex } from "@beep/schema";
import { A, O, R, Str } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { flow, Order, pipe } from "effect";
import * as S from "effect/Schema";
import { EdgeEndpoint, encodeEdgeEndpointKey } from "../EdgeEndpoint/index.ts";
import { EdgeRelation, isSymmetricEdgeRelation } from "../EdgeRelation/index.ts";

const $I = $EpistemicDomainId.create("values/LogicalEdgeIdentity/LogicalEdgeIdentity.model");

/**
 * Digest version prefix. Bump it whenever the canonical encoding changes so old
 * and new keys can never collide in a table that holds both.
 */
const canonicalEncodingVersion = "v1";

/**
 * Marker for an absent scope. It is a distinct token rather than an empty string
 * so `none` can never collide with a real scope value — the encoding-side
 * analogue of the SQL NULL hole that motivated the digest column.
 */
const absentScopeMarker = "<none>";

/**
 * Organization scope of a logical edge: the stringified owning organization id.
 * Every edge is org-scoped, so this component is never absent.
 *
 * @example
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
export const EdgeOrgScope = S.NonEmptyString.pipe(
  $I.annoteSchema("EdgeOrgScope", {
    description: "Stringified owning organization id that scopes a logical epistemic edge.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link EdgeOrgScope}.
 *
 * @example
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
 * @example
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
export const EdgeMatterScope = S.NonEmptyString.pipe(
  $I.annoteSchema("EdgeMatterScope", {
    description: "Optional matter scope narrowing a logical epistemic edge.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link EdgeMatterScope}.
 *
 * @example
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
 * @example
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
export const EdgeEvidenceScope = S.NonEmptyString.pipe(
  $I.annoteSchema("EdgeEvidenceScope", {
    description: "Optional evidence-set scope narrowing a logical epistemic edge.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link EdgeEvidenceScope}.
 *
 * @example
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
 * @example
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
export const EdgeQualifiers = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("EdgeQualifiers", {
    description: "Order-insensitive string qualifiers that further partition a logical epistemic edge.",
  })
);

/**
 * Runtime type for {@link EdgeQualifiers}.
 *
 * @example
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
 * @example
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
export const LogicalEdgeKey = Sha256Hex.pipe(
  S.brand("LogicalEdgeKey"),
  $I.annoteSchema("LogicalEdgeKey", {
    description: "Lowercase SHA-256 hex digest naming one logical epistemic edge.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link LogicalEdgeKey}.
 *
 * @example
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
 * @example
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
export class LogicalEdgeIdentity extends S.Class<LogicalEdgeIdentity>($I`LogicalEdgeIdentity`)(
  {
    evidenceScope: EdgeEvidenceScope.pipe(S.OptionFromNullOr).annotateKey({
      description: "Optional evidence-set scope the edge was asserted under.",
    }),
    matterScope: EdgeMatterScope.pipe(S.OptionFromNullOr).annotateKey({
      description: "Optional matter scope the edge was asserted under.",
    }),
    orgScope: EdgeOrgScope.annotateKey({ description: "Stringified owning organization id." }),
    qualifiers: EdgeQualifiers.annotateKey({ description: "Further string qualifiers partitioning the edge." }),
    relation: EdgeRelation.annotateKey({ description: "Relation the source endpoint bears to the target." }),
    source: EdgeEndpoint.annotateKey({ description: "Endpoint recorded as the source of the edge." }),
    target: EdgeEndpoint.annotateKey({ description: "Endpoint recorded as the target of the edge." }),
  },
  $I.annote("LogicalEdgeIdentity", {
    description: "Time-independent identity of a bitemporal epistemic edge.",
  })
) {}

/**
 * Escape one canonical component so the `|` join is injective: free-form
 * values (scopes, endpoint refs) cannot smuggle the component delimiter into
 * the encoding and merge two distinct identities onto one string. `%` escapes
 * first so escaped output can never collide with a literal that already
 * contained an escape sequence.
 */
const escapeCanonicalComponent: (value: string) => string = flow(
  Str.replaceAll("%", "%25"),
  Str.replaceAll("|", "%7C")
);

/**
 * Escape one qualifier key or value: the qualifier sub-encoding additionally
 * owns `=` (entry separator) and `,` (list separator), so both join layers
 * stay injective.
 */
const escapeQualifierComponent: (value: string) => string = flow(
  escapeCanonicalComponent,
  Str.replaceAll("=", "%3D"),
  Str.replaceAll(",", "%2C")
);

const encodeScope: (scope: O.Option<string>) => string = O.match({
  onNone: () => absentScopeMarker,
  onSome: (value) => `some:${escapeCanonicalComponent(value)}`,
});

const byEntryKey = Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0]);

const encodeQualifiers = (qualifiers: EdgeQualifiers): string =>
  pipe(
    R.toEntries(qualifiers),
    A.sort(byEntryKey),
    A.map(([key, value]) => `${escapeQualifierComponent(key)}=${escapeQualifierComponent(value)}`),
    A.join(",")
  );

/**
 * Order the two encoded endpoints. A symmetric relation means the recorded
 * source/target ordering carries no meaning, so both presentations must collapse
 * onto the same canonical pair; an asymmetric relation never swaps. Each
 * encoded endpoint is escaped so a free-form entity/observation ref cannot
 * inject the component delimiter.
 */
const orderEndpoints = (identity: LogicalEdgeIdentity): ReadonlyArray<string> =>
  pipe(
    [
      escapeCanonicalComponent(encodeEdgeEndpointKey(identity.source)),
      escapeCanonicalComponent(encodeEdgeEndpointKey(identity.target)),
    ],
    (endpoints) => (isSymmetricEdgeRelation(identity.relation) ? A.sort(endpoints, Order.String) : endpoints)
  );

/**
 * Total canonical string encoding of a {@link LogicalEdgeIdentity}. Every
 * component is present in every encoding — absent scopes render as a dedicated
 * marker rather than being skipped — and every free-form component is escaped
 * before joining, so no two distinct identities can produce the same string by
 * omission or by delimiter injection.
 *
 * @example
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
export const encodeLogicalEdgeIdentity = (identity: LogicalEdgeIdentity): string =>
  A.join(
    [
      canonicalEncodingVersion,
      identity.relation,
      ...orderEndpoints(identity),
      escapeCanonicalComponent(identity.orgScope),
      encodeScope(identity.matterScope),
      encodeScope(identity.evidenceScope),
      encodeQualifiers(identity.qualifiers),
    ],
    "|"
  );

/**
 * The {@link LogicalEdgeKey} naming the logical edge an identity denotes:
 * the SHA-256 digest of its canonical encoding. Equivalent presentations of one
 * edge collapse to one key, and distinct edges never merge.
 *
 * @example
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
export const logicalEdgeKey = (identity: LogicalEdgeIdentity): LogicalEdgeKey =>
  LogicalEdgeKey.make(bytesToHex(sha256(utf8ToBytes(encodeLogicalEdgeIdentity(identity)))));
