import { fcRuns } from "@beep/fc-runs";
import { KebabCaseStr, PascalCaseStr, SnakeCaseStr } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
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
      const failure1 = yield* Effect.exit(decodeUnknownKebabCaseStrEffect("1-command"));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be KebabCase format"
        );
      }
      const failure2 = yield* Effect.exit(decodeUnknownKebabCaseStrEffect("Command-Handler"));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be KebabCase format"
        );
      }
      const failure3 = yield* Effect.exit(decodeUnknownKebabCaseStrEffect("command_handler"));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be KebabCase format"
        );
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
      const failure4 = yield* Effect.exit(decodeUnknownPascalCaseStrEffect("workflowStatus"));
      pipe(failure4, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure4)) {
        expect(pipe(failure4.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be PascalCase format"
        );
      }
      const failure5 = yield* Effect.exit(decodeUnknownPascalCaseStrEffect("Workflow_Status"));
      pipe(failure5, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure5)) {
        expect(pipe(failure5.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be PascalCase format"
        );
      }
      const failure6 = yield* Effect.exit(decodeUnknownPascalCaseStrEffect("Workflow-Status"));
      pipe(failure6, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure6)) {
        expect(pipe(failure6.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be PascalCase format"
        );
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
      const failure7 = yield* Effect.exit(decodeUnknownSnakeCaseStrEffect("WorkflowStatus"));
      pipe(failure7, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure7)) {
        expect(pipe(failure7.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be SnakeCase format"
        );
      }
      const failure8 = yield* Effect.exit(decodeUnknownSnakeCaseStrEffect("workflow-status"));
      pipe(failure8, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure8)) {
        expect(pipe(failure8.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Must be SnakeCase format"
        );
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
