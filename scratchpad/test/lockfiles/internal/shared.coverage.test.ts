import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { importerDependencies, requireLockfileVersion, splitPeerSuffix } from "../../../effected/lockfiles/internal/shared.ts";

it.effect("suffix splitting preserves unbalanced groups and accepts a suffix with no plain version", () => Effect.sync(() => {
  assert.deepStrictEqual(splitPeerSuffix("(a@1)(b@2)"), { plain: "", peerSuffix: "(a@1)(b@2)" });
  assert.deepStrictEqual(splitPeerSuffix("a@1)"), { plain: "a@1)" });
  assert.deepStrictEqual(importerDependencies({ dependencies: { "": "*", bad: "" } }, (specifier) => ({ specifier })), []);
}));
it.effect("nonfinite direct version-gate input fails typed with a printable fallback", () => Effect.gen(function* () {
  const result = yield* Effect.result(requireLockfileVersion("npm", Number.POSITIVE_INFINITY));
  assertFailure(result, { stage: "validation", cause: { _tag: "UnsupportedLockfileVersion", format: "npm", lockfileVersion: Number.POSITIVE_INFINITY, minimumSupported: 3, message: "npm lockfileVersion null is not supported: @effected/lockfiles parses npm lockfileVersion 3 and newer" } });
}));
