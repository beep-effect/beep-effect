import { collectBounded, OutputTooLarge } from "@beep/commands/internal/capture";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

describe("bounded capture boundary behavior", () => {
  it.effect("checks negative-infinity overflow only when a chunk arrives", () =>
    Effect.gen(function* () {
      const collectBounded1 = yield* collectBounded(Stream.empty, Number.NEGATIVE_INFINITY);
      assert.strictEqual(collectBounded1, "");
      for (const chunk of [new Uint8Array(), Uint8Array.of(65)]) {
        const error = yield* Effect.flip(collectBounded(Stream.make(chunk), Number.NEGATIVE_INFINITY));
        assert.strictEqual(error._tag, "OutputTooLarge");
        if (!S.is(OutputTooLarge)(error)) return assert.fail("expected typed capture overflow");
        assert.strictEqual(error.limit, Number.NEGATIVE_INFINITY);
      }
    })
  );

  it.effect("preserves finite boundaries and unrestricted Infinity and NaN budgets", () =>
    Effect.gen(function* () {
      const stream = Stream.make(Uint8Array.of(65));
      for (const limit of [-1, 0, 0.5]) {
        const error = yield* Effect.flip(collectBounded(stream, limit));
        assert.strictEqual(error._tag, "OutputTooLarge");
        if (!S.is(OutputTooLarge)(error)) return assert.fail("expected typed capture overflow");
        assert.strictEqual(error.limit, limit);
      }
      for (const limit of [1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
        const collectBounded2 = yield* collectBounded(stream, limit);
        assert.strictEqual(collectBounded2, "A");
        const collectBounded3 = yield* collectBounded(Stream.empty, limit);
        assert.strictEqual(collectBounded3, "");
        const collectBounded4 = yield* collectBounded(Stream.make(new Uint8Array()), limit);
        assert.strictEqual(collectBounded4, "");
      }
      const error = yield* Effect.flip(collectBounded(Stream.make(new Uint8Array()), -1));
      if (!S.is(OutputTooLarge)(error)) return assert.fail("expected typed capture overflow");
      assert.strictEqual(error.limit, -1);
    })
  );

  it("owns finite error limits plus the explicit negative-infinity sentinel", () => {
    for (const limit of [-1, 0, 0.5, Number.NEGATIVE_INFINITY]) {
      assert.isTrue(S.is(OutputTooLarge)(OutputTooLarge.make({ limit })));
    }
    for (const limit of [Number.POSITIVE_INFINITY, Number.NaN]) {
      assert.isFalse(S.is(OutputTooLarge)({ _tag: "OutputTooLarge", limit }));
      assert.throws(() => OutputTooLarge.make({ limit }));
    }
  });

  it.effect("decodes split multibyte characters and counts bytes rather than UTF-16 units", () =>
    Effect.gen(function* () {
      const stream = Stream.make(Uint8Array.of(0xf0), Uint8Array.of(0x9f, 0x98), Uint8Array.of(0x80));
      const collectBounded5 = yield* collectBounded(stream, 4);
      assert.strictEqual(collectBounded5, "😀");
      const flip6 = yield* Effect.flip(collectBounded(stream, 2));
      assert.deepStrictEqual(flip6, OutputTooLarge.make({ limit: 2 }));
    })
  );

  it.effect("consumes one transport BOM while retaining a second payload BOM", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode("\uFEFF\uFEFFhello");
      const stream = Stream.make(bytes.slice(0, 1), bytes.slice(1, 4), bytes.slice(4));
      const collectBounded7 = yield* collectBounded(stream, bytes.length);
      assert.strictEqual(collectBounded7, "\uFEFFhello");
    })
  );

  it.effect("accepts an empty stream at zero budget and retains core's incomplete UTF-8 behavior", () =>
    Effect.gen(function* () {
      const collectBounded8 = yield* collectBounded(Stream.empty, 0);
      assert.strictEqual(collectBounded8, "");
      const collectBounded9 = yield* collectBounded(Stream.make(new Uint8Array()), 0);
      assert.strictEqual(collectBounded9, "");
      // Stream.decodeText flushes an incomplete sequence as a replacement character.
      const collectBounded10 = yield* collectBounded(Stream.make(Uint8Array.of(65, 0xe2, 0x82)), 3);
      assert.strictEqual(collectBounded10, "A�");
    })
  );

  it.effect("starts a fresh byte counter for every execution of the same capture effect", () =>
    Effect.gen(function* () {
      const capture = collectBounded(2)(Stream.make(Uint8Array.of(65), Uint8Array.of(66)));
      const capture11 = yield* capture;
      assert.strictEqual(capture11, "AB");
      const capture12 = yield* capture;
      assert.strictEqual(capture12, "AB");
    })
  );
});
