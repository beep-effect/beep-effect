import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { mountPermit } from "../../../../effected/cli/ui/internal/mountPermit.ts";
it.effect("concurrent mounts never overlap and failed mounts release their permit", () => Effect.gen(function* () {
  let active = 0;
  let peak = 0;
  const results = yield* Effect.forEach([1, 2, 3], (value) => mountPermit.withPermit(Effect.gen(function* () {
    active += 1;
    peak = Math.max(peak, active);
    yield* Effect.yieldNow;
    active -= 1;
    return value;
  })), { concurrency: 3 });
  assert.deepStrictEqual(results, [1, 2, 3]);
  assert.strictEqual(peak, 1);
  assert.strictEqual(active, 0);
  assert.strictEqual(yield* Effect.flip(mountPermit.withPermit(Effect.fail("mount failed"))), "mount failed");
  assert.strictEqual(yield* mountPermit.withPermit(Effect.succeed("next mount")), "next mount");
}));
