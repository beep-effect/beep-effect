import { TaggedErrorClass } from "@beep/schema/TaggedErrorClass";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

class BeepError extends TaggedErrorClass<BeepError>("BeepError")("BeepError", {
  beep: S.String,
}) {}

const BeepPayload = S.Struct({
  beep: S.String,
  count: S.Finite,
});

class StructuredBeepError extends TaggedErrorClass<StructuredBeepError>("StructuredBeepError")(
  "StructuredBeepError",
  BeepPayload
) {}

class RequiredCauseError extends S.TaggedError<RequiredCauseError>()("RequiredCauseError", {
  message: S.String,
  cause: S.Defect({ includeStack: true }),
}) {}

class OptionalCauseError extends TaggedErrorClass<OptionalCauseError>("OptionalCauseError")("OptionalCauseError", {
  cause: S.optionalKey(S.Defect({ includeStack: true })),
  message: S.String,
}) {}

class ExtendedBeepError extends BeepError.extend<ExtendedBeepError>("ExtendedBeepError")({
  count: S.Finite,
}) {}

class ExtendedCauseError extends BeepError.extend<ExtendedCauseError>("ExtendedCauseError")({
  cause: S.Defect({ includeStack: true }),
  count: S.Finite,
}) {}

class StructuredExtendedBeepError extends BeepError.extend<StructuredExtendedBeepError>("StructuredExtendedBeepError")(
  S.Struct({ count: S.Finite })
) {}

class RecursiveExtendedBeepError extends ExtendedBeepError.extend<RecursiveExtendedBeepError>(
  "RecursiveExtendedBeepError"
)({
  active: S.Boolean,
}) {}

describe("TaggedErrorClass", () => {
  it("creates tagged instances via the constructor", () => {
    const error = BeepError.make({ beep: "beep" });

    expect(error).toBeInstanceOf(BeepError);
    expect(error._tag).toBe("BeepError");
    expect(error.beep).toBe("beep");
  });

  it("supports struct-schema overloads via the constructor", () => {
    const error = StructuredBeepError.make({ beep: "boop", count: 2 });

    expect(error).toBeInstanceOf(StructuredBeepError);
    expect(error._tag).toBe("StructuredBeepError");
    expect(error.beep).toBe("boop");
    expect(error.count).toBe(2);
  });

  it("validates constructor payloads eagerly", () => {
    const invalid = { beep: "boop", count: Number.NaN };

    expect(() => StructuredBeepError.make(invalid)).toThrow();
  });

  it("constructs cause-bearing errors from explicit payloads", () => {
    const cause = new Error("kapow");
    const required = RequiredCauseError.make({ cause, message: "boom" });
    const optional = OptionalCauseError.make({ cause, message: "boom" });

    expect(required).toBeInstanceOf(RequiredCauseError);
    expect(required.cause).toBe(cause);
    expect(required.message).toBe("boom");
    expect(optional).toBeInstanceOf(OptionalCauseError);
    expect(optional.cause).toBe(cause);
    expect(optional.message).toBe("boom");
  });

  it("supports optional-cause payloads", () => {
    const error = OptionalCauseError.make({ message: "boom" });

    expect(error).toBeInstanceOf(OptionalCauseError);
    expect(error.message).toBe("boom");
    expect(error.cause).toBeUndefined();
  });

  it("extends tagged errors with inherited fields", () => {
    const error = ExtendedBeepError.make({ beep: "boop", count: 2 });

    expect(error).toBeInstanceOf(BeepError);
    expect(error).toBeInstanceOf(ExtendedBeepError);
    expect(error._tag).toBe("BeepError");
    expect(error.name).toBe("ExtendedBeepError");
    expect(error.beep).toBe("boop");
    expect(error.count).toBe(2);
  });

  it("keeps constructor payload validation for extended cause-bearing errors", () => {
    const cause = new Error("kapow");
    const error = ExtendedCauseError.make({ cause, beep: "boop", count: 2 });

    expect(error).toBeInstanceOf(BeepError);
    expect(error).toBeInstanceOf(ExtendedCauseError);
    expect(error._tag).toBe("BeepError");
    expect(error.name).toBe("ExtendedCauseError");
    expect(error.cause).toBe(cause);
    expect(error.beep).toBe("boop");
    expect(error.count).toBe(2);
  });

  it("supports upstream struct-schema extension overloads", () => {
    const error = StructuredExtendedBeepError.make({ beep: "boop", count: 2 });

    expect(error).toBeInstanceOf(BeepError);
    expect(error).toBeInstanceOf(StructuredExtendedBeepError);
    expect(error.count).toBe(2);
  });

  it("preserves inheritance and class metadata through recursive extension", () => {
    const error = RecursiveExtendedBeepError.make({
      active: true,
      beep: "boop",
      count: 2,
    });

    expect(error).toBeInstanceOf(BeepError);
    expect(error).toBeInstanceOf(ExtendedBeepError);
    expect(error).toBeInstanceOf(RecursiveExtendedBeepError);
    expect(error._tag).toBe("BeepError");
    expect(error.name).toBe("RecursiveExtendedBeepError");
  });
});
