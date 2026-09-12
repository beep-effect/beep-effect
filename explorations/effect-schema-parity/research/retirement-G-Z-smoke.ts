import * as D from "../../../.repos/effect/packages/effect/src/DateTime.ts";
import * as E from "../../../.repos/effect/packages/effect/src/Effect.ts";
import * as JS from "../../../.repos/effect/packages/effect/src/JsonSchema.ts";
import * as P from "../../../.repos/effect/packages/effect/src/Predicate.ts";
import * as S from "../../../.repos/effect/packages/effect/src/Schema.ts";
import * as G from "../../../.repos/effect/packages/effect/src/SchemaGetter.ts";
import * as SR from "../../../.repos/effect/packages/effect/src/SchemaRepresentation.ts";
import * as A from "../../../.repos/effect/packages/effect/src/unstable/arbitrary/Arbitrary.ts";

const checks: { name: string; value: unknown }[] = [];
function check(name: string, ok: boolean, value: unknown) {
  if (!ok) throw Error(name);
  checks.push({ name, value });
}
const mapping = S.Literals(["OK", "NO"]).transform([200, 404]);
check(
  "literal mapping directions",
  S.decodeUnknownSync(mapping)("OK") === 200 && S.encodeSync(mapping)(404) === "NO",
  "OK -> 200; 404 -> NO"
);
const hs = S.toCodecIso(S.HashSet(S.String));
check(
  "hash set iso deduplicates",
  S.encodeSync(hs)(S.decodeUnknownSync(hs)(["a", "a"])).length === 1,
  "array roundtrip has one a"
);
const graph = S.toCodecIso(S.Graph("directed", S.String, S.Number));
const snapshot = { type: "directed", nodes: [{ index: 0, data: "A" }], edges: [] };
check(
  "graph canonical snapshot",
  S.encodeSync(graph)(S.decodeUnknownSync(graph)(snapshot)).nodes[0].data === "A",
  snapshot
);
const re = S.toCodecJson(S.RegExp);
check(
  "regexp JSON carries flags",
  S.decodeUnknownSync(re)({ source: "x", flags: "i" }).flags === "i",
  S.encodeSync(re)(/x/i)
);
const defaults = S.Struct({
  a: S.Number.pipe(S.withConstructorDefault(E.succeed(3)), S.withDecodingDefaultTypeKey(E.succeed(3))),
});
check("constructor and decoding defaults", defaults.make({}).a === 3 && S.decodeUnknownSync(defaults)({}).a === 3, 3);
const split = S.String.pipe(
  S.decodeTo(S.Array(S.String), { decode: G.split(), encode: G.transform((a: readonly string[]) => a.join(",")) })
);
check("upstream split empty input changes behavior", S.decodeUnknownSync(split)("").length === 0, []);
const promiseLike = { then() {}, catch() {} };
check("promise guard accepts non-native object", S.is(S.declare(P.isPromise))(promiseLike), true);
const t = S.decodeUnknownSync(S.DateTimeUtcFromMillis)(-1);
check("timestamps allow before Unix epoch", D.toEpochMillis(t) === -1, -1);
check(
  "signed32 bounds",
  S.is(S.Number.check(S.isInt32()))(-2147483648) && !S.is(S.Number.check(S.isInt32()))(2147483648),
  "lower accepted / upper+1 rejected"
);
check(
  "unsigned32 bounds",
  S.is(S.Number.check(S.isUint32()))(4294967295) && !S.is(S.Number.check(S.isUint32()))(-1),
  "upper accepted / negative rejected"
);
check("native arbitrary schema construction", A.isArbitrary(A.schema(S.HashSet(S.String))), true);
const schema = SR.fromJsonSchemaDocument(JS.fromSchemaDraft2020_12({ type: "string" }));
check("JSON Schema importer call shape", S.is(schema)("x") && !S.is(schema)(1), "string schema imported");
const oneWay = S.String.pipe(
  S.decodeTo(S.Number, { decode: G.transform((s: string) => s.length), encode: G.forbidden(() => "one-way transform") })
);
check(
  "one-way transform uses forbidden callback",
  S.decodeUnknownSync(oneWay)("abc") === 3 && S.encodeOption(oneWay)(3)._tag === "None",
  "decode succeeds / encode forbidden"
);
console.log(JSON.stringify({ source: "51d4a2f08a5c7691dc876415bc9fc0ecf467e153", checks }, null, 2));
