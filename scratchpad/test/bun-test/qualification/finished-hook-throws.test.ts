import { expect, it } from "@effect/vitest";

it("qualification: a throwing completion hook fails a passing body", (ctx) => {
  ctx.onTestFinished(() => {
    expect("completion-hook-ran").toBe("completion-hook-must-fail");
  });
  expect(true).toBe(true);
});
