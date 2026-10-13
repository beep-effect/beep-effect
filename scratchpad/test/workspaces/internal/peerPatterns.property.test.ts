import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { peerNameMatcher } from "../../../effected/workspaces/internal/peerPatterns.ts";

const runs = { arbitrary: fcRuns(100) };
const literalSuffix = Arbitrary.schema(S.String).pipe(Arbitrary.filter((name) => Str.includes("*")(name) === false));
const patternsJson = S.Array(S.String).pipe(S.fromJsonString);

it.effect.prop("peer pattern compilation preserves literal names, ordered exclusions and JSON list fidelity", [literalSuffix], ([suffix]) => Effect.gen(function* () {
  const name = `@scope/${suffix}`;
  const other = `${name}/other`;
  const exclusion = ["*", `!${name}`];
  assert.strictEqual(peerNameMatcher([name])(name), true);
  assert.strictEqual(peerNameMatcher([name])(other), false);
  assert.strictEqual(peerNameMatcher(exclusion)(name), false);
  assert.strictEqual(peerNameMatcher(exclusion)(other), true);
  assert.strictEqual(peerNameMatcher([`!${name}`])(name), false);
  assert.strictEqual(peerNameMatcher([`!${name}`])(other), true);
  assert.strictEqual(peerNameMatcher([`!${name}`, "*"])(name), true);
  const encoded = yield* S.encodeEffect(patternsJson)(exclusion);
  const decoded = yield* S.decodeEffect(patternsJson)(encoded);
  assert.strictEqual(peerNameMatcher(decoded)(name), peerNameMatcher(exclusion)(name));
  assert.strictEqual(peerNameMatcher(decoded)(other), peerNameMatcher(exclusion)(other));
  assert.strictEqual(yield* S.encodeEffect(patternsJson)(decoded), encoded);
}), runs);
