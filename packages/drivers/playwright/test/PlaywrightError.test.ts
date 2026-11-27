import { PlaywrightError, wrapError } from "@beep/playwright";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { errors } from "playwright";

describe("PlaywrightError", () => {
  it("classifies a Playwright timeout", () => {
    expect(wrapError(new errors.TimeoutError("waited 30s")).reason).toBe("Timeout");
  });

  it("groups every other thrown value under Unknown and keeps it as the cause", () => {
    const wrapped = wrapError("navigation refused");
    expect(wrapped.reason).toBe("Unknown");
    expect(wrapped.cause).toBe("navigation refused");
  });

  it.effect("is caught by its tag", () =>
    Effect.gen(function* () {
      const reason = yield* Effect.fail(PlaywrightError.make({ reason: "Timeout", cause: "late" })).pipe(
        Effect.catchTag("PlaywrightError", (error) => Effect.succeed(error.reason))
      );
      expect(reason).toBe("Timeout");
    })
  );
});
