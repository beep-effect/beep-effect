import { afterAll, expect, it } from "@effect/vitest";

let completions = 0;

it.fails("qualification: synchronous body failure still completes", (ctx) => {
  ctx.onTestFinished(() => {
    completions += 1;
  });
  expect("synchronous-body-ran").toBe("synchronous-body-must-fail");
});

afterAll(() => {
  expect(completions).toBe(1);
});
