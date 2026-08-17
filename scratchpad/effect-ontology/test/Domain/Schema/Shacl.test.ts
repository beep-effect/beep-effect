import * as Rdf from "@beep/rdf/Rdf";
import {
  ShaclSeverity,
  ShaclValidationResult,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { ShaclValidationReport, ValidationPolicy } from "../../../Domain/Schema/Shacl.ts";

const path = Rdf.makeNamedNode("https://schema.org/name");
const sourceConstraintComponent = Rdf.makeNamedNode("http://www.w3.org/ns/shacl#MinCountConstraintComponent");

const violation = ShaclValidationViolation.make({
  focusNode: "https://example.com/alice",
  path,
  message: "Expected at least one value.",
  severity: "violation",
  sourceConstraintComponent: O.some(sourceConstraintComponent),
});

const warning = ShaclValidationViolation.make({
  focusNode: "https://example.com/alice",
  path,
  message: "A preferred label is recommended.",
  severity: "warning",
  sourceConstraintComponent: O.some(sourceConstraintComponent),
});

describe("effect-ontology SHACL schemas", () => {
  it("derives schema-valid values for every public SHACL schema", () => {
    const schemas: ReadonlyArray<S.Constraint> = [
      ShaclSeverity,
      ShaclValidationViolation,
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

  it.effect("wraps the canonical SHACL result with experiment execution metadata", () =>
    Effect.gen(function* () {
      const emptyReport = S.decodeResult(ShaclValidationReport)({
        validation: { conforms: true, violations: [], truncated: false },
        validatedAt: "2026-07-25T12:00:00.000Z",
        dataGraphTripleCount: 42,
        shapesGraphTripleCount: 8,
        durationMs: 12.5,
      });
      const validation = yield* S.encodeEffect(ShaclValidationResult)(
        ShaclValidationResult.make({ conforms: false, violations: [violation], truncated: false })
      );
      const reportWithResult = yield* S.decodeEffect(ShaclValidationReport)({
        validation,
        validatedAt: "2026-07-25T12:00:00.000Z",
        dataGraphTripleCount: 42,
        shapesGraphTripleCount: 8,
        durationMs: 12.5,
      });

      expect(Result.isSuccess(emptyReport)).toBe(true);
      expect(reportWithResult.validation.conforms).toBe(false);
      expect(reportWithResult.validation.violations).toEqual([violation]);
    })
  );

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
