import { LangExtractError } from "@beep/langextract/Extraction";
import { VerifiedSpanError } from "@beep/langextract/VerifiedSpan";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  first: Schema["Type"],
  second: Schema["Type"],
  different: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("@beep/langextract tagged-error declared equivalence", () => {
  it("compares extraction and verified-span failures by declared fields", () => {
    expectDeclaredEquivalence(
      LangExtractError,
      LangExtractError.fromReason("model-output-parse-failed", { message: "Could not parse output." }),
      LangExtractError.fromReason("model-output-parse-failed", { message: "Could not parse output." }),
      LangExtractError.fromReason("model-output-schema-invalid", { message: "Output schema was invalid." })
    );
    expectDeclaredEquivalence(
      VerifiedSpanError,
      VerifiedSpanError.fromReason("ambiguous"),
      VerifiedSpanError.fromReason("ambiguous"),
      VerifiedSpanError.fromReason("not-found")
    );
  });
});
