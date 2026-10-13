import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidPattern } from "../../../effected/glob/internal/assertValidPattern.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("InvalidPattern round trips preserve the error tag and message", [Arbitrary.schema(InvalidPattern)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(InvalidPattern)(value);
    const decoded = yield* S.decodeEffect(InvalidPattern)(encoded);
    assert.deepStrictEqual(yield* S.encodeEffect(InvalidPattern)(decoded), encoded);
    assert.strictEqual(decoded.message, value.message);
    assert.strictEqual(decoded._tag, value._tag);
  }), runs);
