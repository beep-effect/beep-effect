import { describe, expect, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import {
  ShaclValidationReport,
  ShaclViolation,
  ShaclViolationSeverity,
  ValidationPolicy,
} from "../../../Domain/Schema/Shacl.ts";

const violation = ShaclViolation.cases.Violation.make({
  focusNode: "https://example.com/alice",
  message: "Expected at least one value.",
  sourceConstraintComponent: "http://www.w3.org/ns/shacl#MinCountConstraintComponent",
});

const warning = ShaclViolation.cases.Warning.make({
  focusNode: "https://example.com/alice",
  message: "A preferred label is recommended.",
  sourceConstraintComponent: "http://www.w3.org/ns/shacl#MinCountConstraintComponent",
});

describe("effect-ontology SHACL schemas", () => {
  it("derives schema-valid values for every public SHACL schema", () => {
    const schemas: ReadonlyArray<S.Constraint> = [
      ShaclViolationSeverity,
      ShaclViolation,
      ShaclValidationReport,
      ValidationPolicy,
    ];

    for (const schema of schemas) {
      const arbitrary = S.toArbitrary(schema)(fc);
      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 32 }
      );
    }
  });

  it("enforces SHACL conformance as an exact function of result emptiness", () => {
    const emptyReport = S.decodeUnknownResult(ShaclValidationReport)({
      conforms: true,
      validatedAt: "2026-07-25T12:00:00.000Z",
      dataGraphTripleCount: 42,
      shapesGraphTripleCount: 8,
      durationMs: 12.5,
    });
    const inconsistentReport = S.decodeUnknownResult(ShaclValidationReport)({
      conforms: true,
      violations: [violation],
      validatedAt: "2026-07-25T12:00:00.000Z",
      dataGraphTripleCount: 42,
      shapesGraphTripleCount: 8,
      durationMs: 12.5,
    });

    expect(Result.isSuccess(emptyReport)).toBe(true);
    expect(Result.isFailure(inconsistentReport)).toBe(true);
  });

  it("applies schema defaults and keeps workflow policy separate from report conformance", () => {
    const defaults = ValidationPolicy.fromUnknown({});
    const strict = ValidationPolicy.fromUnknown({ failOnWarning: true });
    const logOnly = ValidationPolicy.fromUnknown({
      failOnViolation: true,
      failOnWarning: true,
      logOnly: true,
    });

    expect(defaults).toEqual({
      failOnViolation: true,
      failOnWarning: false,
      logOnly: false,
    });
    expect(ValidationPolicy.shouldFail(defaults, [violation])).toBe(true);
    expect(ValidationPolicy.shouldFail(defaults, [warning])).toBe(false);
    expect(ValidationPolicy.shouldFail(strict, [warning])).toBe(true);
    expect(ValidationPolicy.shouldFail(logOnly, [violation, warning])).toBe(false);
  });
});
