/**
 * Vendored from Effect (https://github.com/Effect-TS/effect), tag effect@4.0.5,
 * packages/effect/test/persistence/KeyValueStoreTest.ts. MIT License, Copyright (c)
 * Effectful Technologies Inc. Not shipped in the effect npm package.
 * beep changes: per-module effect imports, @beep/test-runner `it`, and a `dual` suite with a
 * generic error channel (repo tsgo rules missingPipeableSignature, anyUnknownInErrorContext),
 * each marked `// beep:` below.
 */
// beep: per-module effect imports and the @beep/test-runner `it` replace the upstream barrels.
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import { dual } from "effect/Function";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import type * as Layer from "effect/Layer";

// Tests clear the shared store.
// beep: `dual` with a generic error channel satisfies the repo's tsgo rules
// (missingPipeableSignature, anyUnknownInErrorContext).
export const suite: {
  <E>(layer: Layer.Layer<KeyValueStore.KeyValueStore, E>): (name: string) => void;
  <E>(name: string, layer: Layer.Layer<KeyValueStore.KeyValueStore, E>): void;
} = dual(2, <E>(name: string, layer: Layer.Layer<KeyValueStore.KeyValueStore, E>): void =>
  it.layer(layer, { timeout: { seconds: 30 }, concurrent: false })(`KeyValueStore (${name})`, (it) => {
    it.effect("set + get + size", () =>
      Effect.gen(function* () {
        const kv = yield* KeyValueStore.KeyValueStore;
        yield* kv.clear;

        yield* kv.set("key", "value");

        const got = yield* kv.get("key");
        assert.strictEqual(got, "value");
        const size1 = yield* kv.size;
        assert.strictEqual(size1, 1);

        yield* kv.set("key", "value-2");

        const got2 = yield* kv.get("key");
        assert.strictEqual(got2, "value-2");
        const size3 = yield* kv.size;
        assert.strictEqual(size3, 1);
      })
    );

    it.effect("binary values", () =>
      Effect.gen(function* () {
        const kv = yield* KeyValueStore.KeyValueStore;
        yield* kv.clear;
        const bytes = new Uint8Array([0, 42, 255, 128]);

        yield* kv.set("binary", bytes);

        const got4 = yield* kv.get("binary");
        assert.strictEqual(got4, Base64.encode(bytes));
        const gotUint8Array = yield* kv.getUint8Array("binary");
        assert.deepStrictEqual(gotUint8Array, bytes);
      })
    );

    it.effect("string values are not decoded as base64", () =>
      Effect.gen(function* () {
        const kv = yield* KeyValueStore.KeyValueStore;
        yield* kv.clear;
        const value = "Zm9v";

        yield* kv.set("string", value);

        const got5 = yield* kv.get("string");
        assert.strictEqual(got5, value);
        const gotUint8Array6 = yield* kv.getUint8Array("string");
        assert.deepStrictEqual(gotUint8Array6, new TextEncoder().encode(value));
      })
    );

    it.effect("utf8 string values", () =>
      Effect.gen(function* () {
        const kv = yield* KeyValueStore.KeyValueStore;
        yield* kv.clear;
        const value = "héllo 👋";

        yield* kv.set("utf8", value);

        const got7 = yield* kv.get("utf8");
        assert.strictEqual(got7, value);
        const gotUint8Array8 = yield* kv.getUint8Array("utf8");
        assert.deepStrictEqual(gotUint8Array8, new TextEncoder().encode(value));
      })
    );

    it.effect("remove", () =>
      Effect.gen(function* () {
        const kv = yield* KeyValueStore.KeyValueStore;
        yield* kv.clear;

        yield* kv.set("a", "1");
        yield* kv.remove("a");

        const got9 = yield* kv.get("a");
        assert.strictEqual(got9, undefined);
        const size10 = yield* kv.size;
        assert.strictEqual(size10, 0);
      })
    );

    it.effect("clear", () =>
      Effect.gen(function* () {
        const kv = yield* KeyValueStore.KeyValueStore;
        yield* kv.clear;

        yield* kv.set("a", "1");
        yield* kv.set("b", "2");
        yield* kv.clear;

        const size11 = yield* kv.size;
        assert.strictEqual(size11, 0);
        const got12 = yield* kv.get("a");
        assert.strictEqual(got12, undefined);
        const got13 = yield* kv.get("b");
        assert.strictEqual(got13, undefined);
      })
    );
  })
);
