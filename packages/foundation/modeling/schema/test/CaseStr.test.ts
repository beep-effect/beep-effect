import { fcRuns } from "@beep/fc-runs";
import { KebabCaseStr, PascalCaseStr, SnakeCaseStr } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownKebabCaseStrEffect = S.decodeUnknownEffect(KebabCaseStr);
const decodeUnknownPascalCaseStrEffect = S.decodeUnknownEffect(PascalCaseStr);
const decodeUnknownSnakeCaseStrEffect = S.decodeUnknownEffect(SnakeCaseStr);

describe("KebabCaseStr", () => {
  const arbitrary = Arbitrary.schema(KebabCaseStr);

  it.effect(
    "accepts lowercase kebab-case values that start with a letter",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownKebabCaseStrEffect("command")).toBe("command");
      expect(yield* decodeUnknownKebabCaseStrEffect("command-handler")).toBe("command-handler");
      expect(yield* decodeUnknownKebabCaseStrEffect("command-handler-2")).toBe("command-handler-2");
    })
  );

  it.effect(
    "rejects digit-leading and non-kebab-case values",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownKebabCaseStrEffect("1-command"));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Must be KebabCase format");
      }
      const failure2 = yield* Effect.result(decodeUnknownKebabCaseStrEffect("Command-Handler"));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("Must be KebabCase format");
      }
      const failure3 = yield* Effect.result(decodeUnknownKebabCaseStrEffect("command_handler"));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain("Must be KebabCase format");
      }
    })
  );

  it.effect.prop(
    "derives valid values from the source schema and round-trips",
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      expect(yield* decodeUnknownKebabCaseStrEffect(value)).toBe(value);
      expect(value).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});

describe("PascalCaseStr", () => {
  const arbitrary = Arbitrary.schema(PascalCaseStr);

  it.effect(
    "accepts PascalCase values",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownPascalCaseStrEffect("WorkflowStatus")).toBe("WorkflowStatus");
      expect(yield* decodeUnknownPascalCaseStrEffect("URLParser")).toBe("URLParser");
      expect(yield* decodeUnknownPascalCaseStrEffect("A")).toBe("A");
    })
  );

  it.effect(
    "rejects lowercase-leading and separator-based values",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.result(decodeUnknownPascalCaseStrEffect("workflowStatus"));
      expect(Result.isFailure(failure4)).toBe(true);
      if (Result.isFailure(failure4)) {
        expect(failure4.failure.message).toContain("Must be PascalCase format");
      }
      const failure5 = yield* Effect.result(decodeUnknownPascalCaseStrEffect("Workflow_Status"));
      expect(Result.isFailure(failure5)).toBe(true);
      if (Result.isFailure(failure5)) {
        expect(failure5.failure.message).toContain("Must be PascalCase format");
      }
      const failure6 = yield* Effect.result(decodeUnknownPascalCaseStrEffect("Workflow-Status"));
      expect(Result.isFailure(failure6)).toBe(true);
      if (Result.isFailure(failure6)) {
        expect(failure6.failure.message).toContain("Must be PascalCase format");
      }
    })
  );

  it.effect.prop(
    "derives valid values from the source schema and round-trips",
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      expect(yield* decodeUnknownPascalCaseStrEffect(value)).toBe(value);
      expect(value).toMatch(/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});

describe("SnakeCaseStr", () => {
  const arbitrary = Arbitrary.schema(SnakeCaseStr);

  it.effect(
    "accepts lowercase snake_case values",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownSnakeCaseStrEffect("workflow_status")).toBe("workflow_status");
      expect(yield* decodeUnknownSnakeCaseStrEffect("workflow_status_2")).toBe("workflow_status_2");
    })
  );

  it.effect(
    "rejects uppercase and hyphenated values",
    Effect.fnUntraced(function* () {
      const failure7 = yield* Effect.result(decodeUnknownSnakeCaseStrEffect("WorkflowStatus"));
      expect(Result.isFailure(failure7)).toBe(true);
      if (Result.isFailure(failure7)) {
        expect(failure7.failure.message).toContain("Must be SnakeCase format");
      }
      const failure8 = yield* Effect.result(decodeUnknownSnakeCaseStrEffect("workflow-status"));
      expect(Result.isFailure(failure8)).toBe(true);
      if (Result.isFailure(failure8)) {
        expect(failure8.failure.message).toContain("Must be SnakeCase format");
      }
    })
  );

  it.effect.prop(
    "derives valid values from the source schema and round-trips",
    [arbitrary],
    Effect.fnUntraced(function* ([value]) {
      expect(yield* decodeUnknownSnakeCaseStrEffect(value)).toBe(value);
      expect(value).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});
