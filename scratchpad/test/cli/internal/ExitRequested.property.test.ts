import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ExitRequested } from "../../../effected/cli/internal/ExitRequested.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("ExitRequested encodes and decodes without failure or loss", [Arbitrary.schema(ExitRequested)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(ExitRequested)(value);
    const decoded = yield* S.decodeEffect(ExitRequested)(encoded);
    assertTrue(S.toEquivalence(ExitRequested)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(ExitRequested)(decoded), encoded);
  }), runs);
