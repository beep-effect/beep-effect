import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { GlobSet } from "../../effected/glob/GlobSet.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("GlobSet encoding and recompilation preserve ordered patterns, matching and exclusions", [Arbitrary.schema(GlobSet), Arbitrary.schema(S.String)], ([value, candidate]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(GlobSet)(value);
    const decoded = yield* S.decodeEffect(GlobSet)(encoded);
    assert.deepStrictEqual(decoded, value);
    assert.deepStrictEqual(yield* S.encodeEffect(GlobSet)(decoded), encoded);
    const recompiled = yield* GlobSet.compile(decoded.patterns);
    assert.deepStrictEqual(recompiled.patterns, value.patterns);
    assert.strictEqual(decoded.matches(candidate), value.matches(candidate));
    assert.strictEqual(recompiled.matches(candidate), decoded.matches(candidate));
    assert.strictEqual(recompiled.isExcluded(candidate), value.isExcluded(candidate));
    assert.deepStrictEqual(recompiled.literals, value.literals);
  }), runs);
