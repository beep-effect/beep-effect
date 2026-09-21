import { afterAll, expect, it } from "@effect/vitest";
import { Effect } from "effect";

let completed = 0;

it.effect.each([{ value: { amount: 1n } }])("qualification: opaque title %o", ({ value }) =>
  Effect.sync(() => {
    expect(value.amount).toBe(1n);
    completed += 1;
  })
);

afterAll(() => {
  expect(completed).toBe(1);
});
