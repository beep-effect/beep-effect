import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
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
