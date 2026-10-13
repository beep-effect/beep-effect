import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { headerNumber, headerString, retryAfterMillisFrom } from "../../../effected/github/internal/headers.ts";

it.effect("empty header text is absent rather than a numeric zero", () => Effect.sync(() => {
  assert.strictEqual(headerString({ value: "" }, "value"), undefined);
  assert.strictEqual(headerNumber({ value: "" }, "value"), undefined);
  assert.strictEqual(headerString({ value: "0" }, "value"), "0");
  assert.strictEqual(headerNumber({ value: "0" }, "value"), 0);
}));

for (const seconds of ["9007199254741", "9007199254740992", "1e308"]) {
  for (const mode of ["retry-after", "reset"] as const) {
    it.effect(`bounds ${mode} ${seconds} milliseconds to the safe integer domain`, () => Effect.sync(() => {
      const headers = mode === "retry-after"
        ? { "retry-after": seconds }
        : { "x-ratelimit-remaining": "0", "x-ratelimit-reset": seconds };
      const delay = retryAfterMillisFrom(headers, 0);
      assert.strictEqual(delay, Number.MAX_SAFE_INTEGER);
      assert.isTrue(S.is(S.Int)(delay));
    }));
  }
}

it.effect("preserves ordinary delays, past resets and retry-after precedence", () => Effect.sync(() => {
  assert.strictEqual(retryAfterMillisFrom({ "retry-after": "2.9" }, 1000), 2000);
  assert.strictEqual(retryAfterMillisFrom({ "retry-after": "0" }, 1000), 0);
  assert.strictEqual(retryAfterMillisFrom({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1" }, 2000), 0);
  assert.strictEqual(retryAfterMillisFrom({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "3" }, 1000), 2000);
  assert.strictEqual(retryAfterMillisFrom({ "retry-after": "2", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1e308" }, 1000), 2000);
}));
