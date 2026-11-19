/**
 * What a read found, and how serious it is: two nested tagged unions, the severity over the kind. Each kind carries
 * exactly its own fields. A kind that can be read past or stop a read (a stray quote, a ragged record) is one member
 * schema used in both unions; a kind that can only stop a read is only in the fatal union, so an impossible warning
 * cannot be built.
 *
 * @packageDocumentation
 */

import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CsvByteOffset, CsvIndex, CsvRecordEnd, CsvTextSpan } from "./CsvPosition.schema.ts";
import { CsvCell } from "./CsvTable.schema.ts";

const $I = $CsvId.create("CsvDiagnostic");

const at = CsvTextSpan.pipe(S.annotateKey({ description: "Where in the decoded text" }));
const record = CsvIndex.pipe(S.annotateKey({ description: "0-based record number, blank lines counted" }));
const field = CsvIndex.pipe(S.annotateKey({ description: "0-based field within the record" }));

/**
 * A quote opened a field and the input ended before it closed. Always fatal: the rest of the file would run into one
 * cell.
 *
 * @category models
 */
export class UnterminatedQuote extends S.Opaque<UnterminatedQuote, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("UnterminatedQuote"), at, record, field }).pipe(
    $I.annoteSchema("UnterminatedQuote", { description: "A quote opened a field and the input ended" })
  )
) {}

/**
 * A quote inside a field that did not start with one. Read past as text when quotes are lenient.
 *
 * @category models
 */
export class StrayQuote extends S.Opaque<StrayQuote, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("StrayQuote"), at, record, field }).pipe(
    $I.annoteSchema("StrayQuote", { description: "A quote inside a field that did not start with one" })
  )
) {}

/**
 * A closing quote followed by something other than a delimiter or a line break. When quotes are lenient the quote is
 * kept as text and the field stays quoted, as spreadsheet programs and papaparse read it.
 *
 * @category models
 */
export class TextAfterClosingQuote extends S.Opaque<TextAfterClosingQuote, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("TextAfterClosingQuote"), at, record, field }).pipe(
    $I.annoteSchema("TextAfterClosingQuote", {
      description: "A closing quote followed by something other than a delimiter or a line break",
    })
  )
) {}

/**
 * A record with more or fewer cells than the first record.
 *
 * @category models
 */
export class RaggedRecord extends S.Opaque<RaggedRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("RaggedRecord"),
    at,
    record,
    expected: CsvIndex.pipe(S.annotateKey({ description: "Cells in the first record" })),
    actual: CsvIndex.pipe(S.annotateKey({ description: "Cells in this record" })),
  }).pipe($I.annoteSchema("RaggedRecord", { description: "A record wider or narrower than the first" }))
) {}

/**
 * The file ends its records in more than one way (say CRLF, then a lone LF). Reported once, at the first change.
 *
 * @category models
 */
export class MixedTerminators extends S.Opaque<MixedTerminators, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("MixedTerminators"),
    at,
    first: CsvRecordEnd.pipe(S.annotateKey({ description: "How the first record ended" })),
    other: CsvRecordEnd.pipe(S.annotateKey({ description: "The first different ending" })),
  }).pipe($I.annoteSchema("MixedTerminators", { description: "Records end in more than one way" }))
) {}

/**
 * Bytes that are not UTF-8 where UTF-8 was fixed or already chosen.
 *
 * @category models
 */
export class InvalidUtf8 extends S.Opaque<InvalidUtf8, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("InvalidUtf8"),
    byteOffset: CsvByteOffset.pipe(S.annotateKey({ description: "The first invalid byte" })),
  }).pipe($I.annoteSchema("InvalidUtf8", { description: "Invalid UTF-8 where UTF-8 was chosen" }))
) {}

/**
 * A heading with no text, in the header view.
 *
 * @category models
 */
export class EmptyHeader extends S.Opaque<EmptyHeader, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("EmptyHeader"), field }).pipe(
    $I.annoteSchema("EmptyHeader", { description: "A heading with no text" })
  )
) {}

/**
 * A heading used twice, in the header view.
 *
 * @category models
 */
export class DuplicateHeader extends S.Opaque<DuplicateHeader, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("DuplicateHeader"),
    field,
    firstField: CsvIndex.pipe(S.annotateKey({ description: "Where the heading first appeared" })),
    name: CsvCell.pipe(S.annotateKey({ description: "The heading" })),
  }).pipe($I.annoteSchema("DuplicateHeader", { description: "A heading used twice" }))
) {}

/**
 * Which text cap a read ran into.
 *
 * @category schemas
 */
export const CsvTextLimit = LiteralKit(["records", "fieldsPerRecord", "fieldLength", "recordLength"]).pipe(
  $I.annoteSchema("CsvTextLimit", { description: "Which text cap a read ran into" })
);

/**
 * Runtime type of {@link CsvTextLimit}.
 *
 * @category models
 */
export type CsvTextLimit = typeof CsvTextLimit.Type;

/**
 * The text went past one of its caps. Always fatal: a cap keeps a hostile file in the typed channel.
 *
 * @category models
 */
export class LimitExceeded extends S.Opaque<LimitExceeded, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("LimitExceeded"),
    limit: CsvTextLimit.pipe(S.annotateKey({ description: "Which cap" })),
    maximum: CsvIndex.pipe(S.annotateKey({ description: "The cap's value" })),
    at,
  }).pipe($I.annoteSchema("LimitExceeded", { description: "The text went past one of its caps" }))
) {}

/**
 * The input had more bytes than its cap allows.
 *
 * @category models
 */
export class TooManyBytes extends S.Opaque<TooManyBytes, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("TooManyBytes"),
    maximum: S.ByteSize.pipe(S.annotateKey({ description: "The cap" })),
    actual: S.ByteSize.pipe(S.annotateKey({ description: "The input's size" })),
  }).pipe($I.annoteSchema("TooManyBytes", { description: "The input had more bytes than its cap" }))
) {}

/**
 * What a read can go past and still return its table.
 *
 * @category schemas
 */
export const CsvWarningFinding = LiteralKit(["StrayQuote", "TextAfterClosingQuote", "RaggedRecord", "MixedTerminators"])
  .mapMembers(() => Tuple.make(StrayQuote, TextAfterClosingQuote, RaggedRecord, MixedTerminators))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvWarningFinding", { description: "What a read can go past" }));

/**
 * Runtime type of {@link CsvWarningFinding}.
 *
 * @category models
 */
export type CsvWarningFinding = typeof CsvWarningFinding.Type;

/**
 * What stops a read.
 *
 * @category schemas
 */
export const CsvFatalFinding = LiteralKit([
  "UnterminatedQuote",
  "StrayQuote",
  "TextAfterClosingQuote",
  "RaggedRecord",
  "InvalidUtf8",
  "EmptyHeader",
  "DuplicateHeader",
  "LimitExceeded",
  "TooManyBytes",
])
  .mapMembers(() =>
    Tuple.make(
      UnterminatedQuote,
      StrayQuote,
      TextAfterClosingQuote,
      RaggedRecord,
      InvalidUtf8,
      EmptyHeader,
      DuplicateHeader,
      LimitExceeded,
      TooManyBytes
    )
  )
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvFatalFinding", { description: "What stops a read" }));

/**
 * Runtime type of {@link CsvFatalFinding}.
 *
 * @category models
 */
export type CsvFatalFinding = typeof CsvFatalFinding.Type;

/**
 * An oddity the read went past; the person is told.
 *
 * @category models
 */
export class CsvWarning extends S.Opaque<CsvWarning, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("warning"),
    finding: CsvWarningFinding.pipe(S.annotateKey({ description: "What was read past" })),
  }).pipe($I.annoteSchema("CsvWarning", { description: "An oddity the read went past" }))
) {}

/**
 * A problem that stopped the read.
 *
 * @category models
 */
export class CsvFatal extends S.Opaque<CsvFatal, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("fatal"),
    finding: CsvFatalFinding.pipe(S.annotateKey({ description: "What stopped the read" })),
  }).pipe($I.annoteSchema("CsvFatal", { description: "A problem that stopped the read" }))
) {}

/**
 * One finding and how serious it is.
 *
 * **Example** (Build and describe a warning)
 *
 * ```ts
 * import { CsvDiagnostic, StrayQuote, describeFinding } from "@beep/csv/CsvDiagnostic"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition"
 *
 * const finding = StrayQuote.make({ at: CsvTextSpan.locate('a,b"c', 3, 1), record: 0, field: 1 })
 * const warning = CsvDiagnostic.cases.warning.make({ finding })
 * describeFinding(warning.finding) // => 'a quote (") inside a field that did not start with one, at 1:4'
 * ```
 *
 * @category schemas
 */
export const CsvDiagnostic = LiteralKit(["warning", "fatal"])
  .mapMembers(() => Tuple.make(CsvWarning, CsvFatal))
  .pipe(S.toTaggedUnion("severity"), $I.annoteSchema("CsvDiagnostic", { description: "One finding and how serious" }));

/**
 * Runtime type of {@link CsvDiagnostic}.
 *
 * @category models
 */
export type CsvDiagnostic = typeof CsvDiagnostic.Type;

/**
 * The sentence a finding is described by, with 1-based positions.
 *
 * @category utilities
 */
export const describeFinding: (finding: CsvWarningFinding | CsvFatalFinding) => string = Match.type<
  CsvWarningFinding | CsvFatalFinding
>().pipe(
  Match.discriminatorsExhaustive("kind")({
    UnterminatedQuote: (f) =>
      `a quote (") opened at ${CsvTextSpan.render(f.at)} is never closed, so the rest of the file would run into one cell`,
    StrayQuote: (f) => `a quote (") inside a field that did not start with one, at ${CsvTextSpan.render(f.at)}`,
    TextAfterClosingQuote: (f) => `text after a closing quote (") at ${CsvTextSpan.render(f.at)}`,
    RaggedRecord: (f) =>
      `record ${f.record + 1} has ${f.actual} cells where the first has ${f.expected}, at ${CsvTextSpan.render(f.at)}`,
    MixedTerminators: (f) => `records end with ${f.first} and also with ${f.other}, from ${CsvTextSpan.render(f.at)}`,
    InvalidUtf8: (f) => `the bytes are not UTF-8 from byte ${f.byteOffset}`,
    EmptyHeader: (f) => `heading ${f.field + 1} is empty`,
    DuplicateHeader: (f) => `heading ${f.field + 1} repeats "${f.name}" from heading ${f.firstField + 1}`,
    LimitExceeded: (f) => `the ${f.limit} cap of ${f.maximum} was passed at ${CsvTextSpan.render(f.at)}`,
    TooManyBytes: (f) => `the input has ${f.actual} bytes, over the cap of ${f.maximum}`,
  })
);
