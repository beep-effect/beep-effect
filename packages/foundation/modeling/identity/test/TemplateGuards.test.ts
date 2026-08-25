import { IdentityInterpolationError, IdentitySegmentCountError, make } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";

const $I = make("probe").$ProbeId.create("Widget");

const templateStrings = (...parts: ReadonlyArray<string>) => Object.assign([...parts], { raw: [...parts] });

describe("identity template guards", () => {
  it("rejects a template with interpolations", () => {
    expect(() => $I(templateStrings("Widget", "Error"), "x")).toThrow(IdentityInterpolationError);
  });

  it("rejects an empty template", () => {
    expect(() => $I(templateStrings())).toThrow(IdentitySegmentCountError);
  });

  it("rejects a template with more than one literal segment", () => {
    expect(() => $I(templateStrings("Widget", "Error"))).toThrow(IdentitySegmentCountError);
  });

  it("explains both guard failures", () => {
    expect(IdentityInterpolationError.make({}).message).toBe("Identity template tags do not allow interpolations.");
    expect(IdentitySegmentCountError.make({}).message).toBe(
      "Identity template tags must use a single literal segment."
    );
  });
});
