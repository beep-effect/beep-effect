/**
 * Shared verified input preparation for default and callback resolution.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationMention, CitationMentionReceipt } from "@beep/law-practice-domain/values";
import { CitationEngineLimits, CitationSafetyBudget } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  toTextAnchorVerificationReceipt,
  VerifiedSourceText,
  VerifiedTextAnchor,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationAuthorityEdition } from "./AuthorityIdentity.ts";
import { captureCitationMentionReceiptData, restoreCitationMentionAgainstVerifiedSource } from "./Mention.ts";
import type * as Digest from "effect/crypto/Digest";

const $I = $LawPracticeServerId.create("internal/Citation/ResolutionInput");
const SourceProof: S.Codec<VerifiedSourceText> = VerifiedSourceText;
const AnchorProof: S.Codec<VerifiedTextAnchor> = VerifiedTextAnchor;
const sameSource = S.toEquivalence(SourceTextIdentity);
const Input = S.Struct({
  verifiedSource: SourceProof,
  engineArtifact: Sha256Hex,
  mentions: S.Array(CitationMention),
  excludedAnchors: S.Array(AnchorProof).pipe(S.optionalKey),
  editions: S.Array(CitationAuthorityEdition),
  limits: CitationEngineLimits,
}).pipe(
  $I.annoteSchema("Input", {
    description: "Genuine source capability, ordered verified mentions and trusted policy/artifact inputs.",
  })
);
const InputType = S.toType(Input);

const Snapshot = S.Struct({
  source: SourceTextIdentity,
  engineArtifact: Sha256Hex,
  mentions: S.Array(CitationMentionReceipt),
  excludedAnchors: S.Array(TextAnchor),
  editions: S.Array(CitationAuthorityEdition),
  limits: CitationEngineLimits,
}).pipe(
  $I.annoteSchema("Snapshot", { description: "Structural resolution inputs copied before asynchronous verification." })
);
const Json = S.fromJsonString(Snapshot);
const PreparedFields: {
  readonly source: typeof SourceTextIdentity;
  readonly engineArtifact: typeof Sha256Hex;
  readonly mentions: S.$Array<typeof CitationMention>;
  readonly excludedAnchors: S.$Array<S.Codec<VerifiedTextAnchor>>;
  readonly editions: S.$Array<typeof CitationAuthorityEdition>;
  readonly limits: typeof CitationEngineLimits;
} = {
  ...Snapshot.fields,
  mentions: S.Array(CitationMention),
  excludedAnchors: S.Array(AnchorProof),
};
/**
 * Shared post-verification inputs for private resolution stages.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PreparedCitationResolution extends S.Opaque<
  PreparedCitationResolution,
  { readonly brand: unique symbol }
>()(
  S.Struct(PreparedFields).pipe(
    $I.annoteSchema("PreparedCitationResolution", {
      description: "Restored resolution inputs with genuine occurrence evidence.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-input", "evidence-failed", "limit-exceeded"]).pipe(
  $I.annoteSchema("Reason", { description: "Finite private resolution input failures." })
);
/**
 * Sanitized shared input failure.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationResolutionInputFailure extends S.TaggedError<
  CitationResolutionInputFailure,
  { readonly brand: unique symbol }
>($I`CitationResolutionInputFailure`)(
  "CitationResolutionInputFailure",
  { reason: Reason, limit: S.optionalKey(CitationSafetyBudget) },
  $I.annoteError<CitationResolutionInputFailure>("CitationResolutionInputFailure", {
    description: "Resolution input verification failed without caller data or nested causes.",
  })
) {}
const invalid = () => CitationResolutionInputFailure.make({ reason: "invalid-input" });
const validateMentionOrder = Effect.fnUntraced(function* (mentions: typeof Snapshot.Type.mentions) {
  let previousEnd = 0;
  for (const mention of mentions) {
    const anchor = mention.anchor.anchor;
    if (anchor.startChar < previousEnd) return yield* invalid();
    previousEnd = anchor.endChar;
  }
});
const advancePastMentions = (mentions: typeof Snapshot.Type.mentions, startChar: number, index: number) => {
  let next = index;
  while (next < A.length(mentions) && A.getUnsafe(mentions, next).anchor.anchor.endChar <= startChar) next += 1;
  return next;
};
const validateExcludedOrder = Effect.fnUntraced(function* (snapshot: typeof Snapshot.Type) {
  yield* validateMentionOrder(snapshot.mentions);
  let previousEnd = 0;
  let mentionIndex = 0;
  for (const anchor of snapshot.excludedAnchors) {
    if (anchor.startChar < previousEnd) return yield* invalid();
    previousEnd = anchor.endChar;
    mentionIndex = advancePastMentions(snapshot.mentions, anchor.startChar, mentionIndex);
    if (
      mentionIndex < A.length(snapshot.mentions) &&
      A.getUnsafe(snapshot.mentions, mentionIndex).anchor.anchor.startChar < anchor.endChar
    )
      return yield* invalid();
  }
});
/**
 * Snapshot all inputs and restore every occurrence against the supplied source
 * capability before either resolver executes callbacks or legal matching.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const prepareCitationResolution = Effect.fn("Citation.prepareResolution")(function* (
  input: unknown
): Effect.fn.Return<PreparedCitationResolution, CitationResolutionInputFailure, Digest.Digest> {
  const decoded = yield* S.decodeUnknownEffect(InputType)(input).pipe(Effect.mapError(invalid));
  const source = decoded.verifiedSource;
  const hasExcluded = decoded.excludedAnchors !== undefined;
  const excluded = decoded.excludedAnchors ?? [];
  if (hasExcluded && A.length(excluded) + A.length(decoded.mentions) > decoded.limits.candidates)
    return yield* CitationResolutionInputFailure.make({ reason: "limit-exceeded", limit: "candidates" });
  if (!A.every(excluded, (anchor) => sameSource(anchor.source, source.source)))
    return yield* CitationResolutionInputFailure.make({ reason: "evidence-failed" });
  if (A.length(decoded.mentions) > decoded.limits.mentions)
    return yield* CitationResolutionInputFailure.make({ reason: "limit-exceeded", limit: "mentions" });
  if (Str.length(source.sourceText) > decoded.limits.sourceUtf16)
    return yield* CitationResolutionInputFailure.make({ reason: "limit-exceeded", limit: "sourceUtf16" });
  const json = yield* S.encodeEffect(Json)({
    source: source.source,
    engineArtifact: decoded.engineArtifact,
    mentions: A.map(decoded.mentions, captureCitationMentionReceiptData),
    excludedAnchors: A.map(excluded, (anchor) => toTextAnchorVerificationReceipt(anchor).anchor),
    editions: decoded.editions,
    limits: decoded.limits,
  }).pipe(Effect.mapError(invalid));
  const snapshot = yield* S.decodeEffect(Json)(json).pipe(Effect.mapError(invalid));
  if (hasExcluded) yield* validateExcludedOrder(snapshot);
  const editions = HashMap.fromIterable(A.map(snapshot.editions, (edition) => Tuple.make(edition.edition, edition)));
  if (HashMap.size(editions) !== A.length(snapshot.editions)) return yield* invalid();
  const mentions = yield* Effect.forEach(
    snapshot.mentions,
    (mention) =>
      restoreCitationMentionAgainstVerifiedSource(mention, source, snapshot.engineArtifact).pipe(
        Effect.mapError(() => CitationResolutionInputFailure.make({ reason: "evidence-failed" }))
      ),
    { concurrency: 1 }
  );
  const excludedAnchors = yield* Effect.forEach(
    snapshot.excludedAnchors,
    (anchor) =>
      verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({ verifiedSource: source, anchor })
      ).pipe(Effect.mapError(() => CitationResolutionInputFailure.make({ reason: "evidence-failed" }))),
    { concurrency: 1 }
  );
  return PreparedCitationResolution.make({
    ...snapshot,
    mentions,
    excludedAnchors,
  });
});
