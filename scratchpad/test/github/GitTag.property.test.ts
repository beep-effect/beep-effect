import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GitHubClient, type RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitTag, SemverTag, TagRef, versionFromTag } from "../../effected/github/GitTag.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { SemVer } from "../../effected/semver/index.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("TagRef encode/decode preserves name and commit", [Arbitrary.schema(TagRef)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(TagRef)(value);
  const decoded = yield* S.decodeEffect(TagRef)(encoded);
  assert.isTrue(S.toEquivalence(TagRef)(decoded, value));
}), runs);
it.effect.prop("SemverTag encode/decode preserves name, commit and parsed version", [Arbitrary.schema(SemverTag)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(SemverTag)(value);
  const decoded = yield* S.decodeEffect(SemverTag)(encoded);
  assert.isTrue(S.toEquivalence(SemverTag)(decoded, value));
}), runs);
it.effect.prop("version extraction is idempotent and faithful across plain, package and scoped release tags", [Arbitrary.schema(SemVer)], ([version]) => Effect.sync(() => {
  const text = version.toString();
  for (const tag of [`v${text}`, `pkg@v${text}`, `@scope/pkg@${text}`]) {
    const parsed = versionFromTag(tag);
    assertSome(parsed, text);
    assert.deepStrictEqual(O.flatMap(parsed, versionFromTag), parsed);
    assert.deepStrictEqual(O.flatMap(parsed, (value) => versionFromTag(`@scope/pkg@v${value}`)), parsed);
  }
}), runs);

const Name = S.String.check(S.isPattern(/^[a-z][a-z0-9]{0,20}$/));
const requested: RecordedCall[] = [];
const base = Layer.mergeAll(GitHubClient.layerFixture({ requested, request: {
  "POST /repos/{owner}/{repo}/git/refs": Result.succeed({ ref: "refs/tags/fixture", node_id: "ref-id", url: "https://api.github.test/ref", object: { type: "commit", sha: "sha", url: "https://api.github.test/commit" } }),
  "DELETE /repos/{owner}/{repo}/git/refs/{ref}": Result.succeed(""),
} }), Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })));
it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
  it.effect.prop("tag ref formatting is idempotent across accepted qualifications", [Arbitrary.schema(Name)], ([name]) => Effect.gen(function* () {
    requested.length = 0;
    const tags = yield* GitTag;
    yield* tags.create(name, "sha");
    yield* tags.create(`tags/${name}`, "sha");
    yield* tags.create(`refs/tags/${name}`, "sha");
    assert.deepStrictEqual(requested.map((call) => call.params.ref), [`refs/tags/${name}`, `refs/tags/${name}`, `refs/tags/${name}`]);
  }), runs);
  it.effect.prop("parsing a formatted tag preserves deletion and reformatting fidelity", [Arbitrary.schema(Name)], ([name]) => Effect.gen(function* () {
    requested.length = 0;
    const tags = yield* GitTag;
    yield* tags.create(name, "sha");
    const full = yield* S.decodeUnknownEffect(S.String)(requested[0]?.params.ref);
    yield* tags.delete(full);
    const short = yield* S.decodeUnknownEffect(S.String)(requested[1]?.params.ref);
    assert.strictEqual(short, `tags/${name}`);
    yield* tags.create(short, "sha");
    assert.deepStrictEqual(requested[2]?.params, requested[0]?.params);
  }), runs);
});
