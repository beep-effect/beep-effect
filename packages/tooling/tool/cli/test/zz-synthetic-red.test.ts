import { describe, it } from "@effect/vitest";
import { strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";

describe("synthetic required red (yeet-pr-events slice-1 babysit proof)", () => {
  it.effect("fails on purpose so the detached monitor hands a wave back", () =>
    Effect.sync(() => {
      strictEqual(1, 2);
    })
  );
});
