import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidRepoRefError, RepoRef } from "../../effected/github/Repo.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(`${name}: encoded values decode without failure and preserve the original`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
describe("Repo schema and parser properties", () => {
  roundTrips("RepoRef", RepoRef);
  roundTrips("InvalidRepoRefError", InvalidRepoRefError);
  it.effect.prop("parsing a formatted slash-free coordinate preserves both segments and formatting is stable", [Arbitrary.schema(RepoRef)], ([ref]) => Effect.gen(function* () {
    const parsed = yield* RepoRef.parse(ref.slug);
    assertTrue(S.toEquivalence(RepoRef)(parsed, ref));
    assert.strictEqual(parsed.slug, ref.slug);
    assert.strictEqual((yield* RepoRef.parse(parsed.slug)).slug, parsed.slug);
  }), runs);
  it.effect.prop("a slash in either coordinate segment is rejected", [Arbitrary.schema(RepoRef)], ([ref]) => Effect.sync(() => {
    const ownerSlash = { owner: `${ref.owner}/extra`, repo: ref.repo };
    const repoSlash = { owner: ref.owner, repo: `extra/${ref.repo}` };
    assertFalse(S.is(RepoRef)(ownerSlash));
    assertFalse(S.is(RepoRef)(repoSlash));
    assert.throws(() => RepoRef.make(ownerSlash));
    assert.throws(() => RepoRef.make(repoSlash));
  }), runs);
});
