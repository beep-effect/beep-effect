/**
 * Fail-closed construction of source-identity-bound text anchors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ProvenanceId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { Effect } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "./SourceTextIdentity.ts";
import { isUtf16Boundary, TextAnchor } from "./TextAnchor.ts";
import type * as Crypto from "effect/Crypto";

const $I = $ProvenanceId.create("VerifiedTextAnchor");
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const sourceTextDigestEquivalence = S.toEquivalence(SourceTextDigest);
const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);
const WellFormedSourceText = S.String.check(
  S.isPattern(/^(?:[\u0000-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$/, {
    identifier: $I`WellFormedSourceTextCheck`,
    title: "Well-Formed Source Text",
    description: "Checks that source text contains only complete UTF-16 scalar sequences.",
    message: "Expected source text without lone UTF-16 surrogates.",
  })
).pipe(
  $I.annoteSchema("WellFormedSourceText", {
    description: "Raw source text whose UTF-16 representation contains no lone surrogate code units.",
  })
);
const isWellFormedSourceText = S.is(WellFormedSourceText);
const utf8Encoder = new TextEncoder();

type VerifiedSourceTextSnapshot = {
  readonly source: SourceTextIdentity;
  readonly sourceText: string;
};

type VerifiedTextAnchorSnapshot = {
  readonly anchor: TextAnchor;
  readonly source: SourceTextIdentity;
};

const verifiedSourceTextSnapshots = new WeakMap<object, VerifiedSourceTextSnapshot>();
const verifiedTextAnchorSnapshots = new WeakMap<object, VerifiedTextAnchorSnapshot>();

const copySourceTextIdentity = (source: SourceTextIdentity): SourceTextIdentity =>
  SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({
      name: source.extractor.name,
      version: source.extractor.version,
    }),
    locator: source.locator,
    normalizationVersion: source.normalizationVersion,
    scopeRef: source.scopeRef,
    sourceDigest: source.sourceDigest,
    sourceRef: source.sourceRef,
    textDigest: source.textDigest,
  });

const copyTextAnchor = (anchor: TextAnchor): TextAnchor =>
  TextAnchor.make({
    endChar: anchor.endChar,
    quote: anchor.quote,
    startChar: anchor.startChar,
  });

/**
 * Machine-readable reasons a text anchor cannot acquire verified status.
 *
 * **Example** (Check error reason membership)
 *
 * ```ts import.meta.vitest name="Check error reason membership"
 * import { VerifiedTextAnchorErrorReason } from "@beep/provenance/VerifiedTextAnchor"
 *
 * VerifiedTextAnchorErrorReason.is["quote-mismatch"]("quote-mismatch") // => true
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
 * ```ts import.meta.vitest name="Create error from reason"
 * import { VerifiedTextAnchorError } from "@beep/provenance/VerifiedTextAnchor"
 *
 * const error = VerifiedTextAnchorError.fromReason("quote-mismatch")
 * error.reason // => "quote-mismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VerifiedTextAnchorError extends S.TaggedError<VerifiedTextAnchorError>($I`VerifiedTextAnchorError`)(
  "VerifiedTextAnchorError",
  {
    message: S.String,
    reason: VerifiedTextAnchorErrorReason,
  },
  $I.annoteError<VerifiedTextAnchorError>("VerifiedTextAnchorError", {
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
 * Inputs required to prove one resolved raw-text manifestation against its
 * authorized source identity.
 *
 * **Example** (Inspect source verification fields)
 *
 * ```ts import.meta.vitest name="Inspect source verification fields"
 * import { VerifySourceTextIdentityInput } from "@beep/provenance/VerifiedTextAnchor"
 *
 * VerifySourceTextIdentityInput.fields.sourceText !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifySourceTextIdentityInput extends S.Class<VerifySourceTextIdentityInput>(
  $I`VerifySourceTextIdentityInput`
)(
  {
    expectedSource: SourceTextIdentity,
    source: SourceTextIdentity,
    sourceText: S.String,
  },
  $I.annote("VerifySourceTextIdentityInput", {
    description:
      "Expected and resolved source identities plus the exact raw source text whose digest must match the resolved identity.",
  })
) {}

class VerifiedSourceTextValue {
  private declare readonly verifiedSourceTextCapability: void;

  get source(): SourceTextIdentity {
    const snapshot = verifiedSourceTextSnapshots.get(this);
    if (snapshot === undefined) {
      throw new TypeError("Unissued verified-source proof.");
    }
    return copySourceTextIdentity(snapshot.source);
  }

  get sourceText(): string {
    const snapshot = verifiedSourceTextSnapshots.get(this);
    if (snapshot === undefined) {
      throw new TypeError("Unissued verified-source proof.");
    }
    return snapshot.sourceText;
  }

  static readonly is = (input: unknown): input is VerifiedSourceTextValue =>
    typeof input === "object" && input !== null && verifiedSourceTextSnapshots.has(input);
}

globalThis.Object.freeze(VerifiedSourceTextValue.prototype);
globalThis.Object.freeze(VerifiedSourceTextValue);

const issueVerifiedSourceText = (source: SourceTextIdentity, sourceText: string): VerifiedSourceTextValue => {
  const proof = new VerifiedSourceTextValue();
  verifiedSourceTextSnapshots.set(proof, {
    source: copySourceTextIdentity(source),
    sourceText,
  });
  globalThis.Object.freeze(proof);
  return proof;
};

/**
 * Opaque runtime proof that raw text matches one exact authorized source.
 *
 * **Details**
 *
 * The proof retains the already-hashed raw text so multiple anchors can be
 * checked without repeating the full-source digest. Structural source data
 * cannot be decoded into this type; only {@link verifySourceTextIdentity} can
 * construct it.
 *
 * **Example** (Inspect the verified-source schema)
 *
 * ```ts import.meta.vitest name="Inspect the verified-source schema"
 * import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor"
 * import * as S from "effect/Schema"
 *
 * S.is(VerifiedSourceText)({ source: {}, sourceText: "text" }) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VerifiedSourceText = VerifiedSourceTextValue;

/**
 * From-self schema for an opaque verified-source runtime proof.
 *
 * **Example** (Reject structural source data)
 *
 * ```ts import.meta.vitest name="Reject structural source data"
 * import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor"
 * import * as S from "effect/Schema"
 *
 * S.is(VerifiedSourceText)({ source: {}, sourceText: "text" }) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VerifiedSourceText = S.declare<VerifiedSourceText>(VerifiedSourceTextValue.is).pipe(
  $I.annoteSchema("VerifiedSourceText", {
    description: "Opaque proof that retained raw text matches one exact authorized source identity.",
  })
);

/**
 * Inputs required to check one anchor against an already verified source.
 *
 * **Example** (Inspect verified-source anchor fields)
 *
 * ```ts import.meta.vitest name="Inspect verified-source anchor fields"
 * import { VerifyTextAnchorAgainstVerifiedSourceInput } from "@beep/provenance/VerifiedTextAnchor"
 *
 * VerifyTextAnchorAgainstVerifiedSourceInput.fields.anchor !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifyTextAnchorAgainstVerifiedSourceInput extends S.Class<VerifyTextAnchorAgainstVerifiedSourceInput>(
  $I`VerifyTextAnchorAgainstVerifiedSourceInput`
)(
  {
    anchor: TextAnchor,
    verifiedSource: VerifiedSourceText,
  },
  $I.annote("VerifyTextAnchorAgainstVerifiedSourceInput", {
    description: "Candidate anchor and opaque proof of the exact source text against which it must be checked.",
  })
) {}

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
 * ```ts import.meta.vitest name="Check sourceText field presence"
 * import { VerifyTextAnchorInput } from "@beep/provenance/VerifiedTextAnchor"
 *
 * VerifyTextAnchorInput.fields.sourceText !== undefined // => true
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
 * ```ts import.meta.vitest name="Check receipt anchor field"
 * import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor"
 *
 * TextAnchorVerificationReceipt.fields.anchor !== undefined // => true
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
  private declare readonly verifiedTextAnchorCapability: void;

  get anchor(): TextAnchor {
    const snapshot = verifiedTextAnchorSnapshots.get(this);
    if (snapshot === undefined) {
      throw new TypeError("Unissued verified-anchor proof.");
    }
    return copyTextAnchor(snapshot.anchor);
  }

  get source(): SourceTextIdentity {
    const snapshot = verifiedTextAnchorSnapshots.get(this);
    if (snapshot === undefined) {
      throw new TypeError("Unissued verified-anchor proof.");
    }
    return copySourceTextIdentity(snapshot.source);
  }

  static readonly is = (input: unknown): input is VerifiedTextAnchorValue =>
    typeof input === "object" && input !== null && verifiedTextAnchorSnapshots.has(input);
}

globalThis.Object.freeze(VerifiedTextAnchorValue.prototype);
globalThis.Object.freeze(VerifiedTextAnchorValue);

const issueVerifiedTextAnchor = (anchor: TextAnchor, source: SourceTextIdentity): VerifiedTextAnchorValue => {
  const proof = new VerifiedTextAnchorValue();
  verifiedTextAnchorSnapshots.set(proof, {
    anchor: copyTextAnchor(anchor),
    source: copySourceTextIdentity(source),
  });
  globalThis.Object.freeze(proof);
  return proof;
};

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
 * ```ts import.meta.vitest name="Receipt is not runtime proof"
 * import type {
 *   TextAnchorVerificationReceipt,
 *   VerifiedTextAnchor,
 * } from "@beep/provenance/VerifiedTextAnchor"
 *
 * type ReceiptIsRuntimeProof =
 *   TextAnchorVerificationReceipt extends VerifiedTextAnchor ? true : false
 *
 * const receiptIsRuntimeProof: ReceiptIsRuntimeProof = false
 * receiptIsRuntimeProof // => false
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
 * ```ts import.meta.vitest name="Schema rejects structural data"
 * import * as S from "effect/Schema"
 * import { VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor"
 *
 * S.is(VerifiedTextAnchor)({ anchor: {}, source: {} }) // => false
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
  (() => {
    const snapshot = verifiedTextAnchorSnapshots.get(verified);
    if (snapshot === undefined) {
      throw new TypeError("Unissued verified-anchor proof.");
    }
    return TextAnchorVerificationReceipt.make({
      anchor: copyTextAnchor(snapshot.anchor),
      source: copySourceTextIdentity(snapshot.source),
    });
  })();

/**
 * Prove that resolved raw text belongs to the exact authorized source
 * manifestation before any anchor or negative attempt relies on it.
 *
 * **Details**
 *
 * The check rejects cross-scope identities, any identity/version drift, and a
 * raw-text digest mismatch. Success returns an opaque proof that can be reused
 * to check multiple anchors without hashing the full source again.
 *
 * **Example** (Verify an empty source manifestation)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import {
 *   SourceTextDigest,
 *   SourceTextExtractor,
 *   SourceTextIdentity,
 * } from "@beep/provenance/SourceTextIdentity"
 * import {
 *   VerifySourceTextIdentityInput,
 *   verifySourceTextIdentity,
 * } from "@beep/provenance/VerifiedTextAnchor"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const digest = SourceTextDigest.make(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * const source = SourceTextIdentity.make({
 *   extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
 *   locator: PosixPath.make("empty.txt"),
 *   normalizationVersion: "1",
 *   scopeRef: "matter:example",
 *   sourceDigest: digest,
 *   sourceRef: "source:empty",
 *   textDigest: digest,
 * })
 * const program = verifySourceTextIdentity(VerifySourceTextIdentityInput.make({
 *   expectedSource: source,
 *   source,
 *   sourceText: "",
 * })).pipe(Effect.provide(BunCrypto.layer))
 *
 * Effect.runPromise(program).then((verified) => console.log(verified.source.sourceRef))
 * ```
 *
 * @effects Requires `Crypto.Crypto` to hash the raw source text; failures use
 * the sanitized {@link VerifiedTextAnchorError} channel.
 * @category validation
 * @since 0.0.0
 */
export const verifySourceTextIdentity = Effect.fn("VerifiedTextAnchor.verifySourceTextIdentity")(function* (
  input: VerifySourceTextIdentityInput
): Effect.fn.Return<VerifiedSourceText, VerifiedTextAnchorError, Crypto.Crypto> {
  const expectedSource = copySourceTextIdentity(input.expectedSource);
  const source = copySourceTextIdentity(input.source);
  const sourceText = input.sourceText;

  if (!Eq.equals(expectedSource.scopeRef, source.scopeRef)) {
    return yield* VerifiedTextAnchorError.fromReason("cross-scope");
  }
  if (!sourceTextIdentityEquivalence(expectedSource, source)) {
    return yield* VerifiedTextAnchorError.fromReason("stale-source");
  }
  if (!isWellFormedSourceText(sourceText)) {
    return yield* VerifiedTextAnchorError.fromReason("stale-source");
  }
  const sourceTextDigest = yield* decodeSha256HexFromBytes(Uint8Array.from(utf8Encoder.encode(sourceText))).pipe(
    Effect.map((digest) => SourceTextDigest.make(`sha256:${digest}`)),
    Effect.mapError(() => VerifiedTextAnchorError.fromReason("stale-source"))
  );
  if (!sourceTextDigestEquivalence(sourceTextDigest, source.textDigest)) {
    return yield* VerifiedTextAnchorError.fromReason("stale-source");
  }

  return issueVerifiedSourceText(source, sourceText);
});

/**
 * Prove a candidate anchor against a source whose raw text was already
 * identity-verified.
 *
 * **Details**
 *
 * The opaque source proof makes this safe to reuse across a candidate batch.
 * This operation checks UTF-16 boundaries and exact slice equality without
 * repeating the full-source digest.
 *
 * **Example** (Inspect reusable anchor verification)
 *
 * ```ts import.meta.vitest name="Inspect reusable anchor verification"
 * import { verifyTextAnchorAgainstVerifiedSource } from "@beep/provenance/VerifiedTextAnchor"
 *
 * typeof verifyTextAnchorAgainstVerifiedSource // => "function"
 * ```
 *
 * @param input - Candidate anchor and opaque verified-source proof.
 * @returns An opaque verified-anchor proof for an exact raw slice.
 * @category validation
 * @since 0.0.0
 */
export const verifyTextAnchorAgainstVerifiedSource = Effect.fn("VerifiedTextAnchor.verifyAgainstVerifiedSource")(
  function* (
    input: VerifyTextAnchorAgainstVerifiedSourceInput
  ): Effect.fn.Return<VerifiedTextAnchor, VerifiedTextAnchorError> {
    const snapshot = verifiedSourceTextSnapshots.get(input.verifiedSource);
    if (snapshot === undefined) {
      return yield* VerifiedTextAnchorError.fromReason("stale-source");
    }
    const { source, sourceText } = snapshot;
    if (
      input.anchor.endChar > Str.length(sourceText) ||
      !isUtf16Boundary(sourceText, input.anchor.startChar) ||
      !isUtf16Boundary(sourceText, input.anchor.endChar)
    ) {
      return yield* VerifiedTextAnchorError.fromReason("invalid-anchor");
    }
    if (!Eq.equals(Str.slice(input.anchor.startChar, input.anchor.endChar)(sourceText), input.anchor.quote)) {
      return yield* VerifiedTextAnchorError.fromReason("quote-mismatch");
    }

    return issueVerifiedTextAnchor(input.anchor, source);
  }
);

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
  const verifiedSource = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({
      expectedSource: input.expectedSource,
      source: input.source,
      sourceText: input.sourceText,
    })
  );
  return yield* verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({
      anchor: input.anchor,
      verifiedSource,
    })
  );
});
