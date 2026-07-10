import { Bytes } from "@beep/schema/Bytes";
import { Float } from "@beep/schema/Float";
import { Sint64 } from "@beep/schema/Sint64";
import { Uint32 } from "@beep/schema/Uint32";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type {
  Bytes as RootBytes,
  Bytes as RootBytesType,
  Double as RootDouble,
  Double as RootDoubleType,
  Fixed32 as RootFixed32,
  Fixed32 as RootFixed32Type,
  Fixed64 as RootFixed64,
  Fixed64 as RootFixed64Type,
  Float as RootFloat,
  Float as RootFloatType,
  Sfixed32 as RootSfixed32,
  Sfixed32 as RootSfixed32Type,
  Sfixed64 as RootSfixed64,
  Sfixed64 as RootSfixed64Type,
  Sint32 as RootSint32,
  Sint32 as RootSint32Type,
  Sint64 as RootSint64,
  Sint64 as RootSint64Type,
  Uint32 as RootUint32,
  Uint32 as RootUint32Type,
  Uint64 as RootUint64,
  Uint64 as RootUint64Type,
} from "@beep/schema";
import type { Bytes as BytesType } from "@beep/schema/Bytes";
import type { Double, Double as DoubleType } from "@beep/schema/Double";
import type { Fixed32, Fixed32 as Fixed32Type } from "@beep/schema/Fixed32";
import type { Fixed64, Fixed64 as Fixed64Type } from "@beep/schema/Fixed64";
import type { Float as FloatType } from "@beep/schema/Float";
import type { Sfixed32, Sfixed32 as Sfixed32Type } from "@beep/schema/Sfixed32";
import type { Sfixed64, Sfixed64 as Sfixed64Type } from "@beep/schema/Sfixed64";
import type { Sint32, Sint32 as Sint32Type } from "@beep/schema/Sint32";
import type { Sint64 as Sint64Type } from "@beep/schema/Sint64";
import type { Uint32 as Uint32Type } from "@beep/schema/Uint32";
import type { Uint64, Uint64 as Uint64Type } from "@beep/schema/Uint64";
import type { Effect } from "effect";
import type * as Brand from "effect/Brand";

interface ProtobufLongLike {
  readonly high: number;
  readonly low: number;
  toString(): string;
  readonly unsigned?: boolean;
}

type ProtobufInt64Input = bigint | number | string | ProtobufLongLike;

describe("protobuf scalar schemas", () => {
  it("preserves the branded 32-bit number schema surfaces", () => {
    expect<Uint32>().type.toBe<number & Brand.Brand<"Uint32">>();
    expect<Sint32>().type.toBe<number & Brand.Brand<"Sint32">>();
    expect<Fixed32>().type.toBe<number & Brand.Brand<"Fixed32">>();
    expect<Sfixed32>().type.toBe<number & Brand.Brand<"Sfixed32">>();
    expect<typeof Uint32.Encoded>().type.toBe<number>();
    expect<typeof Sint32.Encoded>().type.toBe<number>();
    expect<typeof Fixed32.Encoded>().type.toBe<number>();
    expect<typeof Sfixed32.Encoded>().type.toBe<number>();
    expect<Uint32Type>().type.toBe<number & Brand.Brand<"Uint32">>();
    expect<Sint32Type>().type.toBe<number & Brand.Brand<"Sint32">>();
    expect<Fixed32Type>().type.toBe<number & Brand.Brand<"Fixed32">>();
    expect<Sfixed32Type>().type.toBe<number & Brand.Brand<"Sfixed32">>();
  });

  it("preserves the branded floating-point schema surfaces", () => {
    expect<Float>().type.toBe<number & Brand.Brand<"Float">>();
    expect<Double>().type.toBe<number & Brand.Brand<"Double">>();
    expect<typeof Float.Encoded>().type.toBe<number>();
    expect<typeof Double.Encoded>().type.toBe<number>();
    expect<FloatType>().type.toBe<number & Brand.Brand<"Float">>();
    expect<DoubleType>().type.toBe<number & Brand.Brand<"Double">>();
  });

  it("preserves the branded 64-bit bigint schema surfaces", () => {
    expect<Uint64>().type.toBe<bigint & Brand.Brand<"Uint64">>();
    expect<Sint64>().type.toBe<bigint & Brand.Brand<"Sint64">>();
    expect<Fixed64>().type.toBe<bigint & Brand.Brand<"Fixed64">>();
    expect<Sfixed64>().type.toBe<bigint & Brand.Brand<"Sfixed64">>();
    expect<typeof Uint64.Encoded>().type.toBe<ProtobufInt64Input>();
    expect<typeof Sint64.Encoded>().type.toBe<ProtobufInt64Input>();
    expect<typeof Fixed64.Encoded>().type.toBe<ProtobufInt64Input>();
    expect<typeof Sfixed64.Encoded>().type.toBe<ProtobufInt64Input>();
    expect<Uint64Type>().type.toBe<bigint & Brand.Brand<"Uint64">>();
    expect<Sint64Type>().type.toBe<bigint & Brand.Brand<"Sint64">>();
    expect<Fixed64Type>().type.toBe<bigint & Brand.Brand<"Fixed64">>();
    expect<Sfixed64Type>().type.toBe<bigint & Brand.Brand<"Sfixed64">>();
  });

  it("preserves the branded bytes schema surface", () => {
    expect<Bytes>().type.toBe<globalThis.Uint8Array<ArrayBufferLike> & Brand.Brand<"Bytes">>();
    expect<typeof Bytes.Encoded>().type.toBe<globalThis.Uint8Array<ArrayBufferLike>>();
    expect<BytesType>().type.toBe<globalThis.Uint8Array<ArrayBufferLike> & Brand.Brand<"Bytes">>();
  });

  it("exposes decode helpers with expected effect types", () => {
    const decodeUint32 = S.decodeUnknownEffect(Uint32);
    const decodeSint64 = S.decodeUnknownEffect(Sint64);
    const decodeFloat = S.decodeUnknownEffect(Float);
    const decodeBytes = S.decodeUnknownEffect(Bytes);

    expect(decodeUint32(1)).type.toBe<Effect.Effect<Uint32Type, S.SchemaError, never>>();
    expect(decodeSint64(BigInt(1))).type.toBe<Effect.Effect<Sint64Type, S.SchemaError, never>>();
    expect(decodeSint64("1")).type.toBe<Effect.Effect<Sint64Type, S.SchemaError, never>>();
    expect(decodeFloat(1.5)).type.toBe<Effect.Effect<FloatType, S.SchemaError, never>>();
    expect(decodeBytes(new Uint8Array())).type.toBe<Effect.Effect<BytesType, S.SchemaError, never>>();
  });

  it("exports protobuf scalar helpers from the package root barrel", () => {
    expect<typeof RootUint32>().type.toBe<typeof Uint32>();
    expect<typeof RootSint32>().type.toBe<typeof Sint32>();
    expect<typeof RootFixed32>().type.toBe<typeof Fixed32>();
    expect<typeof RootSfixed32>().type.toBe<typeof Sfixed32>();
    expect<typeof RootFloat>().type.toBe<typeof Float>();
    expect<typeof RootDouble>().type.toBe<typeof Double>();
    expect<typeof RootUint64>().type.toBe<typeof Uint64>();
    expect<typeof RootSint64>().type.toBe<typeof Sint64>();
    expect<typeof RootFixed64>().type.toBe<typeof Fixed64>();
    expect<typeof RootSfixed64>().type.toBe<typeof Sfixed64>();
    expect<typeof RootBytes>().type.toBe<typeof Bytes>();
    expect<RootUint32Type>().type.toBe<Uint32Type>();
    expect<RootSint32Type>().type.toBe<Sint32Type>();
    expect<RootFixed32Type>().type.toBe<Fixed32Type>();
    expect<RootSfixed32Type>().type.toBe<Sfixed32Type>();
    expect<RootFloatType>().type.toBe<FloatType>();
    expect<RootDoubleType>().type.toBe<DoubleType>();
    expect<RootUint64Type>().type.toBe<Uint64Type>();
    expect<RootSint64Type>().type.toBe<Sint64Type>();
    expect<RootFixed64Type>().type.toBe<Fixed64Type>();
    expect<RootSfixed64Type>().type.toBe<Sfixed64Type>();
    expect<RootBytesType>().type.toBe<BytesType>();
  });
});
