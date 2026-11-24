/**
 * Read codec for the office-action attempt log: the live v2 row, or a frozen v1 row converted on read.
 *
 * **Details**
 *
 * A v1 row stored each aligned extraction as `span` plus `matchedText`; a v2 row stores the same pair as one
 * `anchor`. The v1 reader below is frozen: it names only the two v1 extraction keys it converts, keeps every other
 * field as stored, and decodes the converted row through the live v2 schema, so the anchor width check refuses an
 * empty or inverted v1 span. It never encodes: the log is written as v2 only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { OfficeActionStructureAttempt } from "./OfficeActionStructure.ports.ts";

const $I = $LawPracticeUseCasesId.create("OfficeActionStructure/OfficeActionStructure.read");

const ExtractionV1 = S.StructWithRest(
  S.Struct({
    matchedText: S.optionalKey(S.String),
    span: S.optionalKey(S.Struct({ end: S.Natural, start: S.Natural })),
    alignmentStatus: S.String,
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("ExtractionV1", {
    description: "A grounded extraction as attempt v1 stored it: an aligned one carries span and matchedText.",
  })
);

const AttemptV1 = S.StructWithRest(S.Struct({ schemaVersion: S.tag("1"), extractions: S.Array(ExtractionV1) }), [
  S.Record(S.String, S.Unknown),
]).pipe(
  $I.annoteSchema("AttemptV1", {
    description: "An office-action attempt row as schema version 1 stored it.",
  })
);

const convertExtractionV1 = ({ matchedText, span, ...rest }: typeof ExtractionV1.Type) =>
  matchedText === undefined || span === undefined
    ? rest
    : { ...rest, anchor: { startChar: span.start, endChar: span.end, quote: matchedText } };

const convertV1 = (v1: typeof AttemptV1.Type) => ({
  ...v1,
  schemaVersion: "2",
  extractions: A.map(v1.extractions, convertExtractionV1),
});

const FromV1 = AttemptV1.pipe(
  S.decodeTo(S.toType(OfficeActionStructureAttempt), {
    decode: SchemaGetter.transformEffect((v1: typeof AttemptV1.Type) =>
      S.decodeUnknownEffect(OfficeActionStructureAttempt)(convertV1(v1)).pipe(Effect.mapError((error) => error.issue))
    ),
    encode: SchemaGetter.forbidden(() => "office-action attempt v1 is read only"),
  }),
  $I.annoteSchema("OfficeActionStructureAttemptFromV1", {
    description: "Read-only conversion of a v1 attempt row to its v2 form through the live v2 schema.",
  })
);

/**
 * Reads one attempt-log row: a v2 row as stored, or a v1 row converted to v2. Encoding always writes v2.
 *
 * **Details**
 *
 * The v1 reader is the first member. A v2 row never reaches it, since its `schemaVersion` is not `"1"`; an
 * encode reaches it first and is refused there, so every encode falls through to the v2 schema.
 *
 * **Example** (Read a v1 row as v2)
 *
 * ```ts
 * import { OfficeActionStructureAttemptRead } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as S from "effect/Schema"
 *
 * const read = S.decodeUnknownResult(OfficeActionStructureAttemptRead)
 * console.log(read({ schemaVersion: "1" })._tag) // "Failure"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OfficeActionStructureAttemptRead = S.Union([FromV1, OfficeActionStructureAttempt]).pipe(
  $I.annoteSchema("OfficeActionStructureAttemptRead", {
    description: "Attempt-log row reader: v2 as stored, v1 converted on read; v1 is never written.",
  })
);

/**
 * Decoded v2 attempt produced by the attempt-log reader.
 *
 * **Example** (Read the decoded version)
 *
 * ```ts
 * import type { OfficeActionStructureAttemptRead } from "@beep/law-practice-use-cases/OfficeActionStructure"
 *
 * const versionOf = (attempt: OfficeActionStructureAttemptRead) => attempt.schemaVersion
 * console.log(versionOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OfficeActionStructureAttemptRead = typeof OfficeActionStructureAttemptRead.Type;
