import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { detectIndent, renderJson, resolveFormatOptions, resolveIndent, sortKeys, stripEmptyDependencyMaps } from "../../../effected/package-json/internal/format.ts";
const ObjectJson = S.Record(S.String, S.Json);
describe("internal format property floor", () => {
  it.effect.prop("sortKeys is idempotent and value-faithful", [Arbitrary.schema(ObjectJson)], ([value]) => Effect.sync(() => {
    const sorted = sortKeys(value);
    assert.deepStrictEqual(sortKeys(sorted), sorted);
    assert.deepStrictEqual(sorted, value);
  }), runs);
  it.effect.prop("stripping empty maps is idempotent and keeps other fields", [Arbitrary.schema(S.Struct({ custom: S.Json, scripts: S.Record(S.String, S.String) }))], ([value]) => Effect.sync(() => {
    const stripped = stripEmptyDependencyMaps(value);
    assert.deepStrictEqual(stripEmptyDependencyMaps(stripped), stripped);
    assert.deepStrictEqual(stripped.custom, value.custom);
    assert.deepStrictEqual(stripped.scripts, Object.keys(value.scripts).length === 0 ? undefined : value.scripts);
  }), runs);
  it.effect.prop("renderJson is idempotent and parse/stringify is faithful", [Arbitrary.schema(ObjectJson)], ([value]) => Effect.gen(function* () {
    const options = resolveFormatOptions({ stripEmpty: false });
    const text = renderJson(value, options);
    const json = S.fromJsonString(ObjectJson);
    const parsed = yield* S.decodeEffect(json)(text);
    const originalParsed = yield* S.decodeEffect(json)(yield* S.encodeEffect(json)(value));
    assert.deepStrictEqual(parsed, originalParsed);
    assert.strictEqual(renderJson(parsed, options), text);
    assert.strictEqual(renderJson(options)(parsed), text);
  }), runs);
  it.effect.prop("indent detection and preserve resolution agree", [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 10 })))], ([size]) => Effect.sync(() => {
    const source = renderJson({ name: "p" }, resolveFormatOptions({ indent: size }));
    assert.strictEqual(detectIndent(source), " ".repeat(size));
    assert.strictEqual(resolveIndent("preserve", source), " ".repeat(size));
    assert.strictEqual(resolveIndent(source)("preserve"), " ".repeat(size));
  }), runs);
});
