import { makeStatusCauseError, StatusCauseFields, statusCauseInput } from "@beep/schema/StatusCauseError";
import { describe, expect, it } from "@effect/vitest";
import { Option as O, pipe } from "effect";
import * as S from "effect/Schema";

class BeepStatusError extends S.TaggedError<BeepStatusError>()("BeepStatusError", StatusCauseFields) {}

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
    expect(statusCauseInput("boom", { status: 500, cause: undefined })).toEqual({
      message: "boom",
      status: 500,
      cause: O.none(),
    });
  });

  it("builds reusable constructors for status/cause tagged errors", () => {
    const toBeepStatusError = makeStatusCauseError(BeepStatusError);
    const error = toBeepStatusError({ message: "boom", status: 500, cause: new Error("kapow") });

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(S.is(BeepStatusError)(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(O.isSome(error.cause)).toBe(true);
  });

  it("supports partial application for catch handlers", () => {
    const toBeepStatusError = makeStatusCauseError(BeepStatusError);
    const error = toBeepStatusError({ message: "boom", status: 500 })(new Error("kapow"));

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(S.is(BeepStatusError)(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(O.isSome(error.cause)).toBe(true);
  });

  it("supports direct data-first partial application", () => {
    const error = makeStatusCauseError(BeepStatusError, { message: "boom", status: 500 })(new Error("kapow"));

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(S.is(BeepStatusError)(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(O.isSome(error.cause)).toBe(true);
  });

  it("supports pipeable data-last partial application", () => {
    const error = pipe(BeepStatusError, makeStatusCauseError({ message: "boom", status: 500 }))(new Error("kapow"));

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(S.is(BeepStatusError)(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(O.isSome(error.cause)).toBe(true);
  });

  it("supports explicit no-cause construction", () => {
    const toBeepStatusError = makeStatusCauseError(BeepStatusError);
    const error = toBeepStatusError({ message: "boom", status: 500, cause: undefined });

    expect(error).toBeInstanceOf(BeepStatusError);
    expect(S.is(BeepStatusError)(error)).toBe(true);
    expect(error.status).toBe(500);
    expect(O.isNone(error.cause)).toBe(true);
  });
});
