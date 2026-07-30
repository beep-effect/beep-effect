import { CauseTaggedError } from "@beep/schema/CauseTaggedError";
import { TaggedErrorClass } from "@beep/schema/TaggedErrorClass";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type { TaggedErrorNewInput } from "@beep/schema/TaggedErrorClass";

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

class RequiredCauseError extends CauseTaggedError<RequiredCauseError>("RequiredCauseError")("RequiredCauseError") {}

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

describe("TaggedErrorClass", () => {
  it("infers constructor input from schema fields (without _tag)", () => {
    expect<TaggedErrorNewInput<typeof BeepError>>().type.toBe<{ readonly beep: string }>();

    expect(BeepError).type.toBeAssignableTo<new (input: { readonly beep: string }) => BeepError>();
    expect(BeepError.make({ beep: "beep" })).type.toBe<BeepError>();

    // @ts-expect-error!
    BeepError.make({});

    // @ts-expect-error!
    BeepError.make({ beep: 1 });
  });

  it("supports schema overload and infers all fields", () => {
    expect<TaggedErrorNewInput<typeof StructuredBeepError>>().type.toBe<{
      readonly beep: string;
      readonly count: number;
    }>();

    expect(StructuredBeepError).type.toBeAssignableTo<
      new (input: {
        readonly beep: string;
        readonly count: number;
      }) => StructuredBeepError
    >();
    expect(StructuredBeepError.make({ beep: "beep", count: 1 })).type.toBe<StructuredBeepError>();

    // @ts-expect-error!
    StructuredBeepError.make({ beep: "beep" });

    // @ts-expect-error!
    StructuredBeepError.make({ beep: "beep", count: "1" });
  });

  it("requires cause-bearing constructor payloads to be explicit", () => {
    expect(RequiredCauseError.make({ cause: new Error("boom"), message: "beep" })).type.toBe<RequiredCauseError>();
    expect(OptionalCauseError.make({ cause: new Error("boom"), message: "beep" })).type.toBe<OptionalCauseError>();
    expect(OptionalCauseError.make({ message: "beep" })).type.toBe<OptionalCauseError>();

    // @ts-expect-error!
    RequiredCauseError.make({ message: "beep" });
  });

  it("preserves constructor typing across extend", () => {
    expect<TaggedErrorNewInput<typeof ExtendedBeepError>>().type.toBe<{
      readonly beep: string;
      readonly count: number;
    }>();

    expect(ExtendedBeepError).type.toBeAssignableTo<
      new (input: {
        readonly beep: string;
        readonly count: number;
      }) => ExtendedBeepError
    >();
    expect(ExtendedBeepError.make({ beep: "beep", count: 1 })).type.toBe<ExtendedBeepError>();

    // @ts-expect-error!
    ExtendedBeepError.make({ beep: "beep" });
  });

  it("preserves cause-bearing constructor typing for extended classes", () => {
    expect(
      ExtendedCauseError.make({ cause: new Error("boom"), beep: "beep", count: 1 })
    ).type.toBe<ExtendedCauseError>();

    // @ts-expect-error!
    ExtendedCauseError.make({ beep: "beep" });
  });

  it("supports the upstream struct-schema extension overload", () => {
    expect(StructuredExtendedBeepError.make({ beep: "beep", count: 1 })).type.toBe<StructuredExtendedBeepError>();

    // @ts-expect-error!
    StructuredExtendedBeepError.make({ beep: "beep" });
  });
});
