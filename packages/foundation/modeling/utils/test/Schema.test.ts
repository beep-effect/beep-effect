import { compileAssertion } from "@beep/utils/Schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Cause from "effect/Cause";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

const assertString: <I>(input: I) => asserts input is I & string = compileAssertion(S.String);

const DefectSchema = S.declareConstructor<string>()([], () => () => Effect.die(new Error("assert defect")));
const assertDefect: <I>(input: I) => asserts input is I & string = compileAssertion(DefectSchema);

const captureError = (assertion: () => void): Error => {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("Expected assertion to throw an Error");
};

describe("compileAssertion", () => {
  it("returns normally and narrows valid input", () => {
    const input: unknown = "beep";
    assertString(input);
    expect(input.toUpperCase()).toBe("BEEP");
  });

  it("preserves the Schema.asserts validation error contract", () => {
    const error = captureError(() => assertString(1));

    expect(error.message).toBe("Schema validation failed");
    expect(SchemaIssue.isIssue(error.cause)).toBe(true);
  });

  it("preserves the Schema.asserts non-schema cause contract", () => {
    const error = captureError(() => assertDefect("beep"));

    expect(error.message).toBe("Assertion adapter can only throw schema issues");
    expect(Cause.isCause(error.cause) && Cause.hasDies(error.cause)).toBe(true);
  });
});
