import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { AscendOptions, Walker } from "../../effected/walker/Walker.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("AscendOptions: decode(encode(x)) equals x and decoding never fails", [Arbitrary.schema(AscendOptions)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(AscendOptions)(value);
  const decoded = yield* S.decodeEffect(AscendOptions)(encoded);
  assertTrue(S.toEquivalence(AscendOptions)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(AscendOptions)(decoded), encoded);
}), runs);

it.layer(Path.layer, { timeout: "10 seconds" })("lexical chain fidelity", (it) => {
  it.effect.prop("a normalized ceiling preserves the lexical chain and stops inclusively", [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 32 })))], ([depth]) => Effect.gen(function* () {
    const start = `/repo/${Array.from({ length: depth }, () => "child").join("/")}`;
    const expected = yield* Walker.ascend(start, { stopAt: "/repo" });
    const normalized = yield* Walker.ascend(start, { stopAt: "/repo/child/..//." });
    assert.deepStrictEqual(normalized, expected);
    assert.strictEqual(normalized.length, depth + 1);
    assert.strictEqual(normalized.at(-1), "/repo");
    const found = yield* Walker.findRoot(normalized, (dir) => dir === start ? Effect.fail("unreadable") : Effect.succeed(dir === "/repo"));
    assertSome(found, "/repo");
  }), runs);
});
