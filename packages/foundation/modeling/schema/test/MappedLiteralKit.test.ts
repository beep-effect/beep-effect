import { LiteralKitKeyCollisionError } from "@beep/schema/LiteralKit";
import { MappedLiteralDuplicateError, MappedLiteralKit } from "@beep/schema/MappedLiteralKit";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("MappedLiteralKit", () => {
  const SqlState = MappedLiteralKit([
    ["SUCCESSFUL_COMPLETION", "00000"],
    ["WARNING", "01000"],
  ] as const);

  it("decodes From literals into To literals", () => {
    expect(S.decodeSync(SqlState)("SUCCESSFUL_COMPLETION")).toBe("00000");
    expect(S.decodeSync(SqlState)("WARNING")).toBe("01000");
  });

  it("encodes To literals back into From literals", () => {
    expect(S.encodeSync(SqlState)("00000")).toBe("SUCCESSFUL_COMPLETION");
    expect(S.encodeSync(SqlState)("01000")).toBe("WARNING");
  });

  it("round-trips schema-derived mapped literal samples", () => {
    const arbitrary = S.toArbitrary(SqlState);
    const decode = S.decodeUnknownSync(SqlState);
    const encode = S.encodeSync(SqlState);

    fc.assert(
      fc.property(arbitrary, (literal) => {
        expect(SqlState.To.Options).toContain(literal);
        expect(decode(encode(literal))).toBe(literal);
      }),
      { numRuns: 25 }
    );
  });

  it("exposes directional enum maps", () => {
    expect(SqlState.From.Enum.SUCCESSFUL_COMPLETION).toBe("00000");
    expect(SqlState.From.Enum.WARNING).toBe("01000");
    expect(SqlState.To.Enum["00000"]).toBe("SUCCESSFUL_COMPLETION");
    expect(SqlState.To.Enum["01000"]).toBe("WARNING");
  });

  it("aliases top-level helper surface to From", () => {
    expect(SqlState.From).toBe(SqlState);
    expect(SqlState.Enum.SUCCESSFUL_COMPLETION).toBe("00000");
    expect(SqlState.Options).toEqual(["SUCCESSFUL_COMPLETION", "WARNING"]);
    expect(SqlState.is.SUCCESSFUL_COMPLETION("SUCCESSFUL_COMPLETION")).toBe(true);
    expect(SqlState.is.SUCCESSFUL_COMPLETION("WARNING")).toBe(false);
  });

  it("preserves the top-level From alias after annotation", () => {
    const annotated = SqlState.annotate({
      title: "Annotated SQL state",
    });
    const reannotated = annotated.annotate({
      description: "Re-annotated SQL state",
    });

    expect(annotated).not.toBe(SqlState);
    expect(annotated.From).toBe(annotated);
    expect(annotated.From).not.toBe(SqlState);
    expect(annotated.To).toBe(SqlState.To);
    expect(annotated.Enum.SUCCESSFUL_COMPLETION).toBe("00000");
    expect(S.decodeSync(annotated)("WARNING")).toBe("01000");

    expect(reannotated.From).toBe(reannotated);
    expect(reannotated.To).toBe(SqlState.To);
    expect(S.encodeSync(reannotated)("00000")).toBe("SUCCESSFUL_COMPLETION");
  });

  it("defines helper properties as readonly and non-configurable", () => {
    const fromDescriptor = Object.getOwnPropertyDescriptor(SqlState, "From");
    const toDescriptor = Object.getOwnPropertyDescriptor(SqlState, "To");
    const enumDescriptor = Object.getOwnPropertyDescriptor(SqlState, "Enum");

    expect(fromDescriptor?.enumerable).toBe(true);
    expect(fromDescriptor?.writable).toBe(false);
    expect(fromDescriptor?.configurable).toBe(false);
    expect(toDescriptor?.writable).toBe(false);
    expect(toDescriptor?.configurable).toBe(false);
    expect(enumDescriptor?.writable).toBe(false);
    expect(enumDescriptor?.configurable).toBe(false);
  });

  it("retains LiteralKit helper behavior on directional kits", () => {
    expect(SqlState.pickOptions(["WARNING"] as const)).toEqual(["WARNING"]);
    expect(SqlState.To.pickOptions(["01000"] as const)).toEqual(["01000"]);

    expect(SqlState.omitOptions(["WARNING"] as const)).toEqual(["SUCCESSFUL_COMPLETION"]);
    expect(SqlState.To.omitOptions(["01000"] as const)).toEqual(["00000"]);

    const fromMatch = SqlState.$match("SUCCESSFUL_COMPLETION", {
      SUCCESSFUL_COMPLETION: () => "ok" as const,
      WARNING: () => "warn" as const,
    });
    expect(fromMatch).toBe("ok");

    const toMatch = SqlState.To.$match("00000", {
      "00000": () => "ok-code" as const,
      "01000": () => "warn-code" as const,
    });
    expect(toMatch).toBe("ok-code");
  });

  it("decodes and encodes on the reverse directional kit", () => {
    expect(S.decodeSync(SqlState.To)("00000")).toBe("SUCCESSFUL_COMPLETION");
    expect(S.encodeSync(SqlState.To)("SUCCESSFUL_COMPLETION")).toBe("00000");
  });

  it("rejects duplicate from-side literals", () => {
    expect(() =>
      MappedLiteralKit([
        ["A", "00000"],
        ["A", "01000"],
      ] as const)
    ).toThrow(MappedLiteralDuplicateError);
  });

  it("rejects duplicate to-side literals", () => {
    expect(() =>
      MappedLiteralKit([
        ["A", "00000"],
        ["B", "00000"],
      ] as const)
    ).toThrow(MappedLiteralDuplicateError);
  });

  it("rejects from-side helper key collisions", () => {
    expect(() =>
      MappedLiteralKit([
        [true, "00000"],
        ["true", "01000"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);

    expect(() =>
      MappedLiteralKit([
        [1, "00000"],
        ["number1", "01000"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);

    expect(() =>
      MappedLiteralKit([
        [1n, "00000"],
        ["bigint1n", "01000"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);
  });

  it("rejects to-side helper key collisions", () => {
    expect(() =>
      MappedLiteralKit([
        ["A", true],
        ["B", "true"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);

    expect(() =>
      MappedLiteralKit([
        ["A", 1],
        ["B", "number1"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);

    expect(() =>
      MappedLiteralKit([
        ["A", 1n],
        ["B", "bigint1n"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);
  });
});
