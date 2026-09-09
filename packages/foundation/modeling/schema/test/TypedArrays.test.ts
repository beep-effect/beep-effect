import { fcRuns } from "@beep/fc-runs";
import { Float16Arr, Float16ArrayFromArray } from "@beep/schema/Float16Array";
import { Float32Arr, Float32ArrayFromArray } from "@beep/schema/Float32Array";
import { Float64Arr, Float64ArrayFromArray } from "@beep/schema/Float64Array";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeFloat16ArrSync = S.decodeSync(Float16Arr);
const decodeFloat16ArrayFromArraySync = S.decodeSync(Float16ArrayFromArray);
const decodeFloat32ArrSync = S.decodeSync(Float32Arr);
const decodeFloat32ArrayFromArraySync = S.decodeSync(Float32ArrayFromArray);
const decodeFloat64ArrSync = S.decodeSync(Float64Arr);
const decodeFloat64ArrayFromArraySync = S.decodeSync(Float64ArrayFromArray);
const decodeUnknownFloat16ArrayFromArraySync = S.decodeUnknownSync(Float16ArrayFromArray);
const decodeUnknownFloat32ArrayFromArraySync = S.decodeUnknownSync(Float32ArrayFromArray);
const decodeUnknownFloat64ArrayFromArraySync = S.decodeUnknownSync(Float64ArrayFromArray);
const encodeFloat16ArrayFromArraySync = S.encodeSync(Float16ArrayFromArray);
const encodeFloat32ArrayFromArraySync = S.encodeSync(Float32ArrayFromArray);
const encodeFloat64ArrayFromArraySync = S.encodeSync(Float64ArrayFromArray);

describe("Float16Array schemas", () => {
  it("accepts native Float16Array instances", () => {
    const value = new Float16Array([1, 2, 3]);

    expect(decodeFloat16ArrSync(value)).toBe(value);
  });

  it("round-trips numeric arrays through Float16Array instances", () => {
    const value = decodeFloat16ArrayFromArraySync([1, 2, 3]);
    const encoded = encodeFloat16ArrayFromArraySync(value);

    expect(value).toBeInstanceOf(Float16Array);
    expect(A.fromIterable(value)).toEqual([1, 2, 3]);
    expect(encoded).toEqual([1, 2, 3]);
  });

  it("derives Float16Array instances from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Float16ArrayFromArray)(fc);
    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(value).toBeInstanceOf(Float16Array);
        expect(decodeUnknownFloat16ArrayFromArraySync(encodeFloat16ArrayFromArraySync(value))).toBeInstanceOf(
          Float16Array
        );
      }),
      fcRuns(25)
    );
  });
});

describe("Float32Array schemas", () => {
  it("accepts native Float32Array instances", () => {
    const value = new Float32Array([1, 2, 3]);

    expect(decodeFloat32ArrSync(value)).toBe(value);
  });

  it("round-trips numeric arrays through Float32Array instances", () => {
    const value = decodeFloat32ArrayFromArraySync([1, 2, 3]);
    const encoded = encodeFloat32ArrayFromArraySync(value);

    expect(value).toBeInstanceOf(Float32Array);
    expect(A.fromIterable(value)).toEqual([1, 2, 3]);
    expect(encoded).toEqual([1, 2, 3]);
  });

  it("derives Float32Array instances from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Float32ArrayFromArray)(fc);
    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(value).toBeInstanceOf(Float32Array);
        expect(decodeUnknownFloat32ArrayFromArraySync(encodeFloat32ArrayFromArraySync(value))).toBeInstanceOf(
          Float32Array
        );
      }),
      fcRuns(25)
    );
  });
});

describe("Float64Array schemas", () => {
  it("accepts native Float64Array instances", () => {
    const value = new Float64Array([1, 2, 3]);

    expect(decodeFloat64ArrSync(value)).toBe(value);
  });

  it("round-trips numeric arrays through Float64Array instances", () => {
    const value = decodeFloat64ArrayFromArraySync([1, 2, 3]);
    const encoded = encodeFloat64ArrayFromArraySync(value);

    expect(value).toBeInstanceOf(Float64Array);
    expect(A.fromIterable(value)).toEqual([1, 2, 3]);
    expect(encoded).toEqual([1, 2, 3]);
  });

  it("derives Float64Array instances from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Float64ArrayFromArray)(fc);
    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(value).toBeInstanceOf(Float64Array);
        expect(decodeUnknownFloat64ArrayFromArraySync(encodeFloat64ArrayFromArraySync(value))).toBeInstanceOf(
          Float64Array
        );
      }),
      fcRuns(25)
    );
  });
});
