import { groupShape, schemaSignatureOf, shapeOf } from "@beep/contract-kit/Parity";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

class RateLimitedText extends RpcMiddleware.Service<RateLimitedText>()("RateLimited", {
  error: S.Struct({ retryAfter: S.String }),
}) {}
class RateLimitedNumber extends RpcMiddleware.Service<RateLimitedNumber>()("RateLimited", {
  error: S.Struct({ retryAfter: S.Finite }),
}) {}

const toFinite = S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString));
const toLength = S.String.pipe(
  S.decodeTo(
    S.Finite,
    SchemaTransformation.transform({ decode: Str.length, encode: (n: number) => Str.repeat(n)("x") })
  )
);
const trimmed = S.String.pipe(S.decodeTo(S.String, SchemaTransformation.trim()));

const same = (left: S.Top, right: S.Top): boolean => Equal.equals(schemaSignatureOf(left), schemaSignatureOf(right));

describe("Parity.schemaSignatureOf", () => {
  it("tells apart a filtered payload that JSON Schema exports as a plain string", () => {
    const draft = S.String.check(S.makeFilter((value: string) => value === "draft"));
    expect(S.toJsonSchemaDocument(S.String)).toEqual(S.toJsonSchemaDocument(draft));
    expect(same(S.String, draft)).toBe(false);
  });

  it("tells apart two different unannotated filters, and keeps one filter equal to itself", () => {
    const draft = S.makeFilter((value: string) => value === "draft");
    const published = S.makeFilter((value: string) => value === "published");
    expect(same(S.String.check(draft), S.String.check(published))).toBe(false);
    expect(same(S.String.check(draft), S.String.check(draft))).toBe(true);
  });

  it("signs a filter group by its checks", () => {
    const short = S.makeFilterGroup([S.isMinLength(1), S.isMaxLength(3)]);
    const long = S.makeFilterGroup([S.isMinLength(1), S.isMaxLength(9)]);
    expect(same(S.String.check(short), S.String.check(S.makeFilterGroup([S.isMinLength(1), S.isMaxLength(3)])))).toBe(
      true
    );
    expect(same(S.String.check(short), S.String.check(long))).toBe(false);
  });

  it("holds an undescribed declaration by reference", () => {
    const isDate = (u: unknown): u is Date => u instanceof Date;
    const first = S.declare(isDate);
    expect(same(first, first)).toBe(true);
    expect(same(first, S.declare(isDate))).toBe(false);
  });

  it("compares described filters by their description, not their object", () => {
    expect(same(S.String.check(S.isMinLength(3)), S.String.check(S.isMinLength(3)))).toBe(true);
    expect(same(S.String.check(S.isMinLength(3)), S.String.check(S.isMinLength(4)))).toBe(false);
  });

  it("tells apart string-to-number codecs decoding to S.Number and to S.Finite", () => {
    const bareNumberAstAcceptingInfinity = S.make<S.Codec<number>>(SchemaAST.number);
    const lenient = S.String.pipe(S.decodeTo(bareNumberAstAcceptingInfinity, SchemaTransformation.numberFromString));
    expect(same(lenient, toFinite)).toBe(false);
  });

  it("tells apart codecs with equal sides but different transformations, also inside S.suspend", () => {
    expect(same(toFinite, toLength)).toBe(false);
    expect(
      same(
        S.suspend(() => toFinite),
        S.suspend(() => toLength)
      )
    ).toBe(false);
    expect(
      same(
        S.suspend(() => toFinite),
        S.suspend(() => toFinite)
      )
    ).toBe(true);
  });

  it("records each transformation at its field: the same trim on a or on b differs", () => {
    expect(same(S.Struct({ a: trimmed, b: S.String }), S.Struct({ a: S.String, b: trimmed }))).toBe(false);
    expect(
      same(S.Struct({ a: toFinite, b: toLength, c: toFinite }), S.Struct({ a: toFinite, b: toLength, c: toLength }))
    ).toBe(false);
  });

  it("counts a reused sub-schema the same as a separately built copy of the same codec", () => {
    const copy = S.String.pipe(S.decodeTo(S.Finite, SchemaTransformation.numberFromString));
    expect(same(S.Struct({ a: toFinite, b: toFinite }), S.Struct({ a: toFinite, b: copy }))).toBe(true);
  });

  it("terminates on a recursive schema and tells two recursions apart", () => {
    interface Tree {
      readonly children: ReadonlyArray<Tree>;
      readonly value: number;
    }
    const Tree: S.Codec<Tree> = S.Struct({ value: S.Finite, children: S.Array(S.suspend(() => Tree)) });
    interface Tagged {
      readonly children: ReadonlyArray<Tagged>;
      readonly label: string;
    }
    const Tagged: S.Codec<Tagged> = S.Struct({ label: S.String, children: S.Array(S.suspend(() => Tagged)) });
    expect(same(Tree, Tree)).toBe(true);
    expect(same(Tree, Tagged)).toBe(false);
  });

  it("leaves annotations other than representation out of the signature, because they are not part of the wire", () => {
    const titled = S.String.pipe(S.annotate({ title: "not on the wire" }));
    expect(same(S.String, titled)).toBe(true);
  });
});

describe("Parity.shapeOf", () => {
  it("compares middleware failures through the reply exit codec: one key, failures that disagree on the wire", () => {
    const text = Rpc.make("Ping").middleware(RateLimitedText);
    const number = Rpc.make("Ping").middleware(RateLimitedNumber);
    expect(shapeOf(text).middleware).toEqual(shapeOf(number).middleware);
    expect(shapeOf(text).exit).not.toEqual(shapeOf(number).exit);
  });

  it("signs a streamed RPC's element and plain RPCs carry none", () => {
    const streamed = Rpc.make("Tail", { success: S.String, stream: true });
    const plain = Rpc.make("Ping", { success: S.String });
    expect(shapeOf(streamed).stream).toBe(true);
    expect(shapeOf(streamed).chunk).toEqual(shapeOf(Rpc.make("Other", { success: S.String, stream: true })).chunk);
    expect(shapeOf(plain).stream).toBe(false);
    expect(shapeOf(plain).chunk).toBeNull();
  });

  it("signs literals, unique symbols, enums, template literals, tuples, records and unions", () => {
    const marker = Symbol.for("parity-test-marker");
    const schema = S.Struct({
      literals: S.Literals([1n, 2n]),
      symbol: S.UniqueSymbol(marker),
      enum: S.Enum({ A: "a" }),
      template: S.TemplateLiteral(["id-", S.Finite]),
      tuple: S.Tuple([S.String]),
      record: S.Record(S.String, S.Boolean),
      union: S.Union([S.Null, S.Undefined, S.Void, S.BigInt, S.Symbol, S.ObjectKeyword, S.Unknown, S.Any, S.Never]),
      [marker]: S.optionalKey(S.String),
    });
    expect(same(schema, schema)).toBe(true);
    expect(same(schema, S.Struct({ literals: S.Literals([1n, 3n]) }))).toBe(false);
  });

  it("signs a bigint literal apart from the string of its digits", () => {
    expect(same(S.Literal(1n), S.Literal(1n))).toBe(true);
    expect(same(S.Literal(1n), S.Literal("1n"))).toBe(false);
    expect(same(S.Literal(1n), S.Literal("1"))).toBe(false);
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
