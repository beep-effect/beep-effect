import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { payloadOf, unsignedJwt } from "../../../effected/github-actions/internal/jwt.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("JWT payload fidelity and canonical framing are stable through parse and reframe", [Arbitrary.schema(S.Json)], ([value]) => Effect.sync(() => {
  const token = unsignedJwt({ alg: "none" }, value);
  const parsed = Result.getOrThrow(payloadOf(token));
  assert.strictEqual(S.toEquivalence(S.Json)(S.decodeUnknownResult(S.Json)(parsed).pipe(Result.getOrThrow), value), true);
  const reframed = unsignedJwt({ alg: "none" }, parsed);
  assert.strictEqual(reframed, token);
  assertSuccess(payloadOf(reframed), parsed);
}), runs);
