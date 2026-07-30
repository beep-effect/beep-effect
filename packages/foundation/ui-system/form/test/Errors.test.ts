import { FieldErrorEntry, toFieldErrors } from "@beep/form/core/Errors";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

describe("@beep/form toFieldErrors", () => {
  it("exposes a schema-backed render entry without changing its structural shape", () => {
    const entry = FieldErrorEntry.make({ message: "Required" });
    const undefinedEntry = FieldErrorEntry.make({ message: undefined });

    expect(S.is(FieldErrorEntry)(entry)).toBe(true);
    expect(S.is(FieldErrorEntry)(undefinedEntry)).toBe(true);
    expect(entry).toEqual({ message: "Required" });
  });

  it("keeps issues with string messages and bare string errors", () => {
    expect(toFieldErrors([{ message: "Required" }, "Too short"])).toEqual([
      { message: "Required" },
      { message: "Too short" },
    ]);
  });

  it("drops entries without a usable message", () => {
    expect(toFieldErrors([{ path: ["x"] }, null, undefined, 42, { message: 7 }])).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(toFieldErrors(undefined)).toEqual([]);
  });
});
