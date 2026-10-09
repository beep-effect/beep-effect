import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PullRequestComment } from "../../effected/github/PullRequestComment.ts";
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
