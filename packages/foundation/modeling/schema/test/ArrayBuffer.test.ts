import { fcRuns } from "@beep/fc-runs";
import { ArrayBuf, isArrayBuf } from "@beep/schema/ArrayBuffer";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeArrayBuf = S.decodeEffect(ArrayBuf);
const decodeUnknownArrayBuf = S.decodeUnknownEffect(ArrayBuf);

const bufferOf = (bytes: ReadonlyArray<number>): ArrayBuffer => new Uint8Array(bytes).buffer;

describe("ArrayBuf", () => {
  it.effect("accepts a live ArrayBuffer", () =>
    Effect.gen(function* () {
      const value = yield* decodeArrayBuf(bufferOf([1, 2, 3]));
      expect(value.byteLength).toBe(3);
    })
  );

  it.effect("rejects views, strings, and shared memory", () =>
    Effect.gen(function* () {
      const view = yield* Effect.exit(decodeUnknownArrayBuf(new Uint8Array([1, 2])));
      const text = yield* Effect.exit(decodeUnknownArrayBuf("AQID"));
      const shared = yield* Effect.exit(decodeUnknownArrayBuf(new SharedArrayBuffer(4)));
      pipe(view, Exit.isFailure, assertTrue);
      pipe(text, Exit.isFailure, assertTrue);
      pipe(shared, Exit.isFailure, assertTrue);
    })
  );

  it.effect("rejects a detached ArrayBuffer", () =>
    Effect.gen(function* () {
      const buffer = new ArrayBuffer(4);
      buffer.transfer();
      const exit = yield* Effect.exit(decodeArrayBuf(buffer));
      pipe(exit, Exit.isFailure, assertTrue);
    })
  );

  it.effect("JSON codec round-trips through base64", () =>
    Effect.gen(function* () {
      const codec = S.toCodecJson(ArrayBuf);
      const encoded = yield* S.encodeEffect(codec)(bufferOf([104, 105]));
      expect(encoded).toBe("aGk=");
      const decoded = yield* S.decodeEffect(codec)(encoded);
      expect(Array.from(new Uint8Array(decoded))).toEqual([104, 105]);
    })
  );

  it.effect("JSON codec rejects invalid base64 input", () =>
    Effect.gen(function* () {
      const codec = S.toCodecJson(ArrayBuf);
      const exit = yield* Effect.exit(S.decodeEffect(codec)("not*base64!"));
      pipe(exit, Exit.isFailure, assertTrue);
    })
  );

  it("derives byte-wise equivalence", () => {
    const equivalence = S.toEquivalence(ArrayBuf);
    expect(equivalence(bufferOf([1, 2]), bufferOf([1, 2]))).toBe(true);
    expect(equivalence(bufferOf([1, 2]), bufferOf([1, 3]))).toBe(false);
    expect(equivalence(bufferOf([1, 2]), bufferOf([1, 2, 3]))).toBe(false);
  });

  {
    const arbitrary = Arbitrary.schema(ArrayBuf);
    it.effect.prop(
      "derives an arbitrary of live buffers",
      [arbitrary],
      Effect.fnUntraced(function* ([buffer]) {
        expect(isArrayBuf(buffer)).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(25) }
    );
  }

  it("derives a schema-backed guard", () => {
    expect(isArrayBuf(new ArrayBuffer(2))).toBe(true);
    expect(isArrayBuf(new Uint8Array(2))).toBe(false);
    const detached = new ArrayBuffer(2);
    detached.transfer();
    expect(isArrayBuf(detached)).toBe(false);
  });
});
