import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { UnstubbedMemberError } from "../../../effected/github-actions/internal/unstubbed.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("UnstubbedMemberError decodes its encoded tag and message", [Arbitrary.schema(UnstubbedMemberError)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(UnstubbedMemberError)(value);
  const decoded = yield* S.decodeEffect(UnstubbedMemberError)(encoded);
  assert.strictEqual(decoded._tag, value._tag);
  assert.strictEqual(decoded.message, value.message);
}), runs);
