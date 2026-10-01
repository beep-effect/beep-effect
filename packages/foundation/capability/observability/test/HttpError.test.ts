import { makeInternalServerError, makeNotFoundError, makeTooManyRequestsError } from "@beep/observability";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { ErrorReporter } from "effect";
import * as O from "effect/Option";

describe("HttpError", () => {
  it("builds a not-found error with reporter metadata", () => {
    const error = makeNotFoundError("missing repo");

    expect(error.status).toBe(404);
    expect(error.message).toBe("missing repo");
    expect(error[ErrorReporter.severity]).toBe("Info");
    expect(error[ErrorReporter.attributes]).toEqual({
      status: 404,
      status_class: "4xx",
    });
  });

  it("builds a rate-limit error with warn severity", () => {
    const error = makeTooManyRequestsError("slow down");

    expect(error.status).toBe(429);
    expect(error[ErrorReporter.severity]).toBe("Warn");
  });

  it("builds a server error with error severity", () => {
    const error = makeInternalServerError("boom");

    expect(error.status).toBe(500);
    expect(error[ErrorReporter.severity]).toBe("Error");
    expect(error[ErrorReporter.attributes]).toEqual({
      status: 500,
      status_class: "5xx",
    });
  });

  it("passes an Option cause through unchanged", () => {
    const upstream = new Error("upstream");
    const error = makeNotFoundError("missing repo", O.some(upstream));

    assertSome(error.cause, upstream);
  });

  it("wraps a raw cause in Some and a missing cause in None", () => {
    const upstream = new Error("upstream");

    assertSome(makeNotFoundError("missing repo", upstream).cause, upstream);
    assertNone(makeNotFoundError("missing repo").cause);
  });
});
