import { afterAll, expect, it } from "@effect/vitest";
import { Effect } from "effect";

let acquired = false;
let released = false;
let aborted = false;

// Intentionally omit per-test options: the runner's configured default must
// interrupt this fiber and await its finalizer before suite teardown.
it.live.fails("qualification: default timeout interrupts and releases", (ctx) =>
  Effect.gen(function* () {
    ctx.signal.addEventListener(
      "abort",
      () => {
        aborted = true;
      },
      { once: true }
    );
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        acquired = true;
      }),
      () =>
        Effect.sync(() => {
          released = true;
        })
    );
    return yield* Effect.never;
  })
);

afterAll(() => {
  expect(acquired).toBe(true);
  expect(aborted).toBe(true);
  expect(released).toBe(true);
});
