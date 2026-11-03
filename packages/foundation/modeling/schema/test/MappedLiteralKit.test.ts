import { fcRuns } from "@beep/fc-runs";
import { LiteralKitEmptySubsetError, LiteralKitKeyCollisionError } from "@beep/schema/LiteralKit";
import { MappedLiteralDuplicateError, MappedLiteralKit } from "@beep/schema/MappedLiteralKit";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const SqlState = MappedLiteralKit([
  ["SUCCESSFUL_COMPLETION", "00000"],
  ["WARNING", "01000"],
] as const);
const decodeSqlStateEffect = S.decodeEffect(SqlState);
const decodeSqlStateToEffect = S.decodeEffect(SqlState.To);
const decodeUnknownSqlStateEffect = S.decodeUnknownEffect(SqlState);
const encodeSqlStateEffect = S.encodeEffect(SqlState);
const encodeSqlStateToEffect = S.encodeEffect(SqlState.To);
const notWarningCode = S.makeFilter((code: "00000" | "01000") => code !== "01000" || "warnings are rejected");
const CheckedSqlState = SqlState.check(notWarningCode);
const KeyAnnotatedSqlState = SqlState.annotateKey({ description: "SQL state key" });
const PipedSqlState = SqlState.pipe(S.check(notWarningCode), S.annotate({ title: "Successful SQL state" }));
const decodeCheckedSqlStateEffect = S.decodeEffect(CheckedSqlState);
const isPipedSqlState = S.is(PipedSqlState);
const CheckedSqlStateName = SqlState.To.check(S.makeFilter((name) => name !== "WARNING" || "warnings are rejected"));
const AnnotatedSqlStateName = SqlState.To.annotate({ title: "SQL state name" });
const isCheckedSqlStateName = S.is(CheckedSqlStateName);

describe("MappedLiteralKit", () => {
  it.effect(
    "decodes From literals into To literals",
    Effect.fnUntraced(function* () {
      const decodedSqlStateEffect = yield* decodeSqlStateEffect("SUCCESSFUL_COMPLETION");
      expect(decodedSqlStateEffect).toBe("00000");
      const decodedSqlStateEffect1 = yield* decodeSqlStateEffect("WARNING");
      expect(decodedSqlStateEffect1).toBe("01000");
    })
  );

  it.effect(
    "encodes To literals back into From literals",
    Effect.fnUntraced(function* () {
      const encodedSqlStateEffect = yield* encodeSqlStateEffect("00000");
      expect(encodedSqlStateEffect).toBe("SUCCESSFUL_COMPLETION");
      const encodedSqlStateEffect2 = yield* encodeSqlStateEffect("01000");
      expect(encodedSqlStateEffect2).toBe("WARNING");
    })
  );

  {
    const arbitrary = Arbitrary.schema(SqlState);
    it.effect.prop(
      "round-trips schema-derived mapped literal samples",
      [arbitrary],
      Effect.fnUntraced(function* ([literal]) {
        expect(A.map(SqlState.Pairs, ([, code]) => code)).toContain(literal);
        const encodedSqlStateEffect5 = yield* encodeSqlStateEffect(literal);
        const decodedUnknownSqlStateEffect = yield* decodeUnknownSqlStateEffect(encodedSqlStateEffect5);
        expect(decodedUnknownSqlStateEffect).toBe(literal);

        return true;
      }),
      { arbitrary: fcRuns(25) }
    );
  }

  it("exposes directional enum maps", () => {
    expect(SqlState.From.Enum.SUCCESSFUL_COMPLETION).toBe("00000");
    expect(SqlState.From.Enum.WARNING).toBe("01000");
    expect(SqlState.To.Enum["00000"]).toBe("SUCCESSFUL_COMPLETION");
    expect(SqlState.To.Enum["01000"]).toBe("WARNING");
  });

  it("aliases top-level helper surface to From", () => {
    expect(SqlState.From).toBe(SqlState);
    expect(SqlState.Enum.SUCCESSFUL_COMPLETION).toBe("00000");
    expect(SqlState.is.SUCCESSFUL_COMPLETION("SUCCESSFUL_COMPLETION")).toBe(true);
    expect(SqlState.is.SUCCESSFUL_COMPLETION("WARNING")).toBe(false);
  });

  it.effect(
    "preserves the top-level From alias after annotation",
    Effect.fnUntraced(function* () {
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
      const value = yield* S.decodeEffect(annotated)("WARNING");
      expect(value).toBe("01000");

      expect(reannotated.From).toBe(reannotated);
      expect(reannotated.To).toBe(SqlState.To);
      const value3 = yield* S.encodeEffect(reannotated)("00000");
      expect(value3).toBe("SUCCESSFUL_COMPLETION");
    })
  );

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

  it("no longer carries the retired facets on either direction", () => {
    for (const retired of ["Options", "pickOptions", "omitOptions"]) {
      expect(Reflect.has(SqlState, retired)).toBe(false);
      expect(Reflect.has(SqlState.To, retired)).toBe(false);
    }
  });

  it("retains LiteralKit helper behavior on directional kits", () => {
    const fromMatch = SqlState.match("SUCCESSFUL_COMPLETION", {
      SUCCESSFUL_COMPLETION: () => "ok" as const,
      WARNING: () => "warn" as const,
    });
    expect(fromMatch).toBe("ok");

    const toMatch = SqlState.To.match("00000", {
      "00000": () => "ok-code" as const,
      "01000": () => "warn-code" as const,
    });
    expect(toMatch).toBe("ok-code");
  });

  it.effect(
    "decodes and encodes on the reverse directional kit",
    Effect.fnUntraced(function* () {
      const decodedSqlStateToEffect = yield* decodeSqlStateToEffect("00000");
      expect(decodedSqlStateToEffect).toBe("SUCCESSFUL_COMPLETION");
      const encodedSqlStateToEffect = yield* encodeSqlStateToEffect("SUCCESSFUL_COMPLETION");
      expect(encodedSqlStateToEffect).toBe("00000");
    })
  );

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

  it("rejects from-side literals that derive the same helper key", () => {
    expect(() =>
      MappedLiteralKit([
        [1, "one"],
        ["number1", "also-one"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);
  });

  it("rejects to-side literals that derive the same helper key", () => {
    expect(() =>
      MappedLiteralKit([
        ["one", 1],
        ["also-one", "number1"],
      ] as const)
    ).toThrow(LiteralKitKeyCollisionError);
  });
});

describe("MappedLiteralKit statics across derivations", () => {
  it.effect(
    "keeps top-level and From statics through check, annotateKey and pipe(S.check(...))",
    Effect.fnUntraced(function* () {
      for (const derived of [CheckedSqlState, KeyAnnotatedSqlState, PipedSqlState]) {
        expect(derived).not.toBe(SqlState);
        expect(derived.From).toBe(derived);
        expect(derived.To).toBe(SqlState.To);
        expect(derived.Pairs).toBe(SqlState.Pairs);
        expect(derived.Enum).toBe(SqlState.Enum);
        expect(derived.is).toBe(SqlState.is);
        expect(derived.match).toBe(SqlState.match);
      }
      const decodedCheckedSqlStateEffect = yield* decodeCheckedSqlStateEffect("SUCCESSFUL_COMPLETION");
      expect(decodedCheckedSqlStateEffect).toBe("00000");
      expect(isPipedSqlState("01000")).toBe(false);
      expect(PipedSqlState.Enum.WARNING).toBe("01000");
    })
  );

  it("keeps To statics through check and annotate", () => {
    for (const derived of [CheckedSqlStateName, AnnotatedSqlStateName]) {
      expect(derived).not.toBe(SqlState.To);
      expect(derived.Enum).toBe(SqlState.To.Enum);
      expect(derived.is).toBe(SqlState.To.is);
      expect(derived.match).toBe(SqlState.To.match);
    }
    expect(CheckedSqlStateName.Enum["00000"]).toBe("SUCCESSFUL_COMPLETION");
    expect(isCheckedSqlStateName("WARNING")).toBe(false);
  });
});

describe("MappedLiteralKit subsets and matchOrElse", () => {
  const Code = MappedLiteralKit([
    ["OK", 200],
    ["CREATED", 201],
    ["NOT_FOUND", 404],
  ] as const);

  it.effect("pick keeps the pairs whose from-side literal was picked", () =>
    Effect.gen(function* () {
      const Success = Code.pick(["OK", "CREATED"]);
      deepStrictEqual(Success.Pairs, [
        ["OK", 200],
        ["CREATED", 201],
      ]);
      expect(Success.Enum.OK).toBe(200);
      const value4 = yield* S.decodeEffect(Success)("CREATED");
      expect(value4).toBe(201);
      expect(S.is(Success.To)(404)).toBe(false);
    })
  );

  it("omit reports dropping every pair as an empty-subset defect", () => {
    const everything = ["OK", "CREATED", "NOT_FOUND"] as unknown as readonly ["OK"];
    expect(() => Code.omit(everything)).toThrow(LiteralKitEmptySubsetError);
  });

  it("pick reports an empty selection as an empty-subset defect", () => {
    const nothing = [] as unknown as readonly ["OK"];
    expect(() => Code.pick(nothing)).toThrow(LiteralKitEmptySubsetError);
  });

  it("omit drops the pairs whose from-side literal was dropped", () => {
    const Failures = Code.omit(["OK", "CREATED"]);
    deepStrictEqual(Failures.Pairs, [["NOT_FOUND", 404]]);
    expect(Failures.To.Enum.number404).toBe("NOT_FOUND");
  });

  it("matchOrElse on a direction routes the remainder to the fallback", () => {
    expect(Code.matchOrElse("NOT_FOUND", { OK: () => "ok" }, (rest) => `other:${rest}`)).toBe("other:NOT_FOUND");
    expect(Code.To.matchOrElse(200, { number200: () => "ok" }, () => "other")).toBe("ok");
  });
});
