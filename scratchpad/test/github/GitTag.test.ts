import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { assertSome } from "@effect/vitest/utils";
import * as O from "effect/Option";
import { GitTag, TagRef } from "../../effected/github/GitTag.ts";
import { harness } from "./harness.ts";

const isTagRefs = S.is(S.Array(TagRef));

describe("GitTag.delete success value", () => {
  it.effect("returns undefined after HTTP 204", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const { script, base } = harness([{ status: 204 }]);
      const context = yield* Layer.buildWithScope(GitTag.layer.pipe(Layer.provideMerge(base)), scope);
      const value = yield* Effect.flatMap(GitTag, (tags) => tags.delete("refs/tags/v1.2.3"))
        .pipe(Effect.provideContext(context));
      assert.strictEqual(value, undefined);
      assert.strictEqual(script.count(), 1);
      assert.strictEqual(script.calls[0]?.method, "DELETE");
      assert.strictEqual(script.calls[0]?.path, "/repos/acme/widget/git/refs/tags/v1.2.3");
    })),
  );
});

describe("GitTag.list response decoding", () => {
  for (const [field, malformed] of [
    ["empty name", { name: "", commit: { sha: "abc" } }],
    ["non-string name", { name: 42, commit: { sha: "abc" } }],
    ["sha", { name: "v1.0.0", commit: { sha: null } }],
    ["null commit", { name: "other", commit: null }],
    ["missing commit", { name: "other" }],
    ["null entry", null],
  ] as const) {
    for (const prefix of [undefined, "v"]) {
      it.effect(`reports malformed ${field} ${prefix === undefined ? "without" : "with"} a prefix as a typed failure`, () =>
        Effect.scopedWith((scope) => Effect.gen(function* () {
          const { base } = harness([{ status: 200, body: [malformed] }]);
          const context = yield* Layer.buildWithScope(GitTag.layer.pipe(Layer.provideMerge(base)), scope);
          const exit = yield* Effect.flatMap(GitTag, (tags) => tags.list({ prefix }))
            .pipe(Effect.provideContext(context), Effect.exit);
          assert.strictEqual(Exit.hasFails(exit), true);
          assert.strictEqual(Exit.hasDies(exit), false);
          const error = exit.pipe(Exit.findError, Result.getOrThrow);
          assert.instanceOf(error, GitHubError);
          assert.strictEqual(error.kind, "decode");
          assert.strictEqual(error.operation, "GitTag.list");
        })),
      );
    }
  }

  it.effect("preserves tag order and applies the requested prefix", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const { base } = harness([{ status: 200, body: [
        { name: "v2.0.0", commit: { sha: "two" } },
        { name: "other", commit: { sha: "other" } },
        { name: "v1.0.0", commit: { sha: "one" } },
      ] }]);
      const context = yield* Layer.buildWithScope(GitTag.layer.pipe(Layer.provideMerge(base)), scope);
      const value = yield* Effect.flatMap(GitTag, (tags) => tags.list({ prefix: "v" }))
        .pipe(Effect.provideContext(context));
      assert.strictEqual(isTagRefs(value), true);
      assert.deepStrictEqual(value, [TagRef.make({ tag: "v2.0.0", sha: "two" }), TagRef.make({ tag: "v1.0.0", sha: "one" })]);
    })),
  );
});

describe("GitTag.latestSemver response decoding", () => {
  for (const [field, malformed] of [
    ["name", { name: 42, commit: { sha: "abc" } }],
    ["null SHA", { name: "v1.0.0", commit: { sha: null } }],
    ["missing commit", { name: "v1.0.0" }],
  ] as const) {
    const { base } = harness([{ status: 200, body: [malformed] }]);
    it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect(`reports malformed ${field} as a typed failure`, () => Effect.gen(function* () {
        const tags = yield* GitTag;
        const error = yield* Effect.flip(tags.latestSemver({ prefix: "v" }));
        assert.instanceOf(error, GitHubError);
        assert.strictEqual(error.kind, "decode");
        assert.strictEqual(error.operation, "GitTag.latestSemver");
      }));
    });
  }

  const { script, base } = harness([{ status: 200, body: [
    { name: "other@9.0.0" },
    { name: "v" },
    { name: "vnot-a-version" },
    { name: "v9.0.0-rc.1", commit: null },
    { name: "v2.0.0", commit: { sha: "two" } },
    { name: "v1.0.0", commit: null },
    { name: "v2.0.0" },
    { name: "v3.0.0", commit: { sha: "three" } },
  ] }]);
  it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("skips unchecked SHAs for excluded and non-winning candidates while selecting in one pass", () => Effect.gen(function* () {
      const tags = yield* GitTag;
      const latest = yield* tags.latestSemver({ prefix: "v" });
      assertSome(O.map(latest, (tag) => ({ tag: tag.tag, sha: tag.sha, version: tag.version.toString() })), {
        tag: "v3.0.0", sha: "three", version: "3.0.0",
      });
      assert.strictEqual(script.count(), 1);
    }));
  });
});

describe("GitTag.upsert normalization", () => {
  const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
  for (const exists of [false, true]) {
    const { script, base } = harness(exists ? [
      { status: 422, body: { message: "Reference already exists", errors: [{ code: "already_exists" }] } },
      { status: 200, body: {} },
    ] : [{ status: 201, body: {} }]);
    it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect(`normalizes tags/tags/foo once when ${exists ? "resetting an existing tag" : "creating a tag"}`, () => Effect.gen(function* () {
        const tags = yield* GitTag;
        yield* tags.upsert("tags/tags/foo", "abc");
        assert.strictEqual(script.calls[0]?.method, "POST");
        assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}"), {
          ref: "refs/tags/tags/foo", sha: "abc",
        });
        assert.strictEqual(script.count(), exists ? 2 : 1);
        if (exists) {
          assert.strictEqual(script.calls[1]?.method, "PATCH");
          assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/git/refs/tags/tags/foo");
          assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}"), {
            sha: "abc", force: true,
          });
        }
      }));
    });
  }
});
