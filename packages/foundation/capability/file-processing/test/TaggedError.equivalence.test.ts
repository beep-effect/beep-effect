import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { PathSafetyError } from "@beep/file-processing/PathSafety";
import { SourceTextResolverError } from "@beep/file-processing/SourceText";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
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

describe("@beep/file-processing tagged-error declared equivalence", () => {
  it("compares operation errors by their sanitized fields", () => {
    expectDeclaredEquivalence(
      FileProcessingOperationError,
      FileProcessingOperationError.fromReason("engine-unavailable", { message: "Engine unavailable" }),
      FileProcessingOperationError.fromReason("engine-unavailable", { message: "Engine unavailable" }),
      FileProcessingOperationError.fromReason("operation-timed-out", { message: "Operation timed out" })
    );
  });

  it("ignores opaque causes in path-safety and source-text errors", () => {
    expectDeclaredEquivalence(
      PathSafetyError,
      PathSafetyError.make({
        candidate: "../secret",
        cause: O.some({ side: "left" }),
        message: "Path rejected",
        reason: "candidate-not-resolvable",
        resolved: O.none(),
        root: "/srv/data",
      }),
      PathSafetyError.make({
        candidate: "../secret",
        cause: O.some({ side: "right" }),
        message: "Path rejected",
        reason: "candidate-not-resolvable",
        resolved: O.none(),
        root: "/srv/data",
      }),
      PathSafetyError.make({
        candidate: "../other",
        cause: O.none(),
        message: "Path rejected",
        reason: "candidate-not-resolvable",
        resolved: O.none(),
        root: "/srv/data",
      })
    );
    expectDeclaredEquivalence(
      SourceTextResolverError,
      SourceTextResolverError.new("source-unavailable", "Source unavailable", { side: "left" }),
      SourceTextResolverError.new("source-unavailable", "Source unavailable", { side: "right" }),
      SourceTextResolverError.new("text-unavailable", "Text unavailable", { side: "left" })
    );
  });
});
