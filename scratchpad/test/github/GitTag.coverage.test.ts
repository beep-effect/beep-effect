import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { GitTag, type GitTagShape, TagRef } from "../../effected/github/GitTag.ts";
import { harness } from "./harness.ts";

it.layer(GitTag.layerTest(), { timeout: "30 seconds" })((it) => {
it.effect("unstubbed tag doubles name every member", () => Effect.gen(function* () {
  const tags = yield* GitTag;
  const direct = GitTag.makeTest();
  assert.throws(() => tags.create("v1", "sha"), /create\(\) was called but not stubbed/);
  assert.throws(() => direct.upsert("v1", "sha"), /upsert\(\) was called but not stubbed/);
  assert.throws(() => direct.delete("v1"), /delete\(\) was called but not stubbed/);
  assert.throws(() => direct.list(), /list\(\) was called but not stubbed/);
  assert.throws(() => direct.resolve("v1"), /resolve\(\) was called but not stubbed/);
  assert.throws(() => direct.latestSemver(), /latestSemver\(\) was called but not stubbed/);
}));
});
const overrides: GitTagShape = {
    create: () => Effect.void, upsert: () => Effect.void, delete: () => Effect.void,
    list: () => Effect.succeed([TagRef.make({ tag: "v1", sha: "sha" })]),
    resolve: () => Effect.succeed("sha"), latestSemver: () => Effect.succeedNone,
};
it.layer(Layer.merge(GitTag.layerTest(overrides), Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))), { timeout: "30 seconds" })((it) => {
it.effect("tag doubles retain all configured operations", () => Effect.gen(function* () {
  const direct = GitTag.makeTest(overrides);
  const tags = yield* GitTag;
  assert.strictEqual(direct.create, overrides.create);
  yield* tags.create("v1", "sha"); yield* tags.upsert("v1", "sha"); yield* tags.delete("v1");
  assert.deepStrictEqual(yield* tags.list(), [TagRef.make({ tag: "v1", sha: "sha" })]);
  assert.strictEqual(yield* tags.resolve("v1"), "sha");
  assertNone(yield* tags.latestSemver());
}));
});
{
  const { script, base } = harness([]);
  it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("empty names fail each operation before transport", () => Effect.gen(function* () {
      const tags = yield* GitTag;
      for (const operation of [tags.create("refs/tags/ ", "sha"), tags.upsert("tags/ ", "sha"), tags.delete(""), tags.resolve(" ")]) {
        const error = yield* Effect.flip(operation);
        assert.strictEqual(error.kind, "rejected");
        assert.strictEqual(error.reason, "a tag name is required");
      }
      assert.strictEqual(script.count(), 0);
    }));
  });
}
{
  const { base } = harness([{ status: 200, body: [{ name: "v1.0.0", commit: { sha: "one" } }, { name: "nightly", commit: { sha: "two" } }] }]);
  it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("list without options preserves all names and commits", () => Effect.gen(function* () {
      const tags = yield* GitTag;
      assert.deepStrictEqual(yield* tags.list(), [TagRef.make({ tag: "v1.0.0", sha: "one" }), TagRef.make({ tag: "nightly", sha: "two" })]);
    }));
  });
}
{
  const { base } = harness([{ status: 200, body: { object: { sha: "tree", type: "tree" } } }]);
  it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("resolve rejects a non-commit target", () => Effect.gen(function* () {
      const tags = yield* GitTag;
      const error = yield* Effect.flip(tags.resolve("v1"));
      assert.strictEqual(error.kind, "rejected");
      assert.strictEqual(error.reason, "tag v1 points at a tree, not a commit");
    }));
  });
}
{
  const { base } = harness([{ status: 200, body: ["other@v9.0.0", "pkg@v", "pkg@v1.0.0"].map((name) => ({ name, commit: { sha: name } })) }]);
  it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("latestSemver skips excluded prefixes and absent extracted versions", () => Effect.gen(function* () {
      const tags = yield* GitTag;
      const latest = yield* tags.latestSemver({ prefix: "pkg@" });
      assertSome(O.map(latest, (tag) => tag.tag), "pkg@v1.0.0");
    }));
  });
}
