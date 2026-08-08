import { fcRuns } from "@beep/fc-runs";
import { CauseTaggedError } from "@beep/schema/CauseTaggedError";
import { TaggedErrorClass } from "@beep/schema/TaggedErrorClass";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
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

class RecursiveExtendedBeepError extends ExtendedBeepError.extend<RecursiveExtendedBeepError>(
  "RecursiveExtendedBeepError"
)({
  active: S.Boolean,
}) {}

const CaseInsensitiveString = S.String.annotate({
  toEquivalence: () => (self: string, that: string) => Str.toLowerCase(self) === Str.toLowerCase(that),
});

class CaseInsensitiveExtendedBeepError extends ExtendedBeepError.extend<CaseInsensitiveExtendedBeepError>(
  "CaseInsensitiveExtendedBeepError"
)({
  beep: CaseInsensitiveString,
}) {}

class CustomEquivalenceError extends TaggedErrorClass<CustomEquivalenceError>("CustomEquivalenceError")(
  "CustomEquivalenceError",
  {
    beep: S.String,
  },
  {
    toEquivalence: () => () => false,
  }
) {}

const CustomEquivalencePayload = S.Struct({
  beep: S.String,
}).annotate({
  toEquivalence: () => () => false,
});

class StructCustomEquivalenceError extends TaggedErrorClass<StructCustomEquivalenceError>(
  "StructCustomEquivalenceError"
)("StructCustomEquivalenceError", CustomEquivalencePayload) {}

class ExtendedCustomEquivalenceError extends BeepError.extend<ExtendedCustomEquivalenceError>(
  "ExtendedCustomEquivalenceError"
)(
  {
    count: S.Finite,
  },
  {
    toEquivalence: () => () => false,
  }
) {}

const StructExtensionCustomEquivalencePayload = S.Struct({
  count: S.Finite,
}).annotate({
  toEquivalence: () => () => false,
});

class StructExtendedCustomEquivalenceError extends BeepError.extend<StructExtendedCustomEquivalenceError>(
  "StructExtendedCustomEquivalenceError"
)(StructExtensionCustomEquivalencePayload) {}

const StructExtensionAlwaysEquivalentPayload = S.Struct({
  count: S.Finite,
}).annotate({
  toEquivalence: () => () => true,
});

class StructExtendedAlwaysEquivalentError extends BeepError.extend<StructExtendedAlwaysEquivalentError>(
  "StructExtendedAlwaysEquivalentError"
)(StructExtensionAlwaysEquivalentPayload) {}

class InheritedCustomEquivalenceError extends TaggedErrorClass<InheritedCustomEquivalenceError>(
  "InheritedCustomEquivalenceError"
)(
  "InheritedCustomEquivalenceError",
  {
    beep: S.String,
  },
  {
    toEquivalence: () => () => true,
  }
) {}

class ExtendedInheritedCustomEquivalenceError extends InheritedCustomEquivalenceError.extend<ExtendedInheritedCustomEquivalenceError>(
  "ExtendedInheritedCustomEquivalenceError"
)({
  count: S.Finite,
}) {}

class RecursiveInheritedCustomEquivalenceError extends ExtendedInheritedCustomEquivalenceError.extend<RecursiveInheritedCustomEquivalenceError>(
  "RecursiveInheritedCustomEquivalenceError"
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
    const invalid: unknown = { beep: "boop", count: "wrong" };

    expect(() => StructuredBeepError.make(invalid as TaggedErrorNewInput<typeof StructuredBeepError>)).toThrow();
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
    const differentBaseField = StructuredExtendedBeepError.make({ beep: "beep", count: 2 });

    expect(error).toBeInstanceOf(BeepError);
    expect(error).toBeInstanceOf(StructuredExtendedBeepError);
    expect(error.count).toBe(2);
    expect(S.toEquivalence(StructuredExtendedBeepError)(error, differentBaseField)).toBe(false);
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

  it("uses replacement field equivalence when an extension overrides an inherited field", () => {
    const equivalence = S.toEquivalence(CaseInsensitiveExtendedBeepError);
    const made = CaseInsensitiveExtendedBeepError.make({ beep: "boop", count: 1 });

    expect(equivalence(CaseInsensitiveExtendedBeepError.make({ beep: "BOOP", count: 1 }), made)).toBe(true);
    expect(equivalence(CaseInsensitiveExtendedBeepError.make({ beep: "boop", count: 2 }), made)).toBe(false);
  });

  it("derives round-trip-safe equivalence from declared fields (ignores Error stack metadata)", () => {
    // Tagged errors extend Error and carry transient stack/line/column metadata
    // captured at the construction site. The default structural equivalence
    // would include those, so `decode(encode(x))` — built on a different call
    // path than `x` — would never compare equal, breaking round-trip property
    // tests. TaggedErrorClass overrides `toEquivalence` to compare declared
    // fields only; `Equal.equals`/`Hash` (identity) stay stack-sensitive.
    const equivalence = S.toEquivalence(BeepError);
    const made = BeepError.make({ beep: "boop" });
    const encoded = S.encodeUnknownSync(BeepError)(made);
    const roundTripped = S.decodeSync(BeepError)(encoded);

    expect(roundTripped.beep).toBe("boop");
    expect(equivalence(roundTripped, made)).toBe(true);
    // sensitivity: a differing declared field is NOT equivalent
    expect(equivalence(BeepError.make({ beep: "other" }), made)).toBe(false);
  });

  it("preserves declared-field equivalence through recursive extension", () => {
    const equivalence = S.toEquivalence(RecursiveExtendedBeepError);
    const made = RecursiveExtendedBeepError.make({
      active: true,
      beep: "boop",
      count: 2,
    });
    const encoded = S.encodeUnknownSync(RecursiveExtendedBeepError)(made);
    const roundTripped = S.decodeSync(RecursiveExtendedBeepError)(encoded);

    expect(equivalence(roundTripped, made)).toBe(true);
    expect(
      equivalence(
        RecursiveExtendedBeepError.make({
          active: false,
          beep: "boop",
          count: 2,
        }),
        made
      )
    ).toBe(false);
  });

  it("round-trips schema-derived recursive extension samples", () => {
    const equivalence = S.toEquivalence(RecursiveExtendedBeepError);

    fc.assert(
      fc.property(S.toArbitrary(RecursiveExtendedBeepError), (sampled) => {
        const encoded = S.encodeUnknownSync(RecursiveExtendedBeepError)(sampled);
        const roundTripped = S.decodeSync(RecursiveExtendedBeepError)(encoded);

        expect(equivalence(roundTripped, sampled)).toBe(true);
      }),
      fcRuns(25)
    );
  });

  it("honors explicit equivalence annotations on classes, input structs, and extensions", () => {
    const direct = CustomEquivalenceError.make({ beep: "boop" });
    const directEncoded = S.encodeUnknownSync(CustomEquivalenceError)(direct);
    const directRoundTrip = S.decodeSync(CustomEquivalenceError)(directEncoded);
    const fromStruct = StructCustomEquivalenceError.make({ beep: "boop" });
    const fromStructEncoded = S.encodeUnknownSync(StructCustomEquivalenceError)(fromStruct);
    const fromStructRoundTrip = S.decodeSync(StructCustomEquivalenceError)(fromStructEncoded);
    const extended = ExtendedCustomEquivalenceError.make({ beep: "boop", count: 2 });
    const extendedEncoded = S.encodeUnknownSync(ExtendedCustomEquivalenceError)(extended);
    const extendedRoundTrip = S.decodeSync(ExtendedCustomEquivalenceError)(extendedEncoded);
    const extendedFromStruct = StructExtendedCustomEquivalenceError.make({ beep: "boop", count: 2 });
    const extendedFromStructEncoded = S.encodeUnknownSync(StructExtendedCustomEquivalenceError)(extendedFromStruct);
    const extendedFromStructRoundTrip = S.decodeSync(StructExtendedCustomEquivalenceError)(extendedFromStructEncoded);

    expect(S.toEquivalence(CustomEquivalenceError)(directRoundTrip, direct)).toBe(false);
    expect(S.toEquivalence(StructCustomEquivalenceError)(fromStructRoundTrip, fromStruct)).toBe(false);
    expect(S.toEquivalence(ExtendedCustomEquivalenceError)(extendedRoundTrip, extended)).toBe(false);
    expect(S.toEquivalence(StructExtendedCustomEquivalenceError)(extendedFromStructRoundTrip, extendedFromStruct)).toBe(
      false
    );
  });

  it("combines annotated struct-extension equivalence with inherited-field equivalence", () => {
    const equivalence = S.toEquivalence(StructExtendedAlwaysEquivalentError);
    const made = StructExtendedAlwaysEquivalentError.make({ beep: "boop", count: 1 });

    expect(equivalence(StructExtendedAlwaysEquivalentError.make({ beep: "boop", count: 2 }), made)).toBe(true);
    expect(equivalence(StructExtendedAlwaysEquivalentError.make({ beep: "beep", count: 1 }), made)).toBe(false);
  });

  it("preserves base custom equivalence through recursive extension", () => {
    const extendedEquivalence = S.toEquivalence(ExtendedInheritedCustomEquivalenceError);
    const extended = ExtendedInheritedCustomEquivalenceError.make({ beep: "boop", count: 1 });

    expect(
      extendedEquivalence(ExtendedInheritedCustomEquivalenceError.make({ beep: "beep", count: 1 }), extended)
    ).toBe(true);
    expect(
      extendedEquivalence(ExtendedInheritedCustomEquivalenceError.make({ beep: "boop", count: 2 }), extended)
    ).toBe(false);

    const recursiveEquivalence = S.toEquivalence(RecursiveInheritedCustomEquivalenceError);
    const recursive = RecursiveInheritedCustomEquivalenceError.make({
      active: true,
      beep: "boop",
      count: 1,
    });

    expect(
      recursiveEquivalence(
        RecursiveInheritedCustomEquivalenceError.make({
          active: true,
          beep: "beep",
          count: 1,
        }),
        recursive
      )
    ).toBe(true);
    expect(
      recursiveEquivalence(
        RecursiveInheritedCustomEquivalenceError.make({
          active: false,
          beep: "boop",
          count: 1,
        }),
        recursive
      )
    ).toBe(false);
  });
});
