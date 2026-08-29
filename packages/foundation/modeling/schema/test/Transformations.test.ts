import { destructiveTransform } from "@beep/schema/Transformations";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("destructiveTransform", () => {
  it("decodes by applying the lossy transform", () => {
    const schema = destructiveTransform(S.String, (value) => value.length);

    expect(S.decodeSync(schema)("beep")).toBe(4);
  });

  it("preserves source decode failures", () => {
    const schema = destructiveTransform(S.String, (value) => value.length);

    expect(() => S.decodeSync(schema)(1)).toThrow("Expected string");
  });

  it("maps thrown transform errors into parse issues", () => {
    const schema = destructiveTransform(S.String, () => {
      throw new Error("boom");
    });

    expect(() => S.decodeSync(schema)("beep")).toThrow("Error applying transformation");
  });

  it("passes transformed values through on encode", () => {
    const schema = destructiveTransform(S.String, (value) => value.length);

    expect(S.encodeSync(schema)(4)).toBe(4);
  });

  it("works for transformed struct fields during encode", () => {
    const schema = S.Struct({
      size: destructiveTransform(S.String, (value) => value.length),
    });

    const decoded = S.decodeSync(schema)({ size: "beep" });
    const encoded = S.encodeSync(schema)({ size: 4 });

    expect(decoded).toEqual({ size: 4 });
    expect(encoded).toEqual({ size: 4 });
  });
});
