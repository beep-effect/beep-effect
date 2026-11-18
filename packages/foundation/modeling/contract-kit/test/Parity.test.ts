import { groupShape, shapeOf } from "@beep/contract-kit/Parity";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import * as S from "effect/Schema";

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
