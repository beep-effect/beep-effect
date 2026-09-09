import { fcRuns } from "@beep/fc-runs";
import { LiteralKitKeyCollisionError } from "@beep/schema/LiteralKit";
import { MappedLiteralDuplicateError, MappedLiteralKit } from "@beep/schema/MappedLiteralKit";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const SqlState = MappedLiteralKit([
  ["SUCCESSFUL_COMPLETION", "00000"],
  ["WARNING", "01000"],
] as const);
const decodeSqlStateSync = S.decodeSync(SqlState);
const decodeSqlStateToSync = S.decodeSync(SqlState.To);
const decodeUnknownSqlStateSync = S.decodeUnknownSync(SqlState);
const encodeSqlStateSync = S.encodeSync(SqlState);
const encodeSqlStateToSync = S.encodeSync(SqlState.To);

describe("MappedLiteralKit", () => {
  it("decodes From literals into To literals", () => {
    expect(decodeSqlStateSync("SUCCESSFUL_COMPLETION")).toBe("00000");
    expect(decodeSqlStateSync("WARNING")).toBe("01000");
  });

  it("encodes To literals back into From literals", () => {
    expect(encodeSqlStateSync("00000")).toBe("SUCCESSFUL_COMPLETION");
    expect(encodeSqlStateSync("01000")).toBe("WARNING");
  });

  it("round-trips schema-derived mapped literal samples", () => {
    const arbitrary = Arbitrary.schema(SqlState);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([literal]) => {
            expect(SqlState.To.Options).toContain(literal);
            expect(decodeUnknownSqlStateSync(encodeSqlStateSync(literal))).toBe(literal);

            return true;
          },
          fcRuns(25)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
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
    expect(decodeSqlStateToSync("00000")).toBe("SUCCESSFUL_COMPLETION");
    expect(encodeSqlStateToSync("SUCCESSFUL_COMPLETION")).toBe("00000");
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
