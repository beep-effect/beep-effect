import { fcRuns } from "@beep/fc-runs";
import { ArrayBuf, isArrayBuf } from "@beep/schema/ArrayBuffer";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const bufferOf = (bytes: ReadonlyArray<number>): ArrayBuffer => new Uint8Array(bytes).buffer;

describe("ArrayBuf", () => {
  it.effect("accepts a live ArrayBuffer", () =>
    Effect.gen(function* () {
      const value = yield* S.decodeEffect(ArrayBuf)(bufferOf([1, 2, 3]));
      expect(value.byteLength).toBe(3);
    })
  );

  it.effect("rejects views, strings, and shared memory", () =>
    Effect.gen(function* () {
      const decode = S.decodeUnknownEffect(ArrayBuf);
      const view = yield* Effect.exit(decode(new Uint8Array([1, 2])));
      const text = yield* Effect.exit(decode("AQID"));
      const shared = yield* Effect.exit(decode(new SharedArrayBuffer(4)));
      expect(Exit.isFailure(view)).toBe(true);
      expect(Exit.isFailure(text)).toBe(true);
      expect(Exit.isFailure(shared)).toBe(true);
    })
  );

  it.effect("rejects a detached ArrayBuffer", () =>
    Effect.gen(function* () {
      const buffer = new ArrayBuffer(4);
      buffer.transfer();
      const exit = yield* Effect.exit(S.decodeEffect(ArrayBuf)(buffer));
      expect(Exit.isFailure(exit)).toBe(true);
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
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it("derives byte-wise equivalence", () => {
    const equivalence = S.toEquivalence(ArrayBuf);
    expect(equivalence(bufferOf([1, 2]), bufferOf([1, 2]))).toBe(true);
    expect(equivalence(bufferOf([1, 2]), bufferOf([1, 3]))).toBe(false);
    expect(equivalence(bufferOf([1, 2]), bufferOf([1, 2, 3]))).toBe(false);
  });

  it("derives an arbitrary of live buffers", () => {
    const arbitrary = S.toArbitrary(ArrayBuf)(fc);
    fc.assert(
      fc.property(arbitrary, (buffer) => {
        expect(isArrayBuf(buffer)).toBe(true);
      }),
      fcRuns(25)
    );
  });

  it("derives a schema-backed guard", () => {
    expect(isArrayBuf(new ArrayBuffer(2))).toBe(true);
    expect(isArrayBuf(new Uint8Array(2))).toBe(false);
    const detached = new ArrayBuffer(2);
    detached.transfer();
    expect(isArrayBuf(detached)).toBe(false);
  });
});
