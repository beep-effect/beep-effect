import { afterAll, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

let released = false;

// The harness sets the file default to 100 ms. This suite override must apply
// through its nested suite and must not be replaced by an adapter default.
describe("qualification: inherited suite timeout", { concurrent: false, timeout: 1_000 }, () => {
  describe("nested suite without an override", () => {
    it.live("outlives the file default within its inherited deadline", () =>
      Effect.acquireUseRelease(
        Effect.void,
        () => Effect.sleep("200 millis"),
        () => Effect.sync(() => {
          released = true;
        })
      )
    );
  });
});

afterAll(() => {
  expect(released).toBe(true);
});
