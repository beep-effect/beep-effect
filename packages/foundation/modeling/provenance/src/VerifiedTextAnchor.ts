/**
 * Fail-closed construction of source-identity-bound text anchors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ProvenanceId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes, TaggedErrorClass } from "@beep/schema";
import { Effect } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SourceTextDigest, SourceTextIdentity } from "./SourceTextIdentity.ts";
import { isUtf16Boundary, TextAnchor } from "./TextAnchor.ts";
import type * as Crypto from "effect/Crypto";

const $I = $ProvenanceId.create("VerifiedTextAnchor");
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const sourceTextDigestEquivalence = S.toEquivalence(SourceTextDigest);
const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);
const utf8Encoder = new TextEncoder();

/**
 * Machine-readable reasons a text anchor cannot acquire verified status.
 *
 * **Example** (Check error reason membership)
 *
 * ```ts
 * import { VerifiedTextAnchorErrorReason } from "@beep/provenance/VerifiedTextAnchor"
 *
 * console.log(VerifiedTextAnchorErrorReason.is["quote-mismatch"]("quote-mismatch")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VerifiedTextAnchorErrorReason = LiteralKit([
  "cross-scope",
  "invalid-anchor",
  "quote-mismatch",
  "stale-source",
]).pipe(
  $I.annoteSchema("VerifiedTextAnchorErrorReason", {
    description: "Fail-closed reasons emitted while binding a text anchor to an exact source identity.",
  })
);

/**
 * Type for {@link VerifiedTextAnchorErrorReason}.
 *
 * **Example** (Assign typed error reason)
 *
 * ```ts
 * import type { VerifiedTextAnchorErrorReason } from "@beep/provenance/VerifiedTextAnchor"
 *
 * const reason: VerifiedTextAnchorErrorReason = "stale-source"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type VerifiedTextAnchorErrorReason = typeof VerifiedTextAnchorErrorReason.Type;

/**
 * Sanitized failure emitted by verified-anchor construction.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { VerifiedTextAnchorError } from "@beep/provenance/VerifiedTextAnchor"
 *
 * const error = VerifiedTextAnchorError.fromReason("quote-mismatch")
 * console.log(error.reason) // "quote-mismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VerifiedTextAnchorError extends TaggedErrorClass<VerifiedTextAnchorError>($I`VerifiedTextAnchorError`)(
  "VerifiedTextAnchorError",
  {
    message: S.String,
    reason: VerifiedTextAnchorErrorReason,
  },
  $I.annote("VerifiedTextAnchorError", {
    description: "Sanitized failure emitted when an anchor cannot be proven against the expected exact source.",
  })
) {
  /**
   * Construct an error without retaining source or quote text.
   *
   * @param reason - Machine-readable closed-failure reason.
   * @returns A sanitized verified-anchor error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: VerifiedTextAnchorErrorReason): VerifiedTextAnchorError =>
    VerifiedTextAnchorError.make({
      message: `Verified text anchor rejected: ${reason}.`,
      reason,
    });
}

/**
 * Inputs required to bind an anchor to an expected source identity.
 *
 * **Details**
 *
 * `expectedSource` is the identity authorized by the caller; `source` is the
 * identity actually resolved with `sourceText`. The verifier hashes
 * `sourceText` and requires its digest to match that resolved identity. A
 * mismatch is evidence drift, not permission to rewrite an existing anchor.
 *
 * **Example** (Check sourceText field presence)
 *
 * ```ts
 * import { VerifyTextAnchorInput } from "@beep/provenance/VerifiedTextAnchor"
 *
 * console.log(VerifyTextAnchorInput.fields.sourceText !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifyTextAnchorInput extends S.Class<VerifyTextAnchorInput>($I`VerifyTextAnchorInput`)(
  {
    anchor: TextAnchor,
    expectedSource: SourceTextIdentity,
    source: SourceTextIdentity,
    sourceText: S.String,
  },
  $I.annote("VerifyTextAnchorInput", {
    description:
      "Expected and resolved source identities, raw source text whose digest must match, and candidate anchor to verify.",
  })
) {}

/**
 * Persistable receipt recording an anchor and the source identity against which
 * it was verified.
 *
 * **Details**
 *
 * A receipt is deliberately structural: it preserves the existing
 * `{ anchor, source }` wire contract, but it is not runtime proof. Consumers
 * must resolve the exact source text and call {@link verifyTextAnchor} before
 * using a receipt where current verification is required.
 *
 * **Example** (Check receipt anchor field)
 *
 * ```ts
 * import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor"
 *
 * console.log(TextAnchorVerificationReceipt.fields.anchor !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextAnchorVerificationReceipt extends S.Class<TextAnchorVerificationReceipt>(
  $I`TextAnchorVerificationReceipt`
)(
  {
    anchor: TextAnchor,
    source: SourceTextIdentity,
  },
  $I.annote("TextAnchorVerificationReceipt", {
    description:
      "Persisted anchor and source identity from an earlier verification; re-verification requires canonical source text.",
  })
) {}

class VerifiedTextAnchorValue {
  readonly #verified = true;
  readonly anchor: TextAnchor;
  readonly source: SourceTextIdentity;

  constructor(anchor: TextAnchor, source: SourceTextIdentity) {
    this.anchor = anchor;
    this.source = source;
  }

  static readonly is = (input: unknown): input is VerifiedTextAnchorValue =>
    input instanceof VerifiedTextAnchorValue && input.#verified;
}

/**
 * Opaque runtime proof that a text anchor matches one exact resolved source.
 *
 * **Details**
 *
 * The schema is from-self and the implementation class is module-private, so
 * structural receipts cannot be decoded or constructed as verified values.
 * Only {@link verifyTextAnchor} can create this runtime type.
 *
 * **Example** (Receipt is not runtime proof)
 *
 * ```ts
 * import type {
 *   TextAnchorVerificationReceipt,
 *   VerifiedTextAnchor,
 * } from "@beep/provenance/VerifiedTextAnchor"
 *
 * type ReceiptIsRuntimeProof =
 *   TextAnchorVerificationReceipt extends VerifiedTextAnchor ? true : false
 *
 * const receiptIsRuntimeProof: ReceiptIsRuntimeProof = false
 * console.log(receiptIsRuntimeProof) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VerifiedTextAnchor = VerifiedTextAnchorValue;

/**
 * From-self schema for the opaque runtime verified-anchor proof.
 *
 * **Details**
 *
 * Decoding structural wire data is intentionally rejected because
 * `{ anchor, source }` does not contain the canonical source text needed to
 * prove raw-slice equality.
 *
 * **Example** (Schema rejects structural data)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor"
 *
 * console.log(S.is(VerifiedTextAnchor)({ anchor: {}, source: {} })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VerifiedTextAnchor = S.declare<VerifiedTextAnchor>(VerifiedTextAnchorValue.is).pipe(
  $I.annoteSchema("VerifiedTextAnchor", {
    description:
      "Opaque runtime proof produced only after a candidate anchor is checked against exact canonical source text.",
  })
);

/**
 * Convert an opaque runtime proof into its persistable structural receipt.
 *
 * **Details**
 *
 * The reverse conversion is intentionally unavailable; a receipt must be
 * re-verified with canonical source text.
 *
 * **Example** (Convert verified anchor to receipt)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import {
 *   SourceTextDigest,
 *   SourceTextExtractor,
 *   SourceTextIdentity,
 * } from "@beep/provenance/SourceTextIdentity"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import {
 *   toTextAnchorVerificationReceipt,
 *   VerifyTextAnchorInput,
 *   verifyTextAnchor,
 * } from "@beep/provenance/VerifiedTextAnchor"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const digest = SourceTextDigest.make(
 *   "sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca"
 * )
 * const source = SourceTextIdentity.make({
 *   extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
 *   locator: PosixPath.make("source.txt"),
 *   normalizationVersion: "1",
 *   scopeRef: "matter:example",
 *   sourceDigest: digest,
 *   sourceRef: "source:example",
 *   textDigest: digest,
 * })
 * const program = verifyTextAnchor(VerifyTextAnchorInput.make({
 *   anchor: TextAnchor.make({
 *     endChar: NonNegativeInt.make(4),
 *     quote: "fact",
 *     startChar: NonNegativeInt.make(0),
 *   }),
 *   expectedSource: source,
 *   source,
 *   sourceText: "fact",
 * })).pipe(
 *   Effect.map(toTextAnchorVerificationReceipt),
 *   Effect.provide(BunCrypto.layer)
 * )
 *
 * Effect.runPromise(program).then((receipt) => console.log(receipt.anchor.quote))
 * ```
 *
 * @param verified - Runtime proof produced by {@link verifyTextAnchor}.
 * @returns The stable `{ anchor, source }` persistence and wire shape.
 * @category encoding
 * @since 0.0.0
 */
export const toTextAnchorVerificationReceipt = (verified: VerifiedTextAnchor): TextAnchorVerificationReceipt =>
  TextAnchorVerificationReceipt.make({
    anchor: verified.anchor,
    source: verified.source,
  });

/**
 * Prove a candidate anchor against an authorized, exact source manifestation.
 *
 * **Details**
 *
 * Construction fails when scope or identity drifted, the raw text digest does
 * not match the resolved source identity, offsets are not valid UTF-16
 * code-point boundaries, the range is internally inconsistent, or the exact
 * raw slice differs from the quote.
 *
 * **Example** (Verify matching text anchor)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import {
 *   SourceTextDigest,
 *   SourceTextExtractor,
 *   SourceTextIdentity,
 * } from "@beep/provenance/SourceTextIdentity"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import {
 *   VerifyTextAnchorInput,
 *   verifyTextAnchor,
 * } from "@beep/provenance/VerifiedTextAnchor"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const digest = SourceTextDigest.make(
 *   "sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca"
 * )
 * const source = SourceTextIdentity.make({
 *   scopeRef: "matter:example",
 *   sourceRef: "source:example",
 *   locator: PosixPath.make("source.txt"),
 *   sourceDigest: digest,
 *   textDigest: digest,
 *   extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
 *   normalizationVersion: "1",
 * })
 * const program = verifyTextAnchor(VerifyTextAnchorInput.make({
 *   anchor: TextAnchor.make({
 *     startChar: NonNegativeInt.make(0),
 *     endChar: NonNegativeInt.make(4),
 *     quote: "fact",
 *   }),
 *   expectedSource: source,
 *   source,
 *   sourceText: "fact",
 * })).pipe(Effect.provide(BunCrypto.layer))
 * Effect.runPromise(program).then((verified) => console.log(verified.anchor.quote))
 * ```
 *
 * @effects Requires `Crypto.Crypto` to hash the raw source text; failures use
 * the sanitized {@link VerifiedTextAnchorError} channel.
 * @category validation
 * @since 0.0.0
 */
export const verifyTextAnchor = Effect.fn("VerifiedTextAnchor.verify")(function* (
  input: VerifyTextAnchorInput
): Effect.fn.Return<VerifiedTextAnchor, VerifiedTextAnchorError, Crypto.Crypto> {
  if (!Eq.equals(input.expectedSource.scopeRef, input.source.scopeRef)) {
    return yield* VerifiedTextAnchorError.fromReason("cross-scope");
  }
  if (!sourceTextIdentityEquivalence(input.expectedSource, input.source)) {
    return yield* VerifiedTextAnchorError.fromReason("stale-source");
  }
  const sourceTextDigest = yield* decodeSha256HexFromBytes(Uint8Array.from(utf8Encoder.encode(input.sourceText))).pipe(
    Effect.map((digest) => SourceTextDigest.make(`sha256:${digest}`)),
    Effect.mapError(() => VerifiedTextAnchorError.fromReason("stale-source"))
  );
  if (!sourceTextDigestEquivalence(sourceTextDigest, input.source.textDigest)) {
    return yield* VerifiedTextAnchorError.fromReason("stale-source");
  }
  if (
    input.anchor.endChar > Str.length(input.sourceText) ||
    !isUtf16Boundary(input.sourceText, input.anchor.startChar) ||
    !isUtf16Boundary(input.sourceText, input.anchor.endChar)
  ) {
    return yield* VerifiedTextAnchorError.fromReason("invalid-anchor");
  }
  if (!Eq.equals(Str.slice(input.anchor.startChar, input.anchor.endChar)(input.sourceText), input.anchor.quote)) {
    return yield* VerifiedTextAnchorError.fromReason("quote-mismatch");
  }

  return new VerifiedTextAnchorValue(input.anchor, input.source);
});
