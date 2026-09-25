import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

it.effect.each([1, 2])("retains context for a case: %s", (value) =>
  Effect.sync(() => expect(value).toBeGreaterThan(0))
);

it.effect.prop("retains context for generated trials", { value: S.Boolean }, ({ value }) =>
  Effect.sync(() => expect(value).toBeTypeOf("boolean"))
);

describe("nested suite", () => {
  it.effect.each([3])("retains nested case context: %s", (value) => Effect.sync(() => expect(value).toBe(3)));
});
