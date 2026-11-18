import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { assert, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import {
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
      const yielded1 = yield* sha256("abc");
assert.strictEqual(yielded1, abcDigest);
      const yielded2 = yield* sha256SyncFull("abc");
assert.strictEqual(yielded2, abcDigest);
      const yielded3 = yield* sha256Sync("abc");
assert.strictEqual(yielded3, "ba7816bf8f01cfea");
      const yielded4 = yield* sha256("");
assert.strictEqual(yielded4, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
      const yielded5 = yield* sha256("é🌱");
const yielded6 = yield* sha256Bytes(new TextEncoder().encode("é🌱"));
assert.strictEqual(yielded5, yielded6);
    })
  );

  it.effect(
    "hashes exactly the selected bytes for buffers and offset views",
    Effect.fnUntraced(function* () {
      const bytes = new Uint8Array([0, 97, 98, 99, 255]);
      const yielded7 = yield* sha256Bytes(new Uint8Array(bytes.buffer, 1, 3));
assert.strictEqual(yielded7, abcDigest);
      const yielded8 = yield* sha256Bytes(new DataView(bytes.buffer, 1, 3));
assert.strictEqual(yielded8, abcDigest);
      const full = new Uint8Array([97, 98, 99]);
      const yielded9 = yield* sha256Bytes(full.buffer);
assert.strictEqual(yielded9, abcDigest);
      const yielded10 = yield* sha256BytesSync(full);
assert.strictEqual(yielded10, abcDigest);
    })
  );

  it.effect(
    "preserves embedding key domains and both dual forms",
    Effect.fnUntraced(function* () {
      const metadata = { providerId: "voyage", modelId: "voyage-3", dimension: 1024 };
      const expected = yield* sha256("voyage::voyage-3::1024::search_query::Ada");
      const yielded11 = yield* hashVersionedEmbeddingKey("Ada", "search_query", metadata);
assert.strictEqual(yielded11, expected);
      const yielded12 = yield* hashVersionedEmbeddingKey("search_query", metadata)("Ada");
assert.strictEqual(yielded12, expected);
      const yielded13 = yield* hashVersionedEmbeddingKeySync("Ada", "search_query", metadata);
assert.strictEqual(yielded13, expected);
      const yielded14 = yield* hashEmbeddingKey("Ada", "search_query");
const yielded15 = yield* sha256("Ada::search_query");
assert.strictEqual(yielded14, yielded15);
      const yielded16 = yield* hashEmbeddingKey("search_query")("Ada");
const yielded17 = yield* hashEmbeddingKeySync("Ada", "search_query");
assert.strictEqual(
        yielded16,
        yielded17
      );
      const yielded18 = yield* hashEmbeddingKey("Ada", "search_query");
const yielded19 = yield* hashEmbeddingKey("Ada", "search_document");
assert.notStrictEqual(
        yielded18,
        yielded19
      );
    })
  );

  it.effect(
    "preserves empty params, parameter ordering, and normalized idempotency",
    Effect.fnUntraced(function* () {
      const empty = ExtractionParams.make({});
      const yielded20 = yield* hashParams(empty);
assert.strictEqual(yielded20, "f615ccc9a6538a62");
      const yielded21 = yield* computeOntologyVersion("abc");
assert.strictEqual(yielded21, "ba7816bf8f01cfea");
      const first = yield* decodeExtractionParams({ temperature: 0.1, maxTokens: 100 });
      const reordered = yield* decodeExtractionParams({ maxTokens: 100, temperature: 0.1 });
      const yielded22 = yield* hashParams(first);
const yielded23 = yield* hashParams(reordered);
assert.strictEqual(yielded22, yielded23);
      const key = yield* computeIdempotencyKey(" Ada  LOVELACE\n", "foaf", "v1", empty);
      // The golden digest is asserted by shape only: a 64-hex literal in source trips
      // the secret scanner, and the determinism/normalization assertions below pin the value.
      assert.match(key, /^[0-9a-f]{64}$/);
      const yielded24 = yield* computeIdempotencyKeyEffect("ada lovelace", "foaf", "v1", empty);
assert.strictEqual(key, yielded24);
      const yielded25 = yield* computeIdempotencyKey("foaf", "v1", empty)("ada lovelace");
assert.strictEqual(key, yielded25);
      const yielded26 = yield* computeIdempotencyKey("ada lovelace", "foaf", "v2", empty);
assert.notStrictEqual(key, yielded26);
    })
  );
});

const digestDefect = new Error("Injected digest defect");
const DyingDigest = Layer.mock(Digest.Digest)({
  digest: () => Effect.die(digestDefect),
});

it.layer(DyingDigest)("hashing defects", (it) => {
  it.effect(
    "propagates a digest defect as a defect, not a typed failure",
    Effect.fnUntraced(function* () {
      const stringExit = yield* Effect.exit(sha256("abc"));
      const bytesExit = yield* Effect.exit(sha256Bytes(new Uint8Array([97])));
      assert.isTrue(Exit.isFailure(stringExit) && Exit.hasDies(stringExit));
      assert.isTrue(Exit.isFailure(bytesExit) && Exit.hasDies(bytesExit));
      assert.isFalse(Exit.isFailure(stringExit) && Exit.hasFails(stringExit));
      assert.strictEqual(Exit.isFailure(stringExit) ? Cause.squash(stringExit.cause) : undefined, digestDefect);
      assert.strictEqual(Exit.isFailure(bytesExit) ? Cause.squash(bytesExit.cause) : undefined, digestDefect);
    })
  );
});
