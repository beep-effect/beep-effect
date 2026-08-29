/**
 * Shared JSON codecs for the rule harnesses.
 *
 * Both the Biome (`harness.ts`) and oxlint (`oxlint-harness.ts`) harnesses write a JSON config
 * file and decode a JSON report through `effect/Schema` rather than `JSON.parse`/`JSON.stringify`.
 * The config encoder is identical across harnesses, and the report decoder differs only by the
 * report schema — both live here so neither harness re-implements the codec boilerplate.
 */
import { Unknown } from "@beep/schema/Unknown";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

/** Encode an arbitrary config object to a JSON string (for the throwaway lint config file). */
// unary by contract: `options` stays reachable through `S.encodeUnknownSync(...)`;
// a dual is undecidable here because `input` is `unknown`.
export const encodeConfig: (input: unknown) => string = Unknown.encodeUnknownSyncFromJsonString;

/**
 * Build a decoder that parses a subprocess's JSON `stdout` into `report`'s decoded type,
 * falling back to `fallback` when the output is not the expected JSON (tolerating non-JSON
 * noise). The fallback erases the decode error, so the returned Effect cannot fail.
 *
 * @param report - The report schema to decode the JSON string against.
 * @param fallback - The value to yield when decoding fails.
 * @returns A function from raw stdout to a never-failing decoded-report Effect.
 * @category utilities
 * @since 0.1.0
 */
// Named alias, not an inline `(stdout: string) => …`: `missingPipeableSignature`
// fires on an anonymous function return type even when a correct data-last
// overload exists. Naming it defers the comparison and satisfies the rule.
type ReportParser<Report extends S.Top> = (
  stdout: string
) => Effect.Effect<Report["Type"], never, Report["DecodingServices"]>;

export const jsonReportParser: {
  <Report extends S.Top>(fallback: Report["Type"]): (report: Report) => ReportParser<Report>;
  <Report extends S.Top>(report: Report, fallback: Report["Type"]): ReportParser<Report>;
} = dual(
  2,
  <Report extends S.Top>(report: Report, fallback: Report["Type"]): ReportParser<Report> =>
    (stdout) =>
      S.decodeEffect(S.fromJsonString(report))(stdout).pipe(Effect.orElseSucceed(() => fallback))
);
