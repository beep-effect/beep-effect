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
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { ShaclValidationReport, ValidationPolicy } from "../../../Domain/Schema/Shacl.ts";
const decodeShaclValidationReport = S.decodeEffect(ShaclValidationReport);
const decodeValidationPolicy = S.decodeEffect(ValidationPolicy);
const decodeShaclValidationReportResult = S.decodeResult(ShaclValidationReport);
const encodeShaclValidationResult = S.encodeEffect(ShaclValidationResult);

const path = Rdf.makeNamedNode("https://schema.org/name");
const sourceConstraintComponent = Rdf.makeNamedNode("https://www.w3.org/ns/shacl#MinCountConstraintComponent");

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
      const arbitrary = Arbitrary.schema(schema);
      expect(
        Effect.runSync(
          Arbitrary.checkEffect(
            Arbitrary.all([arbitrary]),
            ([value]) => {
          expect(S.is(schema)(value)).toBe(true);

              return true;
            },
            { runs: 32 }
          )
        )._tag
      ).toBe("Passed");
    }
  });

  it.effect(
    "wraps the canonical SHACL result with experiment execution metadata",
    Effect.fnUntraced(function* () {
      const emptyReport = decodeShaclValidationReportResult({
        validation: { conforms: true, violations: [], truncated: false },
        validatedAt: "2026-07-25T12:00:00.000Z",
        dataGraphTripleCount: 42,
        shapesGraphTripleCount: 8,
        durationMs: 12.5,
      });
      const validation = yield* encodeShaclValidationResult(
        ShaclValidationResult.make({ conforms: false, violations: [violation], truncated: false })
      );
      const reportWithResult = yield* decodeShaclValidationReport({
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

  it.effect(
    "applies schema defaults and keeps workflow policy separate from report conformance",
    Effect.fnUntraced(function* () {
      const defaults = yield* decodeValidationPolicy({});
      const strict = yield* decodeValidationPolicy({ failOnWarning: true });
      const logOnly = yield* decodeValidationPolicy({
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
    })
  );
});
