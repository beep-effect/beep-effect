/**
 * Private, verified-source-bound occurrence identity production.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { definePreimage } from "@beep/jsonc/Mint";
import { CitationMentionId } from "@beep/law-practice-domain/values";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { Anchored, mintOccurrenceId, OccurrenceId } from "@beep/text/Occurrence";
import { toTextAnchorVerificationReceipt, VerifiedTextAnchor } from "@beep/text/VerifiedTextAnchor";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import type * as Digest from "effect/crypto/Digest";

const $I = $LawPracticeServerId.create("internal/Citation/MentionIdentity");
// Preserve the prerequisite public type name in declaration output.
const AnchorProof: S.Codec<VerifiedTextAnchor> = VerifiedTextAnchor;
/**
 * Bounded semantic discriminant hashed into a mention id.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const SemanticKind = S.NonEmptyString.check(S.isMaxLength(128)).pipe(
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

const invalidInput = () => CitationMentionIdentityFailure.make({ reason: "invalid-input" });
const digestFailed = () => CitationMentionIdentityFailure.make({ reason: "digest-failed" });

/**
 * The `citation-mention/v2` preimage: engine artifact, semantic kind and the
 * `OccurrenceId` of the verified anchor, with its committed golden vector.
 *
 * **Details**
 *
 * The occurrence id carries the whole text capture identity, the UTF-16 range
 * and the exact quote, so the mention preimage adds only what a citation
 * engine decides. A changed element list bumps the domain tag.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationMentionPreimage = definePreimage({
  domainTag: DomainTag.make("citation-mention/v2"),
  schema: S.Tuple([Sha256Hex, SemanticKind, OccurrenceId]),
  golden: {
    preimage: [
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "case",
      "sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48",
    ],
    hash: ContentHash.make("sha256:7ece8d5655b197d8063442248a8f630cd05fee535fe5ae550f2b15754425cd44"),
  },
});

/**
 * Mint a `cm2:` id from an anchor receipt, an engine artifact and a semantic
 * kind: the occurrence id of the receipt, then the mention preimage over it.
 *
 * **Details**
 *
 * The receipt is a powerless value; minting proves nothing about the text.
 * Live producers call {@link makeCitationMentionId}, which requires a genuine
 * proof first. The receipt read codec calls this directly, because a stored
 * receipt holds no proof and restoration re-verifies it afterwards.
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const mintCitationMentionId = Effect.fn("Citation.mintMentionId")(function* (
  receipt: TextAnchorVerificationReceipt,
  engineArtifact: Sha256Hex,
  semanticKind: string
): Effect.fn.Return<CitationMentionId, CitationMentionIdentityFailure, Digest.Digest> {
  const occurrence = yield* mintOccurrenceId(Anchored.make({ receipt })).pipe(
    Effect.mapError(invalidInput),
    Effect.catchDefect(flow(digestFailed, Effect.fail))
  );
  const hash = yield* CitationMentionPreimage.mint([engineArtifact, semanticKind, occurrence]).pipe(
    Effect.mapError(invalidInput),
    Effect.catchDefect(flow(digestFailed, Effect.fail))
  );
  return CitationMentionId.make(`cm2:${Str.slice(7)(hash)}`);
});

/**
 * Produce cm2 only from a genuine verified anchor, never a structural receipt.
 *
 * Source identity, UTF-16 range and exact quote enter through the anchor's
 * `OccurrenceId`; engine artifact and semantic kind are hashed beside it. Stage
 * order, array position and grouping do not enter its identity. Input is
 * decoded into a snapshot before the asynchronous hashes.
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const makeCitationMentionId = Effect.fn("Citation.makeMentionId")(function* (
  input: unknown
): Effect.fn.Return<CitationMentionId, CitationMentionIdentityFailure, Digest.Digest> {
  const decoded = yield* S.decodeUnknownEffect(CitationMentionIdentityInput)(input).pipe(Effect.mapError(invalidInput));
  return yield* mintCitationMentionId(
    toTextAnchorVerificationReceipt(decoded.anchor),
    decoded.engineArtifact,
    decoded.semanticKind
  );
});
