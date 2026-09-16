import { afterAll, expect, it, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

let acquisitions = 0;
let releases = 0;

const resource = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      acquisitions += 1;
    }),
    () => Effect.sync(() => {
      releases += 1;
    })
  )
);

layer(resource)((scopedIt) => {
  scopedIt.effect("qualification: first unnamed layer owns only its block", () =>
    Effect.sync(() => {
      expect(acquisitions).toBe(1);
      expect(releases).toBe(0);
    })
  );
});

it("qualification: first unnamed layer releases before the next block", () => {
  expect(acquisitions).toBe(1);
  expect(releases).toBe(1);
});

layer(resource)((scopedIt) => {
  scopedIt.effect("qualification: second unnamed layer gets a fresh lifetime", () =>
    Effect.sync(() => {
      expect(acquisitions).toBe(2);
      expect(releases).toBe(1);
    })
  );
});

afterAll(() => {
  expect(acquisitions).toBe(2);
  expect(releases).toBe(2);
});
