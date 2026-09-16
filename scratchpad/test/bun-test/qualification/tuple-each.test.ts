import { afterAll, expect, it } from "@effect/vitest";
import { Effect } from "effect";

let cases = 0;
const rows: Array<readonly [number, string]> = [[1, "one"], [2, "two"]];

it.effect.each(rows)(
  "qualification: tuple case remains intact %#",
  (value) => Effect.sync(() => {
    expect(value).toEqual(rows[cases]);
    cases += 1;
  })
);

afterAll(() => {
  expect(cases).toBe(2);
});
