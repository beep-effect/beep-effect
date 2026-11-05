/**
 * Shared verified input preparation for default and callback resolution.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationMention, CitationMentionReceipt } from "@beep/law-practice-domain/values";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
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
const Input = S.Struct({
  verifiedSource: SourceProof,
  engineArtifact: Sha256Hex,
  mentions: S.Array(CitationMention),
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
  editions: S.Array(CitationAuthorityEdition),
  limits: CitationEngineLimits,
}).pipe(
  $I.annoteSchema("Snapshot", { description: "Structural resolution inputs copied before asynchronous verification." })
);
const Json = S.fromJsonString(Snapshot);
/**
 * Shared post-verification inputs for private resolution stages.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const PreparedCitationResolution = S.Struct({ ...Snapshot.fields, mentions: S.Array(CitationMention) }).pipe(
  $I.annoteSchema("PreparedCitationResolution", {
    description: "Restored resolution inputs with genuine occurrence evidence.",
  })
);
/**
 * Schema-derived prepared resolution input.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type PreparedCitationResolution = typeof PreparedCitationResolution.Type;
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
  { reason: Reason },
  $I.annoteError<CitationResolutionInputFailure>("CitationResolutionInputFailure", {
    description: "Resolution input verification failed without caller data or nested causes.",
  })
) {}
const invalid = () => CitationResolutionInputFailure.make({ reason: "invalid-input" });
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
  const json = yield* S.encodeEffect(Json)({
    source: source.source,
    engineArtifact: decoded.engineArtifact,
    mentions: A.map(decoded.mentions, captureCitationMentionReceiptData),
    editions: decoded.editions,
    limits: decoded.limits,
  }).pipe(Effect.mapError(invalid));
  const snapshot = yield* S.decodeEffect(Json)(json).pipe(Effect.mapError(invalid));
  const editions = HashMap.fromIterable(A.map(snapshot.editions, (edition) => Tuple.make(edition.edition, edition)));
  if (HashMap.size(editions) !== A.length(snapshot.editions)) return yield* invalid();
  if (
    A.length(snapshot.mentions) > snapshot.limits.mentions ||
    Str.length(source.sourceText) > snapshot.limits.sourceUtf16
  )
    return yield* CitationResolutionInputFailure.make({ reason: "limit-exceeded" });
  const mentions = yield* Effect.forEach(
    snapshot.mentions,
    (mention) =>
      restoreCitationMentionAgainstVerifiedSource(mention, source, snapshot.engineArtifact).pipe(
        Effect.mapError(() => CitationResolutionInputFailure.make({ reason: "evidence-failed" }))
      ),
    { concurrency: 1 }
  );
  return { ...snapshot, mentions };
});
