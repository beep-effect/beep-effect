import { makeInternalServerError, makeNotFoundError, makeTooManyRequestsError } from "@beep/observability";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { ErrorReporter } from "effect";

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
});
