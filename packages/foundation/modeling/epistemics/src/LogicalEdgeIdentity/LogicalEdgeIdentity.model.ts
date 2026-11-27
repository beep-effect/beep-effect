/**
 * Logical edge identity schema factory and digest.
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

import { $EpistemicsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import { A, O, R, Str } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { flow, pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { EdgeEndpointShape, encodeEdgeEndpointKey } from "../EdgeEndpoint/index.ts";
import { EdgeRelation, isSymmetricEdgeRelation } from "../EdgeRelation/index.ts";
import type { SchemaIdentity } from "../Factory/index.ts";

const canonicalEncodingVersion = "v1";

const absentScopeMarker = "<none>";

/**
 * Build the logical edge identity schemas over a caller-bound edge endpoint
 * schema.
 *
 * **Details**
 *
 * Returns the scope and qualifier schemas, `LogicalEdgeKey`, and
 * `LogicalEdgeIdentitySchema`, the annotated struct a binding wraps in its own
 * `S.Opaque` class. Pair it with {@link makeLogicalEdgeKey} once that class
 * exists. Every schema is annotated with the caller's `$I`.
 *
 * **Example** (Bind logical edge identity to a local endpoint)
 *
 * ```ts
 * import { makeEdgeEndpoint } from "@beep/epistemics/EdgeEndpoint"
 * import { makeLogicalEdgeIdentity } from "@beep/epistemics/LogicalEdgeIdentity"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const endpoints = makeEdgeEndpoint({
 *   $I: $ScratchpadId.create("party/EdgeEndpoint"),
 *   ids: { candidateClaim: S.String.pipe(S.brand("ClaimId")), evidence: S.String.pipe(S.brand("EvidenceId")) }
 * })
 * const { LogicalEdgeIdentitySchema } = makeLogicalEdgeIdentity({
 *   $I: $ScratchpadId.create("party/LogicalEdgeIdentity"),
 *   EdgeEndpoint: endpoints.EdgeEndpoint
 * })
 *
 * console.log(Object.keys(LogicalEdgeIdentitySchema.fields).length) // 7
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLogicalEdgeIdentity = <Endpoint extends S.Top>(config: {
  readonly $I: SchemaIdentity;
  readonly EdgeEndpoint: Endpoint;
}) => {
  const { $I, EdgeEndpoint } = config;

  const EdgeOrgScope = S.NonEmptyString.pipe(
    $I.annoteSchema("EdgeOrgScope", {
      description: "Stringified owning organization id that scopes a logical epistemic edge.",
    })
  );

  const EdgeMatterScope = S.NonEmptyString.pipe(
    $I.annoteSchema("EdgeMatterScope", {
      description: "Optional matter scope narrowing a logical epistemic edge.",
    })
  );

  const EdgeEvidenceScope = S.NonEmptyString.pipe(
    $I.annoteSchema("EdgeEvidenceScope", {
      description: "Optional evidence-set scope narrowing a logical epistemic edge.",
    })
  );

  const EdgeQualifiers = S.Record(S.String, S.String).pipe(
    $I.annoteSchema("EdgeQualifiers", {
      description: "Order-insensitive string qualifiers that further partition a logical epistemic edge.",
    })
  );

  const LogicalEdgeKey = Sha256Hex.pipe(
    S.brand("LogicalEdgeKey"),
    $I.annoteSchema("LogicalEdgeKey", {
      description: "Lowercase SHA-256 hex digest naming one logical epistemic edge.",
    })
  );

  const LogicalEdgeIdentitySchema = S.Struct({
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
  }).pipe(
    $I.annoteSchema("LogicalEdgeIdentity", {
      description: "Time-independent identity of a bitemporal epistemic edge.",
    })
  );

  return {
    EdgeOrgScope,
    EdgeMatterScope,
    EdgeEvidenceScope,
    EdgeQualifiers,
    LogicalEdgeKey,
    LogicalEdgeIdentitySchema,
  };
};

const escapeCanonicalComponent: (value: string) => string = flow(
  Str.replaceAll("%", "%25"),
  Str.replaceAll("|", "%7C")
);

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

const encodeQualifiers = (qualifiers: { readonly [key: string]: string }): string =>
  pipe(
    R.toEntries(qualifiers),
    A.sort(byEntryKey),
    A.map(([key, value]) => `${escapeQualifierComponent(key)}=${escapeQualifierComponent(value)}`),
    A.join(",")
  );

const $I = $EpistemicsId.create("LogicalEdgeIdentity/LogicalEdgeIdentity.model");

const LogicalEdgeIdentityShapeSchema = S.Struct({
  evidenceScope: S.Option(S.String),
  matterScope: S.Option(S.String),
  orgScope: S.String,
  qualifiers: S.Record(S.String, S.String),
  relation: EdgeRelation,
  source: EdgeEndpointShape,
  target: EdgeEndpointShape,
}).pipe(
  $I.annoteSchema("LogicalEdgeIdentityShape", {
    description: "Fields of any bound logical edge identity read by the canonical encoding.",
  })
);

/**
 * Fields of any bound logical edge identity read by the canonical encoding.
 *
 * **Example** (Type the encoded identity shape)
 *
 * ```ts
 * import type { LogicalEdgeIdentityShape } from "@beep/epistemics/LogicalEdgeIdentity"
 * import * as O from "effect/Option"
 *
 * const identity: LogicalEdgeIdentityShape = {
 *   evidenceScope: O.none(),
 *   matterScope: O.none(),
 *   orgScope: "1",
 *   qualifiers: {},
 *   relation: "supports",
 *   source: { kind: "claim", claimId: 1 },
 *   target: { kind: "claim", claimId: 2 }
 * }
 * console.log(identity.relation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LogicalEdgeIdentityShape = typeof LogicalEdgeIdentityShapeSchema.Type;

/**
 * Build the canonical encoding and digest over a caller-bound logical edge
 * identity class.
 *
 * **Details**
 *
 * `encodeLogicalEdgeIdentity` folds the relation, both endpoints (swapped into
 * a canonical order for symmetric relations), the org scope, optional matter
 * and evidence scopes, and sorted qualifiers into one escaped `|`-joined string
 * prefixed with the encoding version. `logicalEdgeKey` is its lowercase SHA-256
 * hex digest. Both functions are typed on the caller's identity class.
 *
 * Every component is percent-escaped, `%` first, so no free-form scope or
 * endpoint ref can smuggle the `|` delimiter in and merge two identities onto
 * one key; qualifier keys and values also escape `=` and `,`. An absent scope
 * encodes as a marker token distinct from every present `some:` scope.
 *
 * **Gotchas**
 *
 * This is a pinned encoder (see "Pinned encoders" in the `@beep/jsonc`
 * README): the logical edge key is stored in SQL, so the `|`-joined preimage
 * keeps its exact bytes and never moves to the canonical JSON owner. A new
 * format needs a new encoding version, never an edit to this one, so old and
 * new keys never collide in a table that holds both.
 *
 * **Example** (Digest a bound logical edge identity)
 *
 * ```ts
 * import { makeEdgeEndpoint } from "@beep/epistemics/EdgeEndpoint"
 * import { makeLogicalEdgeIdentity, makeLogicalEdgeKey } from "@beep/epistemics/LogicalEdgeIdentity"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const endpoints = makeEdgeEndpoint({
 *   $I: $ScratchpadId.create("party/EdgeEndpoint"),
 *   ids: { candidateClaim: S.String.pipe(S.brand("ClaimId")), evidence: S.String.pipe(S.brand("EvidenceId")) }
 * })
 * const schemas = makeLogicalEdgeIdentity({
 *   $I: $ScratchpadId.create("party/LogicalEdgeIdentity"),
 *   EdgeEndpoint: endpoints.EdgeEndpoint
 * })
 * const { logicalEdgeKey } = makeLogicalEdgeKey({
 *   LogicalEdgeIdentity: schemas.LogicalEdgeIdentitySchema,
 *   LogicalEdgeKey: schemas.LogicalEdgeKey
 * })
 *
 * const identity = S.decodeUnknownSync(schemas.LogicalEdgeIdentitySchema)({
 *   evidenceScope: null,
 *   matterScope: null,
 *   orgScope: "1",
 *   qualifiers: {},
 *   relation: "supports",
 *   source: { kind: "evidence", evidenceId: "e-1" },
 *   target: { kind: "claim", claimId: "c-1" }
 * })
 * console.log(logicalEdgeKey(identity).length) // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLogicalEdgeKey = <Identity extends S.Top & { readonly Type: LogicalEdgeIdentityShape }, Key>(config: {
  readonly LogicalEdgeIdentity: Identity;
  readonly LogicalEdgeKey: { readonly make: (digest: string) => Key };
}) => {
  const { LogicalEdgeKey } = config;

  const orderEndpoints = (identity: Identity["Type"]): ReadonlyArray<string> =>
    pipe(
      [
        escapeCanonicalComponent(encodeEdgeEndpointKey(identity.source)),
        escapeCanonicalComponent(encodeEdgeEndpointKey(identity.target)),
      ],
      (endpoints) => (isSymmetricEdgeRelation(identity.relation) ? A.sort(endpoints, Order.String) : endpoints)
    );

  const encodeLogicalEdgeIdentity = (identity: Identity["Type"]): string =>
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

  const logicalEdgeKey = (identity: Identity["Type"]): Key =>
    LogicalEdgeKey.make(bytesToHex(sha256(utf8ToBytes(encodeLogicalEdgeIdentity(identity)))));

  return { encodeLogicalEdgeIdentity, logicalEdgeKey };
};
