/**
 * Private, verified-source-bound occurrence identity production.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationMentionId } from "@beep/law-practice-domain/values";
import { VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type * as Crypto from "effect/Crypto";

const $I = $LawPracticeServerId.create("internal/Citation/MentionIdentity");
const encoder = new TextEncoder();
// Preserve the prerequisite public type name in declaration output.
const AnchorProof: S.Codec<VerifiedTextAnchor> = VerifiedTextAnchor;
const SemanticKind = S.NonEmptyString.check(S.isMaxLength(128)).pipe(
  $I.annoteSchema("SemanticKind", {
    description: "Bounded semantic discriminant supplied by the semantic citation union; not a second tag inventory.",
  })
);

// This is a schema field descriptor, not an independent data model. Naming the
// descriptor retains the prerequisite's opaque public type in declarations.
type IdentityFields = {
  readonly anchor: S.Codec<VerifiedTextAnchor>;
  readonly engineArtifact: typeof Sha256Hex;
  readonly semanticKind: typeof SemanticKind;
};
const IdentityFields: IdentityFields = {
  anchor: AnchorProof,
  engineArtifact: Sha256Hex,
  semanticKind: SemanticKind,
};

/**
 * Internal input requiring a genuine prerequisite-issued runtime proof.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationMentionIdentityInput extends S.Opaque<
  CitationMentionIdentityInput,
  { readonly brand: unique symbol }
>()(
  S.Struct(IdentityFields).pipe(
    $I.annoteSchema("CitationMentionIdentityInput", {
      description: "Verified occurrence, content-addressed engine artifact and semantic union discriminant.",
    })
  )
) {}

const FailureReason = LiteralKit(["invalid-input", "digest-failed"]).pipe(
  $I.annoteSchema("FailureReason", { description: "Sanitized internal identity-production failure reasons." })
);

/**
 * Sanitized private failure, mapped to the engine's closed boundary union later.
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationMentionIdentityFailure extends S.TaggedError<
  CitationMentionIdentityFailure,
  { readonly brand: unique symbol }
>($I`CitationMentionIdentityFailure`)(
  "CitationMentionIdentityFailure",
  { reason: FailureReason },
  $I.annoteError<CitationMentionIdentityFailure>("CitationMentionIdentityFailure", {
    description: "Occurrence identity production failed without retaining raw source, schema issues or crypto causes.",
  })
) {}

// An ordered tuple fixes field order independently of object insertion order.
// Keep the protocol/version and every position frozen for cm1; change the token
// version if the identity inputs or encoding protocol change.
const IdentityPreimage = S.fromJsonString(
  S.Tuple([
    S.tag("citation-mention/v1"),
    Sha256Hex,
    SemanticKind,
    S.NonEmptyString,
    S.NonEmptyString,
    S.NonEmptyString,
    S.NonEmptyString,
    S.NonEmptyString,
    S.NonEmptyString,
    S.NonEmptyString,
    S.NonEmptyString,
    S.Natural,
    S.Natural,
    S.String,
  ])
).pipe(
  $I.annoteSchema("IdentityPreimage", {
    description:
      "Frozen ordered JSON protocol binding all source identity fields, engine, semantic kind and exact raw anchor.",
  })
);

/**
 * Produce cm1 only from a genuine verified anchor, never a structural receipt.
 *
 * Source identity, engine artifact, semantic kind, UTF-16 range and exact quote
 * determine the token. Stage order, array position and grouping do not enter
 * its identity. Input snapshots are encoded before the asynchronous hash.
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const makeCitationMentionId = Effect.fn("Citation.makeMentionId")(function* (
  input: unknown
): Effect.fn.Return<CitationMentionId, CitationMentionIdentityFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(CitationMentionIdentityInput)(input).pipe(
    Effect.mapError(() => CitationMentionIdentityFailure.make({ reason: "invalid-input" }))
  );
  const source = decoded.anchor.source;
  const anchor = decoded.anchor.anchor;
  const preimage = yield* S.encodeEffect(IdentityPreimage)([
    "citation-mention/v1",
    decoded.engineArtifact,
    decoded.semanticKind,
    source.scopeRef,
    source.sourceRef,
    source.locator,
    source.sourceDigest,
    source.textDigest,
    source.extractor.name,
    source.extractor.version,
    source.normalizationVersion,
    anchor.startChar,
    anchor.endChar,
    anchor.quote,
  ]).pipe(Effect.mapError(() => CitationMentionIdentityFailure.make({ reason: "invalid-input" })));
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(preimage)).pipe(
    Effect.mapError(() => CitationMentionIdentityFailure.make({ reason: "digest-failed" }))
  );
  return CitationMentionId.make(`cm1:${digest}`);
});
