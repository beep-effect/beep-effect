import { $ScratchpadId } from "@beep/identity/packages";
import { Envelope, JsonlEvent } from "../../effected/jsonl/index.ts";
import { isRecordLike, shallowMerge } from "../../effected/jsonl/internal/merge.ts";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaAST from "effect/SchemaAST";
import * as Tuple from "effect/Tuple";

const $I = $ScratchpadId.create("tests/jsonl/EnvelopePatch");
const at = DateTime.makeUnsafe(0);
class Payload extends S.Class<Payload>("jsonl/test/EnvelopePatch/Payload")({ count: S.Finite }) {}

describe("patch encoder declaration boundaries", () => {
  it("rejects non-record inputs through the class declaration parser", () => {
    const events = Tuple.make(JsonlEvent.make("patched", { data: Payload }));
    const input = { at, event: "patched", data: Payload.make({ count: 1 }) } as const;
    Reflect.set(input, "data", null);
    assertFailure(
      Result.mapError(Envelope.encodePatchResult(input, events), (error) => error._tag),
      "InvalidData"
    );
  });

  it("retains declarations without an encoding", () => {
    const events = Tuple.make(JsonlEvent.make("patched", { data: S.declare(P.isString) }));
    assertSuccess(
      Envelope.encodePatchResult({ at, event: "patched", data: "text" }, events),
      '{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":"text"}\n'
    );
  });

  it("retains declarations whose encoding is not an object", () => {
    const events = Tuple.make(JsonlEvent.make("patched", { data: S.DateTimeUtcFromString }));
    assertSuccess(
      Envelope.encodePatchResult({ at, event: "patched", data: at }, events),
      '{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":"1970-01-01T00:00:00.000Z"}\n'
    );
  });

  it("preserves an explicit encoding parser when rejecting a non-record", () => {
    const ast = Payload.ast;
    if (!SchemaAST.isDeclaration(ast)) return assert.fail("expected a class declaration");
    const codec = S.make<typeof Payload>(new SchemaAST.Declaration(
      ast.typeParameters,
      ast.run,
      ast.annotations,
      ast.checks,
      ast.encoding,
      ast.context,
      ast.encodingChecks,
      ast.run
    ));
    const events = Tuple.make(JsonlEvent.make("patched", { data: codec }));
    const input = { at, event: "patched", data: Payload.make({ count: 1 }) } as const;
    Reflect.set(input, "data", null);
    assertFailure(
      Result.mapError(Envelope.encodePatchResult(input, events), (error) => error._tag),
      "InvalidData"
    );
  });
});

class StringPayload extends S.Class<StringPayload>($I`StringPayload`)({
  count: S.FiniteFromString,
  extra: S.String,
}) {}

for (const [name, data] of [
  ["number first", S.Union([Payload, StringPayload])],
  ["string first", S.Union([StringPayload, Payload])],
] as const) {
  it(`selects the decoded class encoder with ${name} and excludes provenance`, () => {
    const base = StringPayload.make({ count: 1, extra: "keep" });
    if (!isRecordLike(base)) return assert.fail("the class must be record-like");
    const merged = shallowMerge(base, { count: 2,
      [`~effect/Schema/Class/${Payload.identifier}`]: `~effect/Schema/Class/${Payload.identifier}`,
      [`~effect/Schema/Class/${StringPayload.identifier}`]: "forged",
    });
    const input = { at, event: "patched", data: base } as const;
    Reflect.set(input, "data", merged);
    const events = Tuple.make(JsonlEvent.make("patched", { data }));
    assertSuccess(Envelope.encodePatchResult(input, events),
      '{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":{"count":"2","extra":"keep"}}\n'
    );
    Reflect.set(input, "data", shallowMerge(base, { count: Number.NaN }));
    assertFailure(Result.mapError(Envelope.encodePatchResult(input, events), (error) => error._tag), "InvalidData");
  });
}

it("delegates unmarked class records to the original parser", () => {
  const input = { at, event: "patched", data: Payload.make({ count: 1 }) } as const;
  Reflect.set(input, "data", { count: 2 });
  const events = Tuple.make(JsonlEvent.make("patched", { data: S.suspend(() => Payload) }));
  assertFailure(Result.mapError(Envelope.encodePatchResult(input, events), (error) => error._tag), "InvalidData");
});

const wire = S.Struct({ count: S.FiniteFromString });
const wireTransformation = {
  decode: SchemaGetter.transform((fields: typeof wire.Type) => Payload.make(fields)),
  encode: SchemaGetter.transform((payload: Payload) => ({ count: payload.count })),
};
for (const [name, data, encodedCount] of [
  ["suspended class", S.suspend(() => Payload), '2'],
  ["suspended union member", S.Union([S.suspend(() => Payload), S.Null]), '2'],
  ["union wire declaration", S.Union([wire, S.Struct(Payload.fields)]).pipe(S.decodeTo(S.instanceOf(Payload), wireTransformation)), '"2"'],
  ["suspended wire declaration", S.suspend(() => wire).pipe(S.decodeTo(S.instanceOf(Payload), wireTransformation)), '"2"'],
] as const) {
  it(`encodes a merged record through a ${name}`, () => {
    const base = Payload.make({ count: 1 });
    if (!isRecordLike(base)) return assert.fail("the class must be record-like");
    const input = { at, event: "patched", data: base } as const;
    Reflect.set(input, "data", shallowMerge(base, { count: 2 }));
    const events = Tuple.make(JsonlEvent.make("patched", { data }));
    const text = Result.getOrThrow(Envelope.encodePatchResult(input, events));
    assert.notInclude(text, "~effect/Schema/Class/");
    assert.strictEqual(text,
      `{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":{"count":${encodedCount}}}\n`
    );
    Reflect.set(input, "data", shallowMerge(base, { count: Number.NaN }));
    assertFailure(Result.mapError(Envelope.encodePatchResult(input, events), (error) => error._tag), "InvalidData");
  });
}

it("retains scalar declaration parsers behind a suspension and union", () => {
  for (const data of [S.suspend(() => S.DateTimeUtcFromString), S.Union([S.DateTimeUtcFromString, S.Null])]) {
    const events = Tuple.make(JsonlEvent.make("patched", { data }));
    const input = { at, event: "patched", data: at } as const;
    assertSuccess(Envelope.encodePatchResult(input, events),
      '{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":"1970-01-01T00:00:00.000Z"}\n'
    );
    Reflect.set(input, "data", { epochMilliseconds: 0 });
    assertFailure(Result.mapError(Envelope.encodePatchResult(input, events), (error) => error._tag), "InvalidData");
  }
});

it("rewrites shared suspended members lazily by AST identity", () => {
  let evaluations = 0;
  const suspended = S.suspend(() => { evaluations += 1; return Payload; });
  const ast = new SchemaAST.Union([suspended.ast, suspended.ast]);
  const data = S.make<S.Codec<Payload, unknown>>(ast);
  const base = Payload.make({ count: 1 });
  if (!isRecordLike(base)) return assert.fail("the class must be record-like");
  const input = { at, event: "patched", data: base } as const;
  Reflect.set(input, "data", shallowMerge(base, { count: 2 }));
  assert.strictEqual(evaluations, 0, "constructing the codec must not resolve suspensions");
  const events = Tuple.make(JsonlEvent.make("patched", { data }));
  assertSuccess(Envelope.encodePatchResult(input, events),
    '{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":{"count":2}}\n'
  );
  assert.strictEqual(evaluations, 1, "shared suspensions evaluate only once");
});

it("follows chained declaration encodings to their structural wire target", () => {
  const record = wire.pipe(S.is, S.declare);
  const identityTransformation = {
    decode: SchemaGetter.transform((value: typeof wire.Type) => value),
    encode: SchemaGetter.transform((value: typeof wire.Type) => value),
  };
  const data = wire.pipe(
    S.decodeTo(record, identityTransformation),
    S.decodeTo(record, identityTransformation)
  );
  const events = Tuple.make(JsonlEvent.make("patched", { data }));
  assertSuccess(Envelope.encodePatchResult({ at, event: "patched", data: { count: 2 } }, events),
    '{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":{"count":"2"}}\n'
  );
});

it("bounds recursive non-structural wire targets and retains the declaration parser", () => {
  const recursive: SchemaAST.Suspend = new SchemaAST.Suspend(() => recursive);
  const wireAst = new SchemaAST.Union([S.Unknown.ast, recursive]);
  const wireCodec = S.make<S.Codec<unknown>>(wireAst);
  const data = wireCodec.pipe(S.decodeTo(S.declare((_value: unknown): _value is unknown => true), {
    decode: SchemaGetter.transform((value: unknown) => value),
    encode: SchemaGetter.transform((value: unknown) => value),
  }));
  const events = Tuple.make(JsonlEvent.make("patched", { data }));
  assertSuccess(Envelope.encodePatchResult({ at, event: "patched", data: { count: 2 } }, events),
    '{"at":"1970-01-01T00:00:00.000Z","event":"patched","data":{"count":2}}\n'
  );
});
