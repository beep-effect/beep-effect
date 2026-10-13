import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Layer from "effect/Layer";
import { CommentMarker, CommentRecord, PullRequestComment } from "../../effected/github/PullRequestComment.ts";
import { harness } from "./harness.ts";

describe("PullRequestComment.delete success value", () => {
  it.effect("returns undefined after HTTP 204", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const { script, base } = harness([{ status: 204 }]);
      const context = yield* Layer.buildWithScope(PullRequestComment.layer.pipe(Layer.provideMerge(base)), scope);
      const value = yield* Effect.flatMap(PullRequestComment, (comments) => comments.delete(42))
        .pipe(Effect.provideContext(context));
      assert.strictEqual(value, undefined);
      assert.strictEqual(script.count(), 1);
      assert.strictEqual(script.calls[0]?.method, "DELETE");
      assert.strictEqual(script.calls[0]?.path, "/repos/acme/widget/issues/comments/42");
    })),
  );
});

describe("PullRequestComment response decoding", () => {
  const marker = CommentMarker.make({ namespace: "ci", key: "report" });
  const valid = { id: 42, body: marker.html, html_url: "https://example.test/comments/42" };

  for (const operation of ["create", "find", "upsert"] as const) {
    for (const [field, malformed] of [["body", { ...valid, body: {} }], ["id", { ...valid, id: 1.5 }], ["url", { ...valid, html_url: null }]] as const) {
      it.effect(`${operation} reports malformed ${field} as a typed decode failure`, () =>
        Effect.scopedWith((scope) => Effect.gen(function* () {
          const replies = operation === "create" ? [{ status: 201, body: malformed }]
            : operation === "find" ? [{ status: 200, body: [malformed] }]
            : [{ status: 200, body: [valid] }, { status: 200, body: malformed }];
          const { script, base } = harness(replies);
          const context = yield* Layer.buildWithScope(PullRequestComment.layer.pipe(Layer.provideMerge(base)), scope);
          const exit = yield* Effect.flatMap(PullRequestComment, (comments) =>
            operation === "create" ? comments.create(1, "report").pipe(Effect.asVoid)
              : operation === "find" ? comments.find(1, marker).pipe(Effect.asVoid) : comments.upsert(1, marker, "report").pipe(Effect.asVoid))
            .pipe(Effect.provideContext(context), Effect.exit);
          assert.strictEqual(Exit.hasFails(exit), true);
          assert.strictEqual(Exit.hasDies(exit), false);
          const error = exit.pipe(Exit.findError, Result.getOrThrow);
          assert.instanceOf(error, GitHubError);
          assert.strictEqual(error.kind, "decode");
          assert.strictEqual(error.operation, `PullRequestComment.${operation}`);
          assert.strictEqual(script.count(), operation === "upsert" ? 2 : 1);
        })),
      );
    }
  }

  it.effect("validates an unmarked comment before searching for a later marker", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const { base } = harness([{ status: 200, body: [{ ...valid, body: "unmarked", id: 1.5 }, valid] }]);
      const context = yield* Layer.buildWithScope(PullRequestComment.layer.pipe(Layer.provideMerge(base)), scope);
      const exit = yield* Effect.flatMap(PullRequestComment, (comments) => comments.find(1, marker))
        .pipe(Effect.provideContext(context), Effect.exit);
      assert.strictEqual(Exit.hasFails(exit), true);
      assert.strictEqual(Exit.hasDies(exit), false);
      const error = exit.pipe(Exit.findError, Result.getOrThrow);
      assert.strictEqual(error.kind, "decode");
      assert.strictEqual(error.operation, "PullRequestComment.find");
    })),
  );

  it.effect("preserves the empty body default and finds the first marked comment in order", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const { base } = harness([
        { status: 201, body: { ...valid, body: null } },
        { status: 200, body: [{ id: 1, html_url: "empty" }, valid, { ...valid, id: 43 }] },
      ]);
      const context = yield* Layer.buildWithScope(PullRequestComment.layer.pipe(Layer.provideMerge(base)), scope);
      const created = yield* Effect.flatMap(PullRequestComment, (comments) => comments.create(1, "report"))
        .pipe(Effect.provideContext(context));
      assert.strictEqual(S.is(CommentRecord)(created), true);
      assert.strictEqual(created.body, "");
      const found = yield* Effect.flatMap(PullRequestComment, (comments) => comments.find(1, marker))
        .pipe(Effect.provideContext(context));
      const comment = O.getOrThrow(found);
      assert.strictEqual(S.is(CommentRecord)(comment), true);
      assert.strictEqual(comment.id, 42);
      assert.strictEqual(comment.body, marker.html);
      assert.strictEqual(comment.url, valid.html_url);
    })),
  );
});
