/**
 * Shared JSON codecs for the rule harnesses.
 *
 * Both the Biome (`harness.ts`) and oxlint (`oxlint-harness.ts`) harnesses write a JSON config
 * file and decode a JSON report through `effect/Schema` rather than `JSON.parse`/`JSON.stringify`.
 * The config encoder is identical across harnesses, and the report decoder differs only by the
 * report schema — both live here so neither harness re-implements the codec boilerplate.
 */
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/** Encode an arbitrary config object to a JSON string (for the throwaway lint config file). */
export const encodeConfig = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

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
export const jsonReportParser =
  <Report extends S.Top>(report: Report, fallback: Report["Type"]) =>
  (stdout: string): Effect.Effect<Report["Type"], never, Report["DecodingServices"]> =>
    S.decodeUnknownEffect(S.fromJsonString(report))(stdout).pipe(Effect.orElseSucceed(() => fallback));
