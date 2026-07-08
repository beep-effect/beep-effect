import { Float16Arr, Float16ArrayFromArray } from "@beep/schema/Float16Array";
import { Float32Arr, Float32ArrayFromArray } from "@beep/schema/Float32Array";
import { Float64Arr, Float64ArrayFromArray } from "@beep/schema/Float64Array";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("Float16Array schemas", () => {
  it("accepts native Float16Array instances", () => {
    const value = new Float16Array([1, 2, 3]);

    expect(S.decodeUnknownSync(Float16Arr)(value)).toBe(value);
  });

  it("round-trips numeric arrays through Float16Array instances", () => {
    const value = S.decodeUnknownSync(Float16ArrayFromArray)([1, 2, 3]);
    const encoded = S.encodeSync(Float16ArrayFromArray)(value);

    expect(value).toBeInstanceOf(Float16Array);
    expect(A.fromIterable(value)).toEqual([1, 2, 3]);
    expect(encoded).toEqual([1, 2, 3]);
  });

  it("derives Float16Array instances from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Float16ArrayFromArray);
    const encode = S.encodeSync(Float16ArrayFromArray);
    const decode = S.decodeUnknownSync(Float16ArrayFromArray);

    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(value).toBeInstanceOf(Float16Array);
        expect(decode(encode(value))).toBeInstanceOf(Float16Array);
      }),
      { numRuns: 25 }
    );
  });
});

describe("Float32Array schemas", () => {
  it("accepts native Float32Array instances", () => {
    const value = new Float32Array([1, 2, 3]);

    expect(S.decodeUnknownSync(Float32Arr)(value)).toBe(value);
  });

  it("round-trips numeric arrays through Float32Array instances", () => {
    const value = S.decodeUnknownSync(Float32ArrayFromArray)([1, 2, 3]);
    const encoded = S.encodeSync(Float32ArrayFromArray)(value);

    expect(value).toBeInstanceOf(Float32Array);
    expect(A.fromIterable(value)).toEqual([1, 2, 3]);
    expect(encoded).toEqual([1, 2, 3]);
  });

  it("derives Float32Array instances from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Float32ArrayFromArray);
    const encode = S.encodeSync(Float32ArrayFromArray);
    const decode = S.decodeUnknownSync(Float32ArrayFromArray);

    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(value).toBeInstanceOf(Float32Array);
        expect(decode(encode(value))).toBeInstanceOf(Float32Array);
      }),
      { numRuns: 25 }
    );
  });
});

describe("Float64Array schemas", () => {
  it("accepts native Float64Array instances", () => {
    const value = new Float64Array([1, 2, 3]);

    expect(S.decodeUnknownSync(Float64Arr)(value)).toBe(value);
  });

  it("round-trips numeric arrays through Float64Array instances", () => {
    const value = S.decodeUnknownSync(Float64ArrayFromArray)([1, 2, 3]);
    const encoded = S.encodeSync(Float64ArrayFromArray)(value);

    expect(value).toBeInstanceOf(Float64Array);
    expect(A.fromIterable(value)).toEqual([1, 2, 3]);
    expect(encoded).toEqual([1, 2, 3]);
  });

  it("derives Float64Array instances from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Float64ArrayFromArray);
    const encode = S.encodeSync(Float64ArrayFromArray);
    const decode = S.decodeUnknownSync(Float64ArrayFromArray);

    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(value).toBeInstanceOf(Float64Array);
        expect(decode(encode(value))).toBeInstanceOf(Float64Array);
      }),
      { numRuns: 25 }
    );
  });
});
