import { afterAll, expect, it } from "@effect/vitest";

let cleanups = 0;

it("qualification: completion failure does not abandon other cleanup", (ctx) => {
  ctx.onTestFinished(() => {
    cleanups += 1;
  });
  ctx.onTestFinished(() => {
    expect("middle-hook-ran").toBe("middle-hook-must-fail");
  });
  ctx.onTestFinished(() => {
    cleanups += 1;
  });
});

afterAll(() => {
  expect(cleanups, "both cleanup callbacks must run despite the middle hook failure").toBe(2);
});
