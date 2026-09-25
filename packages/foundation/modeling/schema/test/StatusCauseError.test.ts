import { makeStatusCauseError, StatusCauseFields, statusCauseInput } from "@beep/schema/StatusCauseError";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import { Option as O, pipe } from "effect";
import * as S from "effect/Schema";

class BeepStatusError extends S.TaggedError<BeepStatusError>()("BeepStatusError", StatusCauseFields) {}
const isBeepStatusError = S.is(BeepStatusError);

describe("StatusCauseError", () => {
  it("reuses the shared field schema for tagged errors", () => {
    const error = BeepStatusError.make({
      message: "boom",
      status: 500,
      cause: O.none(),
    });

    expect(error._tag).toBe("BeepStatusError");
    expect(error.status).toBe(500);
  });

  it("normalizes optional causes when constructing payloads", () => {
    deepStrictEqual(
      { ...statusCauseInput("boom", { status: 500, cause: undefined }) },
      {
        message: "boom",
        status: 500,
        cause: O.none(),
      }
    );
  });

  it("builds reusable constructors for status/cause tagged errors", () => {
    const toBeepStatusError = makeStatusCauseError(BeepStatusError);
    const cause = new Error("kapow");
    const error = toBeepStatusError({ message: "boom", status: 500, cause });

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(isBeepStatusError(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom");
    assertSome(error.cause, cause);
    expect(error.cause.value).toBe(cause);
  });

  it("supports partial application for catch handlers", () => {
    const toBeepStatusError = makeStatusCauseError(BeepStatusError);
    const cause = new Error("kapow");
    const error = toBeepStatusError({ message: "boom", status: 500 })(cause);

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(isBeepStatusError(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom");
    assertSome(error.cause, cause);
    expect(error.cause.value).toBe(cause);
  });

  it("supports direct data-first partial application", () => {
    const cause = new Error("kapow");
    const error = makeStatusCauseError(BeepStatusError, { message: "boom", status: 500 })(cause);

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(isBeepStatusError(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom");
    assertSome(error.cause, cause);
    expect(error.cause.value).toBe(cause);
  });

  it("supports pipeable data-last partial application", () => {
    const cause = new Error("kapow");
    const error = pipe(BeepStatusError, makeStatusCauseError({ message: "boom", status: 500 }))(cause);

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(isBeepStatusError(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom");
    assertSome(error.cause, cause);
    expect(error.cause.value).toBe(cause);
  });

  it("supports explicit no-cause construction", () => {
    const toBeepStatusError = makeStatusCauseError(BeepStatusError);
    const error = toBeepStatusError({ message: "boom", status: 500, cause: undefined });

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(isBeepStatusError(error)).toBe(true);
    expect(error.status).toBe(500);
    pipe(error.cause, O.isNone, assertTrue);
  });
});
