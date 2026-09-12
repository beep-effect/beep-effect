import { Json as AcpJson } from "@beep/acp";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { assert, it } from "@effect/vitest";
import { identity } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const JsonArbitrary = Arbitrary.schema(Schema.Json);
const encodeJsonText = Schema.encodeSync(Schema.fromJsonString(Schema.Json));
// The host parser is only used to materialise object shapes (map transitions) before a reader test.
const decodeWithHostParser = Schema.decodeSync(Schema.fromJsonString(Schema.Json));
const decodeJson = Schema.decodeUnknownSync(Schema.Json);
const decodeJsonObject = Schema.decodeUnknownSync(Schema.JsonObject);
const isJsonArray = Schema.is(Schema.Array(Schema.Json));
const decodeNumberRecord = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Finite));

const read = (text: string): unknown => Result.getOrThrow(AcpJson.readJsonText(text));

const readFailure = (text: string): AcpJson.JsonTextSyntaxError =>
  Result.match(AcpJson.readJsonText(text), {
    onFailure: identity,
    onSuccess: () => assert.fail(`expected ${text} to be rejected`),
  });

const keyNeedsEscape = (key: string): boolean => encodeJsonText(key) !== `"${key}"`;

const hasKeyNeedingEscape = (value: Schema.Json): boolean => {
  if (P.isNullish(value) || P.isString(value) || P.isNumber(value) || P.isBoolean(value)) {
    return false;
  }
  if (isJsonArray(value)) {
    return A.some(value, hasKeyNeedingEscape);
  }
  return A.some(R.toEntries(value), ([key, child]) => keyNeedsEscape(key) || hasKeyNeedingEscape(child));
};

const nestedArraysInsideEscapedKey = (levels: number): string => `{"\\n":${"[".repeat(levels)}${"]".repeat(levels)}}`;

it.prop(
  "reads every JSON text produced from a schema-derived JSON value",
  [JsonArbitrary],
  ([value]) => {
    const text = encodeJsonText(value);
    assert.equal(encodeJsonText(decodeJson(read(text))), text);
  },
  { arbitrary: fcRuns(200) }
);

it.prop(
  "reports an escaped property key exactly when a key needs escaping",
  [JsonArbitrary],
  ([value]) => {
    assert.equal(AcpJson.hasEscapedPropertyKey(encodeJsonText(value)), hasKeyNeedingEscape(value));
  },
  { arbitrary: fcRuns(200) }
);

it("keeps escaped one-character keys distinct from a materialised backslash key at the same position", () => {
  // V8 12.8 through 13.7 resolves `{"beep-acp-json":0,"\n":1}` to a "\\" key once this shape exists
  // (see the readJsonText Gotchas); the reader must not depend on the host parser for such keys.
  assert.deepEqual(decodeWithHostParser('{"beep-acp-json":0,"\\\\":0}'), { "beep-acp-json": 0, "\\": 0 });
  const cases: ReadonlyArray<readonly [escaped: string, decoded: string]> = [
    ["\\n", "\n"],
    ["\\u0000", "\u0000"],
    ["\\t", "\t"],
    ['\\"', '"'],
    ["\\u0041", "A"],
  ];
  for (const [escaped, decoded] of cases) {
    assert.deepEqual(read(`{"beep-acp-json":0,"${escaped}":1}`), { "beep-acp-json": 0, [decoded]: 1 });
  }
});

it("mirrors JSON.parse value semantics on the strict path", () => {
  const proto = decodeJsonObject(read('{"__proto__":1,"a":1,"a":2,"\\u0041":true}'));
  assert.strictEqual(Object.getPrototypeOf(proto), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(proto, "__proto__")?.value, 1);
  assert.deepEqual(Struct.keys(proto), ["__proto__", "a", "A"]);
  assert.deepEqual(read('{"b":1,"1":2,"a":3,"\\n":4}'), { "1": 2, b: 1, a: 3, "\n": 4 });
  assert.deepEqual(read('{"\\ud83d\\ude00":"\\ud83d\\ude00"}'), { "😀": "😀" });
  assert.deepEqual(read('{"\\ud800":"\\udc00"}'), { "\ud800": "\udc00" });
  assert.deepEqual(read(' \t\r\n{ "\\/" : [ -0 , 1E+2 , 1e400 , 5e-324 , "" ] } \n'), {
    "/": [-0, 100, Number.POSITIVE_INFINITY, 5e-324, ""],
  });
  assert.isTrue(Object.is(decodeNumberRecord(read('{"\\b":-0}'))["\b"], -0));
  assert.deepEqual(read('{"\\f":[true,false,null]}'), { "\f": [true, false, null] });
});

it("rejects texts outside the JSON grammar with the failing position", () => {
  const cases: ReadonlyArray<readonly [text: string, position: number]> = [
    ["", 0],
    ["   ", 3],
    ["{", 1],
    ["[1,]", 3],
    ['{"a" 1}', 5],
    ["01", 1],
    ["1.", 1],
    ["-", 0],
    [".5", 0],
    ["+1", 0],
    ["NaN", 0],
    ["[1] x", 4],
    ['"abc', 4],
    ['"\\x"', 1],
    ['"\\u12"', 1],
    ['"a\nb"', 2],
    ['{"a":1,}', 7],
    ["t", 0],
    ["n", 0],
    ['{"a":}', 5],
    ["{1:2}", 1],
    ['{"\\n":1', 7],
  ];
  for (const [text, position] of cases) {
    assert.equal(readFailure(text).position, position, `position for ${encodeJsonText(text)}`);
  }
  assert.equal(readFailure('{"\\n":[1,]}').reason, "Unexpected character U+005D");
  assert.equal(readFailure("").message, "Invalid JSON text at position 0: Unexpected end of JSON text");
});

it("bounds nesting depth on the strict path", () => {
  const deepest = nestedArraysInsideEscapedKey(1023);
  assert.equal(encodeJsonText(decodeJson(read(deepest))), deepest);
  assert.equal(readFailure(nestedArraysInsideEscapedKey(1024)).reason, "Nesting depth exceeds 1024");
});

it("fromJsonText round-trips a schema through JSON text and reports syntax failures as issues", () => {
  const codec = AcpJson.fromJsonText(Schema.Struct({ meta: Schema.Record(Schema.String, Schema.Json) }));
  const value = { meta: { "\n": true, plain: 1 } };
  const encoded = Schema.encodeSync(codec)(value);
  assert.equal(encoded, '{"meta":{"\\n":true,"plain":1}}');
  assert.deepEqual(Schema.decodeSync(codec)(encoded), value);
  Result.match(Schema.decodeResult(codec)("{"), {
    onFailure: (error) => assert.include(error.message, "Invalid JSON text at position 1"),
    onSuccess: () => assert.fail("expected an invalid JSON text to be rejected"),
  });
});
