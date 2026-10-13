import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Audience, AudienceKind, AudienceSource } from "../../effected/env/Audience.ts";

import * as O from "effect/Option";
import { RuntimeEnv } from "../../effected/env/RuntimeEnv.ts";

const runs = { arbitrary: fcRuns(100) };

describe("Audience schema property floor", () => {
  it.effect.prop(
    "AudienceKind: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(AudienceKind)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(AudienceKind)(value);
      const decoded = yield* S.decodeEffect(AudienceKind)(encoded);
      assert.isTrue(S.toEquivalence(AudienceKind)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(AudienceKind)(decoded), encoded);
    }),
    runs,
  );
  it.effect.prop(
    "AudienceSource: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(AudienceSource)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(AudienceSource)(value);
      const decoded = yield* S.decodeEffect(AudienceSource)(encoded);
      assert.isTrue(S.toEquivalence(AudienceSource)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(AudienceSource)(decoded), encoded);
    }),
    runs,
  );
});

describe("Audience detection precedence", () => {
  it.effect.prop("an agent takes precedence over CI, then a human fallback", [Arbitrary.schema(RuntimeEnv)], ([env]) =>
    Effect.sync(() => {
      const expected = O.match(env.agent, {
        onSome: () => "agent",
        onNone: () => O.match(env.ci, { onSome: () => "ci", onNone: () => "human" }),
      });
      assert.strictEqual(Audience.detect(env), expected);
    }), runs);
});
