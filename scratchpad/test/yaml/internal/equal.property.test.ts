import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { deepEqual } from "../../../effected/yaml/internal/equal.ts";

const runs = { arbitrary: fcRuns(100) };
const equivalent = S.toEquivalence(S.Json);
it.effect.prop("deep equality agrees with schema structural equivalence and is symmetric", [Arbitrary.schema(S.Json), Arbitrary.schema(S.Json)], ([a, b]) => Effect.sync(() => {
  assert.strictEqual(deepEqual(a, b), equivalent(a, b));
  assert.strictEqual(deepEqual(a, b), deepEqual(b, a));
  assert.isFalse(deepEqual(a, [a]));
}), runs);
it.effect.prop("independently decoded values and reordered nested mappings compare equal", [Arbitrary.schema(S.Json)], ([value]) => Effect.gen(function* () {
  const codec = S.fromJsonString(S.Json);
  const copy = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(value));
  assert.isTrue(deepEqual(copy, value));
  assert.isTrue(deepEqual({ first: value, second: { nested: copy } }, { second: { nested: value }, first: copy }));
  assert.isFalse(deepEqual({ first: value }, { second: copy }));
}), runs);
