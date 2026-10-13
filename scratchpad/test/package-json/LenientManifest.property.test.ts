import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const ObjectJson = S.Record(S.String, S.Json);
const Json = S.fromJsonString(ObjectJson);
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { LenientFieldIssue, LenientManifest } from "../../effected/package-json/LenientManifest.ts";
describe("LenientManifest property floor", () => {
  roundTrips("LenientFieldIssue", LenientFieldIssue);
  roundTrips("LenientManifest", LenientManifest);
});
it.effect.prop("parse/stringify fidelity preserves unknown and degraded fields", [Arbitrary.schema(ObjectJson)], ([wire]) => Effect.gen(function* () {
  const text = yield* S.encodeEffect(Json)(wire);
  const parsed = yield* LenientManifest.parse(text);
  const {rest, issues, ...known} = yield* S.encodeEffect(LenientManifest)(parsed);
  const rebuilt = yield* S.decodeUnknownEffect(ObjectJson)({...rest, ...known});
  assert.isTrue(S.toEquivalence(ObjectJson)(rebuilt, wire));
  assert.deepStrictEqual(issues, parsed.issues);
  const reparsed = yield* LenientManifest.parse(yield* S.encodeEffect(Json)(rebuilt));
  assert.isTrue(S.toEquivalence(LenientManifest)(parsed, reparsed));
  const viaResult = yield* Effect.fromResult(LenientManifest.parseResult(text));
  assert.isTrue(S.toEquivalence(LenientManifest)(viaResult, parsed));
  for (const issue of parsed.issues) {
    assert.deepStrictEqual(parsed.rest?.[issue.field], wire[issue.field]);
  }
}), runs);
