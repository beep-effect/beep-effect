import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Context, Crypto, Effect, Equal, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $SemanticaId.create("corpus/ByteWitness");

/**
 * Content-addressed byte expectations for one file beneath a witness root.
 *
 * **Example** (Describe expected bytes)
 *
 * ```ts
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 * import { ByteExpectation } from "@/corpus/ByteWitness"
 *
 * const expectation = ByteExpectation.make({
 *   relativePath: "documents/paper.pdf",
 *   sha256: Sha256Hex.make("0".repeat(64)),
 *   bytes: NonNegativeInt.make(12)
 * })
 * console.log(expectation.relativePath) // "documents/paper.pdf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ByteExpectation extends S.Class<ByteExpectation>($I`ByteExpectation`)(
  {
    relativePath: S.NonEmptyString,
    sha256: Sha256Hex,
    bytes: NonNegativeInt,
  },
  $I.annote("ByteExpectation", {
    description: "Expected relative path, SHA-256 digest, and byte length for one witnessed file.",
  })
) {}

const ByteDriftKind = LiteralKit(["missing-file", "sha256-mismatch", "bytes-mismatch"]).annotate(
  $I.annote("ByteDriftKind", {
    description: "Filesystem drift variants produced while witnessing content-addressed files.",
  })
);

/**
 * Missing-file, SHA-256, and byte-length drift for a witnessed file.
 *
 * **Example** (Construct missing-file drift)
 *
 * ```ts
 * import { ByteDrift } from "@/corpus/ByteWitness"
 *
 * const drift = ByteDrift.cases["missing-file"].make({ relativePath: "documents/paper.pdf" })
 * console.log(drift.kind) // "missing-file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ByteDrift = ByteDriftKind.toTaggedUnion("kind")({
  "missing-file": {
    relativePath: S.NonEmptyString,
  },
  "sha256-mismatch": {
    relativePath: S.NonEmptyString,
    expectedSha256: Sha256Hex,
    actualSha256: Sha256Hex,
  },
  "bytes-mismatch": {
    relativePath: S.NonEmptyString,
    expectedBytes: NonNegativeInt,
    actualBytes: NonNegativeInt,
  },
}).pipe(
  $I.annoteSchema("ByteDrift", {
    description: "Exhaustive filesystem drift details shared by content-addressed byte witnesses.",
  })
);

/**
 * Runtime type for {@link ByteDrift}.
 *
 * @see {@link ByteDrift} for constructors and discriminator-aware helpers.
 * @category models
 * @since 0.0.0
 */
export type ByteDrift = typeof ByteDrift.Type;

/**
 * Verifies expected content hashes and byte lengths beneath a filesystem root.
 *
 * **Details**
 *
 * Files are read with at most four concurrent operations. Unreadable files are
 * reported as missing, matching the existing manifest and fixture semantics.
 *
 * **Example** (Build a byte witness effect)
 *
 * ```ts
 * import { verifyByteExpectations } from "@/corpus/ByteWitness"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(verifyByteExpectations("fixtures", []))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const verifyByteExpectations = Effect.fn("ByteWitness.verifyByteExpectations")(function* (
  root: string,
  expectations: ReadonlyArray<ByteExpectation>
): Effect.fn.Return<ReadonlyArray<ByteDrift>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const nestedDrifts = yield* Effect.scoped(
    Effect.gen(function* () {
      const cryptoContext = yield* Layer.build(BunCrypto.layer);
      const crypto = Context.get(cryptoContext, Crypto.Crypto);
      const hashBytes = Effect.fn("ByteWitness.hashBytes")((bytes: Uint8Array) =>
        Sha256HexFromBytes.decodeEffect(bytes).pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.orDie)
      );
      return yield* Effect.forEach(
        expectations,
        Effect.fnUntraced(function* (expectation) {
          const bytes = yield* fs.readFile(path.join(root, expectation.relativePath)).pipe(Effect.option);
          return yield* O.match(bytes, {
            onNone: () =>
              Effect.succeed([ByteDrift.cases["missing-file"].make({ relativePath: expectation.relativePath })]),
            onSome: Effect.fn("ByteWitness.inspectBytes")(function* (actualBytes) {
              const actualSha256 = yield* hashBytes(actualBytes);
              const actualByteLength = NonNegativeInt.make(actualBytes.byteLength);
              let drifts = A.empty<ByteDrift>();
              if (!Str.Equivalence(expectation.sha256, actualSha256)) {
                drifts = A.append(
                  drifts,
                  ByteDrift.cases["sha256-mismatch"].make({
                    relativePath: expectation.relativePath,
                    expectedSha256: expectation.sha256,
                    actualSha256,
                  })
                );
              }
              if (!Equal.equals(expectation.bytes, actualByteLength)) {
                drifts = A.append(
                  drifts,
                  ByteDrift.cases["bytes-mismatch"].make({
                    relativePath: expectation.relativePath,
                    expectedBytes: expectation.bytes,
                    actualBytes: actualByteLength,
                  })
                );
              }
              return drifts;
            }),
          });
        }),
        { concurrency: 4 }
      );
    })
  );
  return A.flatten(nestedDrifts);
});
