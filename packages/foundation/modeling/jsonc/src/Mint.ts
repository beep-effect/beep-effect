/**
 * The one minting function of every content-addressed identifier, and the
 * preimage declarations that tie each versioned domain tag to its preimage
 * schema and a committed golden vector.
 *
 * **Details**
 *
 * A minted identifier is the {@link ContentHash} of the RFC 8785 canonical
 * JSON of `[domainTag, ...preimage]`, computed by {@link JsoncFingerprint}, the
 * one canonical JSON owner. Canonical JSON sorts object keys only, so every
 * set-valued field must reach the preimage already sorted: a preimage schema
 * encodes such a field with `@beep/schema/CanonicalHashSet`.
 *
 * A changed preimage bumps its domain tag in the same change. The golden
 * vector of each {@link Preimage} makes that a test failure: changing what a
 * preimage encodes changes the hash its golden pins.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $JsoncId } from "@beep/identity/packages";
import { ContentHash, DomainTag } from "@beep/schema/ContentHash";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constVoid } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { JsoncFingerprint } from "./JsoncFingerprint.ts";
import type * as Digest from "effect/crypto/Digest";
import type { JsoncCanonicalizeError, JsoncDigest } from "./JsoncFingerprint.ts";

const $I = $JsoncId.create("Mint");

const prefixHex = (hex: string): ContentHash => ContentHash.make(`sha256:${hex}`);

/**
 * Mint a {@link ContentHash}: the SHA-256 of the canonical JSON of
 * `[domainTag, ...preimage]`.
 *
 * **When to use**
 *
 * Use when minting outside a {@link Preimage}, whose schema should encode the
 * record first; pass only a preimage that is already plain, canonical JSON.
 *
 * **Details**
 *
 * Requires core's `Digest.Digest` service. Fails with the canonical JSON
 * owner's {@link JsoncCanonicalizeError} when the preimage is not plain JSON.
 *
 * **Example** (Mint under a domain tag)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { DomainTag } from "@beep/schema/ContentHash"
 * import { mintContentHash } from "@beep/jsonc/Mint"
 *
 * const program = mintContentHash(DomainTag.make("example/v1"), ["a", 1]).pipe(Effect.provide(Digest.layerWebCrypto))
 *
 * Effect.runPromise(program).then((hash) => console.log(hash.startsWith("sha256:"))) // true
 * ```
 *
 * @param domainTag - The versioned domain tag hashed first.
 * @param preimage - The plain JSON preimage elements after the tag.
 * @category constructors
 * @since 0.0.0
 */
export const mintContentHash = Effect.fn("Mint.mintContentHash")(function* (
  domainTag: DomainTag,
  preimage: ReadonlyArray<unknown>
): Effect.fn.Return<ContentHash, JsoncCanonicalizeError, Digest.Digest> {
  const hex = yield* JsoncFingerprint.hash(A.prepend(preimage, domainTag));
  return prefixHex(hex);
});

/**
 * {@link mintContentHash} over a caller-supplied synchronous SHA-256: the same
 * canonical bytes and the same hash, returned as a `Result`.
 *
 * **When to use**
 *
 * Use when no fiber can run the `Digest.Digest` service, such as a property
 * generator that mints dependent identifiers while it builds a value.
 *
 * **Example** (Mint synchronously)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { DomainTag } from "@beep/schema/ContentHash"
 * import { mintContentHashResult } from "@beep/jsonc/Mint"
 *
 * const digest = (bytes: Uint8Array): Uint8Array => new Uint8Array(32).fill(bytes.length)
 * const hash = mintContentHashResult(digest)(DomainTag.make("example/v1"), ["a", 1])
 *
 * console.log(Result.getOrThrow(hash).length) // 71
 * ```
 *
 * @param digest - The consumer's SHA-256 implementation.
 * @returns A minting function over that digest.
 * @category constructors
 * @since 0.0.0
 */
export const mintContentHashResult =
  (digest: JsoncDigest) =>
  (domainTag: DomainTag, preimage: ReadonlyArray<unknown>): Result.Result<ContentHash, JsoncCanonicalizeError> =>
    Result.map(JsoncFingerprint.hashResult(A.prepend(preimage, domainTag), digest), prefixHex);

/**
 * A golden vector's recorded hash differs from the hash its preimage mints
 * today: the preimage changed without a new domain tag.
 *
 * **Example** (Read the mismatch)
 *
 * ```ts
 * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
 * import { PreimageGoldenMismatch } from "@beep/jsonc/Mint"
 *
 * const hash = ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const error = PreimageGoldenMismatch.make({ domainTag: DomainTag.make("example/v1"), expected: hash, actual: hash })
 *
 * console.log(error.message.startsWith("Preimage example/v1")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PreimageGoldenMismatch extends S.TaggedError<PreimageGoldenMismatch, { readonly brand: unique symbol }>(
  $I.make("PreimageGoldenMismatch")
)(
  "PreimageGoldenMismatch",
  {
    domainTag: DomainTag,
    expected: ContentHash,
    actual: ContentHash,
  },
  $I.annoteError<PreimageGoldenMismatch>("PreimageGoldenMismatch", {
    description: "A preimage's committed golden hash differs from the hash it mints; bump the domain tag.",
  })
) {
  /**
   * Name the domain tag and both hashes.
   *
   * **Example** (Render the message)
   *
   * ```ts
   * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
   * import { PreimageGoldenMismatch } from "@beep/jsonc/Mint"
   *
   * const hash = ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
   * const error = PreimageGoldenMismatch.make({ domainTag: DomainTag.make("example/v1"), expected: hash, actual: hash })
   *
   * console.log(error.message.endsWith("needs a new domain tag")) // true
   * ```
   */
  override get message(): string {
    return `Preimage ${this.domainTag} mints ${this.actual}, but its golden vector records ${this.expected}; a changed preimage needs a new domain tag`;
  }
}

/**
 * Two preimage declarations share one domain tag, so their identifiers could
 * collide.
 *
 * **Example** (Read the duplicate tag)
 *
 * ```ts
 * import { DomainTag } from "@beep/schema/ContentHash"
 * import { DuplicateDomainTag } from "@beep/jsonc/Mint"
 *
 * const error = DuplicateDomainTag.make({ domainTag: DomainTag.make("example/v1") })
 *
 * console.log(error.domainTag) // "example/v1"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuplicateDomainTag extends S.TaggedError<DuplicateDomainTag, { readonly brand: unique symbol }>(
  $I.make("DuplicateDomainTag")
)(
  "DuplicateDomainTag",
  { domainTag: DomainTag },
  $I.annoteError<DuplicateDomainTag>("DuplicateDomainTag", {
    description: "A domain tag declared by more than one preimage.",
  })
) {
  /**
   * Name the duplicated tag.
   *
   * **Example** (Render the message)
   *
   * ```ts
   * import { DomainTag } from "@beep/schema/ContentHash"
   * import { DuplicateDomainTag } from "@beep/jsonc/Mint"
   *
   * console.log(DuplicateDomainTag.make({ domainTag: DomainTag.make("example/v1") }).message)
   * // "Domain tag example/v1 is declared by more than one preimage"
   * ```
   */
  override get message(): string {
    return `Domain tag ${this.domainTag} is declared by more than one preimage`;
  }
}

/**
 * A golden vector's recorded preimage is not the canonical encoded form of
 * the value it decodes to, such as a set recorded unsorted or with a repeat:
 * the committed bytes would differ from the bytes that are hashed.
 *
 * **Example** (Read the canonical form)
 *
 * ```ts
 * import { DomainTag } from "@beep/schema/ContentHash"
 * import { PreimageGoldenNotCanonical } from "@beep/jsonc/Mint"
 *
 * const error = PreimageGoldenNotCanonical.make({
 *   domainTag: DomainTag.make("example/v1"),
 *   recorded: '[["b","a"]]',
 *   canonical: '[["a","b"]]',
 * })
 *
 * console.log(error.canonical) // '[["a","b"]]'
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PreimageGoldenNotCanonical extends S.TaggedError<
  PreimageGoldenNotCanonical,
  { readonly brand: unique symbol }
>($I.make("PreimageGoldenNotCanonical"))(
  "PreimageGoldenNotCanonical",
  {
    domainTag: DomainTag,
    recorded: S.String,
    canonical: S.String,
  },
  $I.annoteError<PreimageGoldenNotCanonical>("PreimageGoldenNotCanonical", {
    description: "A golden vector's recorded preimage differs from its canonical encoded form.",
  })
) {
  /**
   * Name the domain tag and both canonical JSON texts.
   *
   * **Example** (Render the message)
   *
   * ```ts
   * import { DomainTag } from "@beep/schema/ContentHash"
   * import { PreimageGoldenNotCanonical } from "@beep/jsonc/Mint"
   *
   * const error = PreimageGoldenNotCanonical.make({ domainTag: DomainTag.make("example/v1"), recorded: "[2]", canonical: "[1]" })
   *
   * console.log(error.message.startsWith("Preimage example/v1")) // true
   * ```
   */
  override get message(): string {
    return `Preimage ${this.domainTag} records the golden preimage ${this.recorded}, but its canonical encoded form is ${this.canonical}`;
  }
}

/**
 * Why a golden vector failed: its committed preimage no longer decodes, it
 * is not plain JSON, it is not in canonical encoded form, or it mints a
 * different hash.
 *
 * @category errors
 * @since 0.0.0
 */
export type PreimageGoldenError =
  | PreimageGoldenMismatch
  | PreimageGoldenNotCanonical
  | S.SchemaError
  | JsoncCanonicalizeError;

/**
 * Why minting through a {@link Preimage} failed: the value did not encode
 * through the preimage schema, or the encoded value is not plain JSON.
 *
 * @category errors
 * @since 0.0.0
 */
export type PreimageMintError = S.SchemaError | JsoncCanonicalizeError;

/**
 * One versioned preimage: its domain tag, the schema that encodes a value to
 * the preimage elements after the tag, and the committed golden vector that
 * pins the bytes. Built with {@link definePreimage}.
 *
 * **Details**
 *
 * `mint` encodes the value through the schema, so set-valued fields arrive
 * sorted and options as `null`, then mints with {@link mintContentHash}.
 * `verifyGolden` decodes the golden preimage, encodes it again, requires the
 * result to be the recorded preimage byte for byte, then mints it and compares
 * the hash with the recorded one.
 *
 * **Example** (Mint through a preimage)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
 * import { definePreimage } from "@beep/jsonc/Mint"
 *
 * const Example = definePreimage({
 *   domainTag: DomainTag.make("example/v1"),
 *   schema: S.Tuple([S.String]),
 *   golden: {
 *     preimage: ["a"],
 *     hash: ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   },
 * })
 *
 * Effect.runPromise(Example.mint(["a"]).pipe(Effect.provide(Digest.layerWebCrypto))).then((hash) =>
 *   console.log(hash.length)
 * ) // 71
 * ```
 *
 * @typeParam Value - The decoded preimage the caller supplies.
 * @typeParam Encoded - The plain JSON elements hashed after the domain tag.
 * @category models
 * @since 0.0.0
 */
export class Preimage<Value, Encoded extends ReadonlyArray<unknown>> {
  /** The versioned domain tag hashed first. */
  readonly domainTag: DomainTag;
  /** The schema between the decoded preimage and its plain JSON elements. */
  readonly schema: S.Codec<Value, Encoded>;
  /** The committed golden vector: a canonical encoded preimage and the hash it mints. */
  readonly golden: { readonly preimage: Encoded; readonly hash: ContentHash };

  /**
   * Build a preimage declaration; {@link definePreimage} is the public entry.
   *
   * @param definition - The domain tag, the schema and the golden vector.
   */
  constructor(definition: {
    readonly domainTag: DomainTag;
    readonly schema: S.Codec<Value, Encoded>;
    readonly golden: { readonly preimage: Encoded; readonly hash: ContentHash };
  }) {
    this.domainTag = definition.domainTag;
    this.schema = definition.schema;
    this.golden = definition.golden;
  }

  /**
   * Mint the content hash of a value under this preimage's domain tag,
   * through the `Digest.Digest` service.
   *
   * **Example** (Mint a value)
   *
   * ```ts
   * import * as Digest from "effect/crypto/Digest"
   * import * as Effect from "effect/Effect"
   * import * as S from "effect/Schema"
   * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
   * import { definePreimage } from "@beep/jsonc/Mint"
   *
   * const Example = definePreimage({
   *   domainTag: DomainTag.make("example/v1"),
   *   schema: S.Tuple([S.Finite]),
   *   golden: {
   *     preimage: [1],
   *     hash: ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
   *   },
   * })
   *
   * Effect.runPromise(Example.mint([1]).pipe(Effect.provide(Digest.layerWebCrypto))).then(console.log)
   * ```
   */
  readonly mint = Effect.fn("Preimage.mint")(
    (value: Value): Effect.Effect<ContentHash, PreimageMintError, Digest.Digest> =>
      S.encodeEffect(this.schema)(value).pipe(Effect.flatMap((encoded) => mintContentHash(this.domainTag, encoded)))
  );

  /**
   * Mint the content hash of a value through a caller-supplied synchronous
   * SHA-256: the same bytes and hash as {@link Preimage.mint}.
   *
   * **Example** (Mint a value synchronously)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
   * import { definePreimage } from "@beep/jsonc/Mint"
   *
   * const Example = definePreimage({
   *   domainTag: DomainTag.make("example/v1"),
   *   schema: S.Tuple([S.String]),
   *   golden: {
   *     preimage: ["a"],
   *     hash: ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
   *   },
   * })
   * const digest = (bytes: Uint8Array): Uint8Array => new Uint8Array(32).fill(bytes.length)
   *
   * console.log(Result.isSuccess(Example.mintResult(digest)(["a"]))) // true
   * ```
   *
   * @param digest - The consumer's SHA-256 implementation.
   * @returns A minting function over that digest.
   */
  readonly mintResult =
    (digest: JsoncDigest) =>
    (value: Value): Result.Result<ContentHash, PreimageMintError> =>
      S.encodeResult(this.schema)(value).pipe(
        Result.flatMap((encoded) => mintContentHashResult(digest)(this.domainTag, encoded))
      );

  /**
   * Check the golden vector through a caller-supplied synchronous SHA-256:
   * decode its preimage, require that encoding it again gives the recorded
   * canonical bytes, mint it and compare the hash with the recorded one.
   *
   * **Example** (Refuse a wrong golden)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
   * import { definePreimage } from "@beep/jsonc/Mint"
   *
   * const Example = definePreimage({
   *   domainTag: DomainTag.make("example/v1"),
   *   schema: S.Tuple([S.String]),
   *   golden: {
   *     preimage: ["a"],
   *     hash: ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
   *   },
   * })
   * const digest = (bytes: Uint8Array): Uint8Array => new Uint8Array(32).fill(bytes.length)
   *
   * console.log(Result.isFailure(Example.verifyGoldenResult(digest))) // true
   * ```
   *
   * @param digest - The consumer's SHA-256 implementation.
   */
  readonly verifyGoldenResult = (digest: JsoncDigest): Result.Result<void, PreimageGoldenError> =>
    S.decodeUnknownResult(this.schema)(this.golden.preimage).pipe(
      Result.flatMap(S.encodeResult(this.schema)),
      Result.flatMap(this.requireCanonical),
      Result.flatMap((encoded) => mintContentHashResult(digest)(this.domainTag, encoded)),
      Result.flatMap(this.compareGolden)
    );

  /**
   * Check the golden vector through the `Digest.Digest` service.
   *
   * **Example** (Check a golden in an Effect)
   *
   * ```ts
   * import * as Digest from "effect/crypto/Digest"
   * import * as Effect from "effect/Effect"
   * import * as S from "effect/Schema"
   * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
   * import { definePreimage } from "@beep/jsonc/Mint"
   *
   * const Example = definePreimage({
   *   domainTag: DomainTag.make("example/v1"),
   *   schema: S.Tuple([S.String]),
   *   golden: {
   *     preimage: ["a"],
   *     hash: ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
   *   },
   * })
   *
   * Effect.runPromiseExit(Example.verifyGolden().pipe(Effect.provide(Digest.layerWebCrypto))).then(console.log)
   * ```
   */
  readonly verifyGolden = Effect.fn("Preimage.verifyGolden")(
    (): Effect.Effect<void, PreimageGoldenError, Digest.Digest> =>
      S.decodeUnknownEffect(this.schema)(this.golden.preimage).pipe(
        Effect.flatMap(S.encodeEffect(this.schema)),
        Effect.flatMap((encoded) => Effect.fromResult(this.requireCanonical(encoded))),
        Effect.flatMap((encoded) => mintContentHash(this.domainTag, encoded)),
        Effect.flatMap((actual) => Effect.fromResult(this.compareGolden(actual)))
      )
  );

  private readonly requireCanonical = (
    encoded: Encoded
  ): Result.Result<Encoded, PreimageGoldenNotCanonical | JsoncCanonicalizeError> =>
    Result.all([
      JsoncFingerprint.canonicalizeResult(encoded),
      JsoncFingerprint.canonicalizeResult(this.golden.preimage),
    ]).pipe(
      Result.flatMap(([canonical, recorded]) =>
        canonical === recorded
          ? Result.succeed(encoded)
          : Result.fail(PreimageGoldenNotCanonical.make({ domainTag: this.domainTag, recorded, canonical }))
      )
    );

  private readonly compareGolden = (actual: ContentHash): Result.Result<void, PreimageGoldenMismatch> =>
    actual === this.golden.hash
      ? Result.void
      : Result.fail(PreimageGoldenMismatch.make({ domainTag: this.domainTag, expected: this.golden.hash, actual }));
}

/**
 * Declare a versioned preimage: tie a domain tag to the schema that encodes
 * its preimage and to a committed golden vector, which is required.
 *
 * **When to use**
 *
 * Use when declaring a minted identifier domain, once per domain. Register
 * every declaration in a {@link PreimageRegistry} so a duplicate tag is refused
 * and every golden is checked.
 *
 * **Example** (Declare a preimage)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
 * import { definePreimage } from "@beep/jsonc/Mint"
 *
 * const Example = definePreimage({
 *   domainTag: DomainTag.make("example/v1"),
 *   schema: S.Tuple([S.String, S.Finite]),
 *   golden: {
 *     preimage: ["a", 1],
 *     hash: ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   },
 * })
 *
 * console.log(Example.domainTag) // "example/v1"
 * ```
 *
 * @typeParam Value - The decoded preimage the caller supplies.
 * @typeParam Encoded - The plain JSON elements hashed after the domain tag.
 * @param definition - The domain tag, the schema and the golden vector.
 * @returns The preimage declaration.
 * @category constructors
 * @since 0.0.0
 */
export const definePreimage = <Value, Encoded extends ReadonlyArray<unknown>>(
  definition: ConstructorParameters<typeof Preimage<Value, Encoded>>[0]
): Preimage<Value, Encoded> => new Preimage(definition);

/**
 * Type-level companions of {@link Preimage}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Preimage {
  /**
   * A preimage declaration of any value and encoded type, as a
   * {@link PreimageRegistry} holds it.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Any = Pick<Preimage<never, ReadonlyArray<unknown>>, "domainTag" | "verifyGolden" | "verifyGoldenResult">;
}

/**
 * The preimage declarations of one scope keyed by domain tag, built only
 * when no tag is declared twice.
 *
 * **Example** (Refuse a duplicate tag)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { ContentHash, DomainTag } from "@beep/schema/ContentHash"
 * import { definePreimage, PreimageRegistry } from "@beep/jsonc/Mint"
 *
 * const makeExample = () =>
 *   definePreimage({
 *     domainTag: DomainTag.make("example/v1"),
 *     schema: S.Tuple([S.String]),
 *     golden: {
 *       preimage: ["a"],
 *       hash: ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *     },
 *   })
 *
 * console.log(Result.isFailure(PreimageRegistry.make([makeExample(), makeExample()]))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreimageRegistry {
  /** The declarations, keyed by domain tag. */
  readonly preimages: HashMap.HashMap<DomainTag, Preimage.Any>;

  private constructor(preimages: HashMap.HashMap<DomainTag, Preimage.Any>) {
    this.preimages = preimages;
  }

  /**
   * Register declarations, refusing the first domain tag declared twice.
   *
   * **Example** (Register an empty scope)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { PreimageRegistry } from "@beep/jsonc/Mint"
   *
   * console.log(Result.isSuccess(PreimageRegistry.make([]))) // true
   * ```
   *
   * @param preimages - The declarations of the scope.
   * @returns The registry, or the first {@link DuplicateDomainTag}.
   */
  static make(preimages: Iterable<Preimage.Any>): Result.Result<PreimageRegistry, DuplicateDomainTag> {
    const declared = A.fromIterable(preimages);
    const isRepeat = (preimage: Preimage.Any, index: number): boolean =>
      A.findFirstIndex(declared, (other) => other.domainTag === preimage.domainTag).pipe(
        O.exists((first) => first !== index)
      );
    return O.match(A.findFirst(declared, isRepeat), {
      onNone: () =>
        Result.succeed(
          new PreimageRegistry(
            HashMap.fromIterable(A.map(declared, (preimage) => [preimage.domainTag, preimage] as const))
          )
        ),
      onSome: (repeat) => Result.fail(DuplicateDomainTag.make({ domainTag: repeat.domainTag })),
    });
  }

  /**
   * Look up the declaration of a domain tag.
   *
   * **Example** (Miss an undeclared tag)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as Result from "effect/Result"
   * import { DomainTag } from "@beep/schema/ContentHash"
   * import { PreimageRegistry } from "@beep/jsonc/Mint"
   *
   * const registry = Result.getOrThrow(PreimageRegistry.make([]))
   *
   * console.log(O.isNone(registry.get(DomainTag.make("example/v1")))) // true
   * ```
   *
   * @param domainTag - The tag to look up.
   */
  get(domainTag: DomainTag): O.Option<Preimage.Any> {
    return HashMap.get(this.preimages, domainTag);
  }

  /**
   * Check every golden vector through a caller-supplied synchronous SHA-256,
   * stopping at the first failure.
   *
   * **Example** (Check the goldens of a registry)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { PreimageRegistry } from "@beep/jsonc/Mint"
   *
   * const registry = Result.getOrThrow(PreimageRegistry.make([]))
   * const digest = (bytes: Uint8Array): Uint8Array => new Uint8Array(32).fill(bytes.length)
   *
   * console.log(Result.isSuccess(registry.verifyGoldensResult(digest))) // true
   * ```
   *
   * @param digest - The consumer's SHA-256 implementation.
   */
  verifyGoldensResult(digest: JsoncDigest): Result.Result<void, PreimageGoldenError> {
    return this.preimages.pipe(
      HashMap.values,
      A.fromIterable,
      A.map((preimage) => preimage.verifyGoldenResult(digest)),
      Result.all,
      Result.map(constVoid)
    );
  }

  /**
   * Check every golden vector through the `Digest.Digest` service.
   *
   * **Example** (Check the goldens in an Effect)
   *
   * ```ts
   * import * as Digest from "effect/crypto/Digest"
   * import * as Effect from "effect/Effect"
   * import * as Result from "effect/Result"
   * import { PreimageRegistry } from "@beep/jsonc/Mint"
   *
   * const registry = Result.getOrThrow(PreimageRegistry.make([]))
   *
   * Effect.runPromise(registry.verifyGoldens().pipe(Effect.provide(Digest.layerWebCrypto))).then(console.log)
   * ```
   */
  readonly verifyGoldens = Effect.fn("PreimageRegistry.verifyGoldens")(
    (): Effect.Effect<void, PreimageGoldenError, Digest.Digest> =>
      Effect.forEach(HashMap.values(this.preimages), (preimage) => preimage.verifyGolden(), {
        concurrency: 1,
        discard: true,
      })
  );
}
