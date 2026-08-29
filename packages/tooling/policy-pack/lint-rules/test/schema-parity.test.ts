import { ImportBinding } from "@beep/lint-rules/oxlint";
import { fcRuns } from "@beep/test-utils";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";
import { BiomeReport } from "./harness.ts";
import { OxlintReport } from "./oxlint-harness.ts";

const ImportBindingArbitrary = S.toArbitrary(ImportBinding)(fc);
const BiomeReportArbitrary = S.toArbitrary(BiomeReport)(fc);
const OxlintReportArbitrary = S.toArbitrary(OxlintReport)(fc);

const decodeImportBinding = S.decodeUnknownSync(ImportBinding);
const encodeImportBinding = S.encodeSync(ImportBinding);
const decodeBiomeReport = S.decodeUnknownSync(BiomeReport);
const encodeBiomeReport = S.encodeSync(BiomeReport);
const decodeOxlintReport = S.decodeUnknownSync(OxlintReport);
const encodeOxlintReport = S.encodeSync(OxlintReport);

describe("crispened schema parity", () => {
  it("round-trips schema-derived import bindings", () => {
    fc.assert(
      fc.property(ImportBindingArbitrary, (binding) => {
        expect(decodeImportBinding(encodeImportBinding(binding))).toEqual(binding);
        expect(
          ImportBinding.match(binding, {
            named: ({ local }) => local,
            namespace: ({ local }) => local,
            default: ({ local }) => local,
          })
        ).toBe(binding.local);
      }),
      fcRuns(50)
    );
  });

  it("round-trips Biome reports with integer source coordinates", () => {
    fc.assert(
      fc.property(BiomeReportArbitrary, (report) => {
        expect(decodeBiomeReport(encodeBiomeReport(report))).toEqual(report);
        for (const diagnostic of report.diagnostics ?? []) {
          const start = diagnostic.location?.start;
          if (start?.line !== undefined) {
            expect(Number.isInteger(start.line)).toBe(true);
            expect(start.line).toBeGreaterThanOrEqual(1);
          }
          if (start?.column !== undefined) {
            expect(Number.isInteger(start.column)).toBe(true);
            expect(start.column).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      fcRuns(50)
    );
  });

  it("round-trips oxlint reports with integer source coordinates", () => {
    fc.assert(
      fc.property(OxlintReportArbitrary, (report) => {
        expect(decodeOxlintReport(encodeOxlintReport(report))).toEqual(report);
        for (const diagnostic of report.diagnostics ?? []) {
          for (const label of diagnostic.labels ?? []) {
            if (label.span?.line !== undefined) {
              expect(Number.isInteger(label.span.line)).toBe(true);
              expect(label.span.line).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }),
      fcRuns(50)
    );
  });
});
