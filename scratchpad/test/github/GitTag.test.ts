import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { GitTag } from "../../effected/github/GitTag.ts";
import { harness } from "./harness.ts";

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
