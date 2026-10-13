import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CommentMarker, CommentRecord } from "../../effected/github/PullRequestComment.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(`${name}: encoded values decode without failure and preserve the original`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("PullRequestComment schema and marker properties", () => {
  roundTrips("CommentMarker", CommentMarker);
  roundTrips("CommentRecord", CommentRecord);
  it.effect.prop("markers recognize their exact rendering inside an arbitrary body", [Arbitrary.schema(CommentMarker), Arbitrary.schema(S.String)], ([marker, body]) => Effect.gen(function* () {
    assert.strictEqual(marker.html, `<!-- ${marker.namespace}:${marker.key} -->`);
    assertTrue(marker.matches(`${body}\n\n${marker.html}`));
    assert.strictEqual(marker.matches(body), Str.includes(marker.html)(body));
  }), runs);
});
