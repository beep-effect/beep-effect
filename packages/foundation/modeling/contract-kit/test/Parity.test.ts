import { groupShape, schemaShapeOf, shapeOf } from "@beep/contract-kit/Parity";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

// Two middlewares with the same key whose failures disagree on the wire.
class RateLimitedText extends RpcMiddleware.Service<RateLimitedText>()("RateLimited", {
  error: S.Struct({ retryAfter: S.String }),
}) {}
class RateLimitedNumber extends RpcMiddleware.Service<RateLimitedNumber>()("RateLimited", {
  error: S.Struct({ retryAfter: S.Finite }),
}) {}

const Draft = S.String.check(S.makeFilter((value: string) => value === "draft"));

describe("Parity.shapeOf", () => {
  it("tells apart a filtered payload that JSON Schema exports as a plain string", () => {
    const open = Rpc.make("Publish", { payload: { status: S.String } });
    const narrowed = Rpc.make("Publish", { payload: { status: Draft } });
    expect(S.toJsonSchemaDocument(open.payloadSchema)).toEqual(S.toJsonSchemaDocument(narrowed.payloadSchema));
    expect(shapeOf(open).payload).not.toEqual(shapeOf(narrowed).payload);
  });

  it("tells apart two string-to-number codecs that decode to S.Number and S.Finite", () => {
    const lenient = Rpc.make("Count", {
      // The lenient side is the point of the case: it accepts "Infinity".
      // @effect-diagnostics-next-line schemaNumber:off
      payload: { n: S.String.pipe(S.decodeTo(S.Number, SchemaTransformation.numberFromString)) },
    });
    const finite = Rpc.make("Count", {
      payload: { n: S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString)) },
    });
    expect(shapeOf(lenient).payload.encoded).toEqual(shapeOf(finite).payload.encoded);
    expect(shapeOf(lenient).payload.decoded).not.toEqual(shapeOf(finite).payload.decoded);
    expect(shapeOf(lenient)).not.toEqual(shapeOf(finite));
  });

  it("lines the codecs up field by field, counting a reused sub-schema at each position", () => {
    const toFinite = S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString));
    const toLength = S.String.pipe(
      S.decodeTo(
        S.Finite,
        SchemaTransformation.transform({ decode: Str.length, encode: (n: number) => Str.repeat(n)("x") })
      )
    );
    const repeatFirst = schemaShapeOf(S.Struct({ a: toFinite, b: toLength, c: toFinite }));
    const repeatSecond = schemaShapeOf(S.Struct({ a: toFinite, b: toLength, c: toLength }));
    expect(repeatFirst.codecs.length).toBe(3);
    expect(repeatFirst.codecs).not.toEqual(repeatSecond.codecs);
  });

  it("counts a reused sub-schema the same as a separately built copy", () => {
    const toFinite = S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString));
    const copy = S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString));
    expect(schemaShapeOf(S.Struct({ a: toFinite, b: toFinite }))).toEqual(
      schemaShapeOf(S.Struct({ a: toFinite, b: copy }))
    );
  });

  it("requires the same transformation, not only the same two sides", () => {
    const toNumber = SchemaTransformation.transform({
      decode: (s: string) => s.length,
      encode: (n: number) => Str.repeat(n)("x"),
    });
    const shared = S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString));
    const other = S.String.pipe(S.decodeTo(S.Finite, toNumber));
    expect(schemaShapeOf(shared)).toEqual(
      schemaShapeOf(S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString)))
    );
    expect(schemaShapeOf(shared).decoded).toEqual(schemaShapeOf(other).decoded);
    expect(schemaShapeOf(shared).codecs).not.toEqual(schemaShapeOf(other).codecs);
  });

  it("compares middleware failures through the reply exit codec", () => {
    const text = Rpc.make("Ping").middleware(RateLimitedText);
    const number = Rpc.make("Ping").middleware(RateLimitedNumber);
    expect(shapeOf(text).middleware).toEqual(shapeOf(number).middleware);
    expect(shapeOf(text).exit).not.toEqual(shapeOf(number).exit);
  });

  it("represents a streamed RPC's element and plain RPCs carry none", () => {
    const streamed = Rpc.make("Tail", { success: S.String, stream: true });
    const plain = Rpc.make("Ping", { success: S.String });
    expect(shapeOf(streamed).stream).toBe(true);
    expect(shapeOf(streamed).chunk).toEqual(shapeOf(Rpc.make("Other", { success: S.String, stream: true })).chunk);
    expect(shapeOf(plain).stream).toBe(false);
    expect(shapeOf(plain).chunk).toBeNull();
  });
});

describe("Parity.groupShape", () => {
  it("is equal for two groups built from equal schemas, in tag order", () => {
    const left = RpcGroup.make(Rpc.make("B", { payload: { n: S.Finite } }), Rpc.make("A"));
    const right = RpcGroup.make(Rpc.make("A"), Rpc.make("B", { payload: { n: S.Finite } }));
    const shapes = groupShape(left);
    expect(A.map(shapes, (shape) => shape.tag)).toEqual(["A", "B"]);
    expect(groupShape(right)).toEqual(shapes);
  });
});
