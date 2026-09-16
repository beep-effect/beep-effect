import { afterAll, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

let propertyRuns = 0;
let completions = 0;

it.prop(
  "qualification: pure property completion runs once",
  [S.Literal("qualification")],
  ([value], ctx) => {
    propertyRuns += 1;
    ctx.onTestFinished(() => {
      completions += 1;
    });
    expect(value).toBe("qualification");
  },
  { arbitrary: { runs: 1, maxDiscards: 0, seed: 42 } }
);

afterAll(() => {
  expect(propertyRuns).toBe(1);
  expect(completions).toBe(1);
});
