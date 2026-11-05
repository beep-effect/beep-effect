import { GlobPattern } from "@beep/glob";
import { DescendError, DescendResult, descend } from "@beep/walker/Descend";
import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { platformWith } from "./support/fixtures.ts";

const pattern = Result.getOrThrow(GlobPattern.compileResult("**/*.ts"));

it.layer(platformWith({ "/repo/src/a.ts": "" }, { unresolvable: { "/repo": "PermissionDenied" } }), {
  timeout: "10 seconds",
})("unresolvable base under symlink following", (it) => {
  it.effect("fails with the base's cwd-relative path by default", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(descend(pattern, { cwd: "/repo", followSymlinks: true }));
      assertFailure(result, DescendError.make({ pattern: "**/*.ts", reason: "unreadableDirectory", path: "" }));
      assert.strictEqual(result.failure.reason, "unreadableDirectory");
      assert.strictEqual(result.failure.path, "");
    })
  );
  it.effect("skip returns no matches when the cycle guard cannot seed its base", () =>
    Effect.gen(function* () {
      const descend1 = yield* descend(pattern, { cwd: "/repo", followSymlinks: true, onUnreadable: "skip" });
      assert.deepStrictEqual(descend1, []);
    })
  );
  it.effect("record preserves the unresolved base and original filesystem reason", () =>
    Effect.gen(function* () {
      const result = yield* descend(pattern, { cwd: "/repo", followSymlinks: true, onUnreadable: "record" });
      assert.deepStrictEqual(result.matches, []);
      assert.strictEqual(result.unreadable.length, 1);
      for (const entry of result.unreadable) {
        assert.strictEqual(entry.path, "");
        assert.strictEqual(entry.cause.reason._tag, "PermissionDenied");
      }
    })
  );
});

it.layer(platformWith({ "/repo/src/a.ts": "" }, { unresolvable: { "/repo": "NotFound" } }), { timeout: "10 seconds" })(
  "vanished base under symlink following",
  (it) => {
    it.effect("a vanished base remains a benign race even in record mode", () =>
      Effect.gen(function* () {
        const descend2 = yield* descend(pattern, { cwd: "/repo", followSymlinks: true, onUnreadable: "record" });
        assert.deepStrictEqual(descend2, DescendResult.make({ matches: [], unreadable: [] }));
      })
    );
  }
);
