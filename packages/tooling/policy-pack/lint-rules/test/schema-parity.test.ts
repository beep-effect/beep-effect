import { ImportBinding } from "@beep/lint-rules/oxlint";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { JsonReportError, jsonReportParser } from "./codec.ts";
import { BiomeReport } from "./harness.ts";
import { OxlintReport } from "./oxlint-harness.ts";

const ImportBindingArbitrary = Arbitrary.schema(ImportBinding);
const BiomeReportArbitrary = Arbitrary.schema(BiomeReport);
const OxlintReportArbitrary = Arbitrary.schema(OxlintReport);

const decodeImportBinding = S.decodeUnknownEffect(ImportBinding);
const encodeImportBinding = S.encodeEffect(ImportBinding);
const decodeBiomeReport = S.decodeUnknownEffect(BiomeReport);
const encodeBiomeReport = S.encodeEffect(BiomeReport);
const decodeOxlintReport = S.decodeUnknownEffect(OxlintReport);
const encodeOxlintReport = S.encodeEffect(OxlintReport);

describe("crispened schema parity", () => {
  it.effect.prop(
    "round-trips schema-derived import bindings",
    [ImportBindingArbitrary],
    Effect.fnUntraced(function* ([binding]) {
      expect(yield* decodeImportBinding(yield* encodeImportBinding(binding))).toEqual(binding);
      expect(
        ImportBinding.match(binding, {
          named: ({ local }) => local,
          namespace: ({ local }) => local,
          default: ({ local }) => local,
        })
      ).toBe(binding.local);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "round-trips Biome reports with integer source coordinates",
    [BiomeReportArbitrary],
    Effect.fnUntraced(function* ([report]) {
      expect(yield* decodeBiomeReport(yield* encodeBiomeReport(report))).toEqual(report);
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
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "round-trips oxlint reports with integer source coordinates",
    [OxlintReportArbitrary],
    Effect.fnUntraced(function* ([report]) {
      expect(yield* decodeOxlintReport(yield* encodeOxlintReport(report))).toEqual(report);
      for (const diagnostic of report.diagnostics ?? []) {
        for (const label of diagnostic.labels ?? []) {
          if (label.span?.line !== undefined) {
            expect(Number.isInteger(label.span.line)).toBe(true);
            expect(label.span.line).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }),
    { arbitrary: fcRuns(50) }
  );
});

describe("subprocess report failures", () => {
  for (const report of [BiomeReport, OxlintReport]) {
    for (const stdout of ["not JSON", '{"diagnostics":"invalid"}']) {
      it.effect(`rejects malformed ${report === BiomeReport ? "Biome" : "oxlint"} output: ${stdout}`, () =>
        Effect.gen(function* () {
          const result = yield* Effect.result(jsonReportParser(report)(stdout));
          result.pipe(Result.isFailure, assertTrue);
          if (Result.isFailure(result)) {
            result.failure.pipe(S.is(JsonReportError), assertTrue);
            expect(result.failure.stdout).toBe(stdout);
            expect(result.failure.cause).toBeDefined();
          }
        })
      );
    }
    it.effect(`accepts an empty valid ${report === BiomeReport ? "Biome" : "oxlint"} report`, () =>
      Effect.gen(function* () {
        expect(yield* jsonReportParser(report)("{}")).toEqual({});
      })
    );
  }
});
