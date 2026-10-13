import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LazyViewShapeError } from "../../../../effected/cli/ui/internal/lazyView.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("LazyViewShapeError decodes every encoded value with the same structural fields", [Arbitrary.schema(LazyViewShapeError)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(LazyViewShapeError)(value);
  const decoded = yield* S.decodeEffect(LazyViewShapeError)(encoded);
  assert.strictEqual(decoded.message, value.message);
  assert.strictEqual(decoded._tag, value._tag);
  assert.strictEqual(decoded.name, value.name);
  assert.deepStrictEqual(yield* S.encodeEffect(LazyViewShapeError)(decoded), encoded);
}), runs);
