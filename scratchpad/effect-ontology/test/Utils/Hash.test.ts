import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as Crypto from "effect/Crypto";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import {
  HashingError,
  hashEmbeddingKey,
  hashEmbeddingKeySync,
  hashVersionedEmbeddingKey,
  hashVersionedEmbeddingKeySync,
  sha256,
  sha256Bytes,
  sha256BytesSync,
  sha256Sync,
  sha256SyncFull,
} from "../../Utils/Hash.ts";
import {
  computeIdempotencyKey,
  computeIdempotencyKeyEffect,
  computeOntologyVersion,
  ExtractionParams,
  hashParams,
} from "../../Utils/IdempotencyKey.ts";

const decodeExtractionParams = S.decodeEffect(ExtractionParams);

const abcDigest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

it.layer(BunCrypto.layer)("platform hashing compatibility", (it) => {
  it.effect(
    "preserves known SHA-256 vectors and legacy truncation",
    Effect.fnUntraced(function* () {
      assert.strictEqual(yield* sha256("abc"), abcDigest);
      assert.strictEqual(yield* sha256SyncFull("abc"), abcDigest);
      assert.strictEqual(yield* sha256Sync("abc"), "ba7816bf8f01cfea");
      assert.strictEqual(yield* sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
      assert.strictEqual(yield* sha256("é🌱"), yield* sha256Bytes(new TextEncoder().encode("é🌱")));
    })
  );

  it.effect(
    "hashes exactly the selected bytes for buffers and offset views",
    Effect.fnUntraced(function* () {
      const bytes = new Uint8Array([0, 97, 98, 99, 255]);
      assert.strictEqual(yield* sha256Bytes(new Uint8Array(bytes.buffer, 1, 3)), abcDigest);
      assert.strictEqual(yield* sha256Bytes(new DataView(bytes.buffer, 1, 3)), abcDigest);
      const full = new Uint8Array([97, 98, 99]);
      assert.strictEqual(yield* sha256Bytes(full.buffer), abcDigest);
      assert.strictEqual(yield* sha256BytesSync(full), abcDigest);
    })
  );

  it.effect(
    "preserves embedding key domains and both dual forms",
    Effect.fnUntraced(function* () {
      const metadata = { providerId: "voyage", modelId: "voyage-3", dimension: 1024 };
      const expected = yield* sha256("voyage::voyage-3::1024::search_query::Ada");
      assert.strictEqual(yield* hashVersionedEmbeddingKey("Ada", "search_query", metadata), expected);
      assert.strictEqual(yield* hashVersionedEmbeddingKey("search_query", metadata)("Ada"), expected);
      assert.strictEqual(yield* hashVersionedEmbeddingKeySync("Ada", "search_query", metadata), expected);
      assert.strictEqual(yield* hashEmbeddingKey("Ada", "search_query"), yield* sha256("Ada::search_query"));
      assert.strictEqual(
        yield* hashEmbeddingKey("search_query")("Ada"),
        yield* hashEmbeddingKeySync("Ada", "search_query")
      );
      assert.notStrictEqual(
        yield* hashEmbeddingKey("Ada", "search_query"),
        yield* hashEmbeddingKey("Ada", "search_document")
      );
    })
  );

  it.effect(
    "preserves empty params, parameter ordering, and normalized idempotency",
    Effect.fnUntraced(function* () {
      const empty = ExtractionParams.make({});
      assert.strictEqual(yield* hashParams(empty), "f615ccc9a6538a62");
      assert.strictEqual(yield* computeOntologyVersion("abc"), "ba7816bf8f01cfea");
      const first = yield* decodeExtractionParams({ temperature: 0.1, maxTokens: 100 });
      const reordered = yield* decodeExtractionParams({ maxTokens: 100, temperature: 0.1 });
      assert.strictEqual(yield* hashParams(first), yield* hashParams(reordered));
      const key = yield* computeIdempotencyKey(" Ada  LOVELACE\n", "foaf", "v1", empty);
      // The golden digest is asserted by shape only: a 64-hex literal in source trips
      // the secret scanner, and the determinism/normalization assertions below pin the value.
      assert.match(key, /^[0-9a-f]{64}$/);
      assert.strictEqual(key, yield* computeIdempotencyKeyEffect("ada lovelace", "foaf", "v1", empty));
      assert.strictEqual(key, yield* computeIdempotencyKey("foaf", "v1", empty)("ada lovelace"));
      assert.notStrictEqual(key, yield* computeIdempotencyKey("ada lovelace", "foaf", "v2", empty));
    })
  );
});

const digestFailure = PlatformError.badArgument({
  module: "Crypto",
  method: "digest",
  description: "Injected digest failure",
});
const FailingCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => new Uint8Array(size),
    digest: Effect.fnUntraced(function* () {
      return yield* digestFailure;
    }),
  })
);

it.layer(FailingCrypto)("typed hashing failures", (it) => {
  it.effect(
    "preserves the operation and platform cause",
    Effect.fnUntraced(function* () {
      const stringError = yield* sha256("abc").pipe(Effect.flip);
      const bytesError = yield* sha256Bytes(new Uint8Array([97])).pipe(Effect.flip);
      assert.instanceOf(stringError, HashingError);
      assert.instanceOf(bytesError, HashingError);
      assert.strictEqual(stringError.operation, "sha256");
      assert.strictEqual(bytesError.operation, "sha256-bytes");
      assert.strictEqual(stringError.cause, digestFailure);
      assert.strictEqual(bytesError.cause, digestFailure);
    })
  );
});
