/**
 * Pinned historical `cm1` mention encoder and `citation-authority/v1`
 * case-occurrence key, kept to check and convert stored v3 receipts.
 *
 * **Details**
 *
 * Nothing here mints a live identifier: live mention ids are `cm2` from
 * `MentionIdentity.ts`. The receipt read codec recomputes each stored `cm1`
 * from its own receipt fields and refuses a mismatch, and finds case-occurrence
 * authorities by recomputing their v1 key. The bytes are frozen; never edit
 * a tuple position or a tag.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import { CitationMentionIdentityFailure, SemanticKind } from "./MentionIdentity.ts";
import type { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import type * as Digest from "effect/crypto/Digest";

const $I = $LawPracticeServerId.create("internal/Citation/MentionIdentityV1");
const encoder = new TextEncoder();

/**
 * Frozen `cm1:` mention token of `citation-mention-receipt/v1`.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationMentionIdV1 = S.TemplateLiteral(["cm1:", Sha256Hex]).pipe(
  $I.annoteSchema("CitationMentionIdV1", {
    description: "Frozen version-one mention token, read only from stored v3 receipts.",
  })
);

/**
 * Frozen `ca1:` authority token as stored in a v3 receipt.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationAuthorityIdV1 = S.TemplateLiteral(["ca1:", Sha256Hex]).pipe(
  $I.annoteSchema("CitationAuthorityIdV1", {
    description: "Frozen authority token of a stored v3 receipt; independent of the live authority schema.",
  })
);

const invalidInput = () => CitationMentionIdentityFailure.make({ reason: "invalid-input" });
const digestFailed = () => CitationMentionIdentityFailure.make({ reason: "digest-failed" });

const IdentityPreimageV1 = S.fromJsonString(
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
  $I.annoteSchema("IdentityPreimageV1", {
    description:
      "Frozen ordered JSON protocol of cm1: source identity fields, engine, semantic kind and exact raw anchor.",
  })
);

const CaseOccurrenceKeyV1 = S.fromJsonString(
  S.Tuple([S.tag("citation-authority/v1"), S.tag("case-occurrence"), CitationMentionIdV1])
).pipe(
  $I.annoteSchema("CaseOccurrenceKeyV1", {
    description: "Frozen version-one case-occurrence authority key over a cm1 mention token.",
  })
);

const sha256Hex = (text: string) =>
  S.decodeEffect(Sha256HexFromBytes)(encoder.encode(text)).pipe(
    Effect.mapError(digestFailed),
    Effect.catchDefect(flow(digestFailed, Effect.fail))
  );

/**
 * Recompute the `cm1` token of a stored mention from its own anchor receipt,
 * engine artifact and semantic kind.
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const citationMentionIdV1 = Effect.fn("Citation.mentionIdV1")(function* (
  receipt: TextAnchorVerificationReceipt,
  engineArtifact: Sha256Hex,
  semanticKind: string
): Effect.fn.Return<typeof CitationMentionIdV1.Type, CitationMentionIdentityFailure, Digest.Digest> {
  const { anchor, source } = receipt;
  const preimage = yield* S.encodeEffect(IdentityPreimageV1)([
    "citation-mention/v1",
    engineArtifact,
    semanticKind,
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
  ]).pipe(Effect.mapError(invalidInput));
  const digest = yield* sha256Hex(preimage);
  return CitationMentionIdV1.make(`cm1:${digest}`);
});

/**
 * Recompute the `citation-authority/v1` case-occurrence key of a `cm1` mention.
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const caseOccurrenceKeyV1 = Effect.fn("Citation.caseOccurrenceKeyV1")(function* (
  mentionId: typeof CitationMentionIdV1.Type
): Effect.fn.Return<typeof CitationAuthorityIdV1.Type, CitationMentionIdentityFailure, Digest.Digest> {
  const preimage = yield* S.encodeEffect(CaseOccurrenceKeyV1)([
    "citation-authority/v1",
    "case-occurrence",
    mentionId,
  ]).pipe(Effect.mapError(invalidInput));
  const digest = yield* sha256Hex(preimage);
  return CitationAuthorityIdV1.make(`ca1:${digest}`);
});
