/**
 * What a read found, and how serious it is: two nested tagged unions, the severity over the kind. Each kind carries
 * exactly its own fields. A kind that can be read past or stop a read (a stray quote, a ragged record) is one member
 * schema used in both unions; a kind that can only stop a read is only in the fatal union, so an impossible warning
 * cannot be built.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CsvByteOffset, CsvIndex, CsvRecordEnd, CsvTextSpan } from "./CsvPosition.schema.ts";
import { CsvCell } from "./CsvTable.schema.ts";

const $I = $CsvId.create("CsvDiagnostic");

const at = CsvTextSpan;
const record = CsvIndex.pipe(S.annotateKey({ description: "0-based record number, blank lines counted" }));
const field = CsvIndex.pipe(S.annotateKey({ description: "0-based field within the record" }));

/**
 * A quote opened a field and the input ended before it closed. Always fatal: the rest of the file would run into one
 * cell.
 *
 * **Example** (Describe a quote that never closes)
 *
 * ```ts import.meta.vitest name="Describe a quote that never closes"
 * import { describeFinding, UnterminatedQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = UnterminatedQuote.make({ at: CsvTextSpan.locate('a,"b\nc', 2, 1), record: 0, field: 1 })
 * describeFinding(finding) // => 'a quote (") opened at 1:3 is never closed, so the rest of the file would run into one cell'
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnterminatedQuote extends S.Opaque<UnterminatedQuote, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("UnterminatedQuote"), at, record, field }).pipe(
    $I.annoteSchema("UnterminatedQuote", { description: "A quote opened a field and the input ended" })
  )
) {}

/**
 * A quote inside a field that did not start with one. Read past as text when quotes are lenient.
 *
 * **Example** (Describe a stray quote)
 *
 * ```ts import.meta.vitest name="Describe a stray quote"
 * import { describeFinding, StrayQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = StrayQuote.make({ at: CsvTextSpan.locate('a,b"c', 3, 1), record: 0, field: 1 })
 * describeFinding(finding) // => 'a quote (") inside a field that did not start with one, at 1:4'
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Describe text after a closing quote)
 *
 * ```ts import.meta.vitest name="Describe text after a closing quote"
 * import { describeFinding, TextAfterClosingQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = TextAfterClosingQuote.make({ at: CsvTextSpan.locate('"12"in,bolt', 3, 1), record: 0, field: 0 })
 * describeFinding(finding) // => 'text after a closing quote (") at 1:4'
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Describe a short record)
 *
 * ```ts import.meta.vitest name="Describe a short record"
 * import { describeFinding, RaggedRecord } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const text = "SKU,Name\nBRK-040\n"
 * const finding = RaggedRecord.make({ at: CsvTextSpan.locate(text, 9, 7), record: 1, expected: 2, actual: 1 })
 * describeFinding(finding) // => "record 2 has 1 cells where the first has 2, at 2:1"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Describe mixed line endings)
 *
 * ```ts import.meta.vitest name="Describe mixed line endings"
 * import { describeFinding, MixedTerminators } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const text = "a\r\nb\nc"
 * const finding = MixedTerminators.make({ at: CsvTextSpan.locate(text, 4, 1), first: "CRLF", other: "LF" })
 * describeFinding(finding) // => "records end with CRLF and also with LF, from 2:2"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * The read went past more warnings than `CsvLimits.maxWarnings` keeps: it kept the first `kept` and only counted
 * the `dropped` ones after them. It is always the last warning, so a hostile file cannot fill memory with them.
 *
 * **Example** (Read a file with more oddities than the cap)
 *
 * ```ts import.meta.vitest name="Read a file with more oddities than the cap"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { describeFinding } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvLimits, CsvReadOptions } from "@beep/csv/CsvOptions.schema"
 * import { CsvRead } from "@beep/csv/CsvRead.schema"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const options = CsvReadOptions.make({ limits: CsvLimits.make({ maxWarnings: 2 }) })
 * const read = Result.getOrThrow(Csv.parseResult('a"\nb"\nc"\nd"\n', options))
 * const warnings = CsvRead.warnings(read)
 * warnings.length // => 3
 * O.map(A.last(warnings), (last) => describeFinding(last.finding)) // => O.some("2 more warnings were read past but not kept, beyond the cap of 2")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WarningsTruncated extends S.Opaque<WarningsTruncated, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("WarningsTruncated"),
    kept: CsvIndex.check(S.isGreaterThan(0)).pipe(S.annotateKey({ description: "How many warnings were kept" })),
    dropped: S.Int.check(S.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })).pipe(
      S.annotateKey({ description: "How many warnings after them were only counted" })
    ),
  }).pipe($I.annoteSchema("WarningsTruncated", { description: "More warnings than the cap keeps" }))
) {}

/**
 * Bytes that are not UTF-8 where UTF-8 was fixed or already chosen. It points at a byte, not a text span, because
 * the bytes could not be decoded into text.
 *
 * **Example** (Describe invalid UTF-8)
 *
 * ```ts import.meta.vitest name="Describe invalid UTF-8"
 * import { describeFinding, InvalidUtf8 } from "@beep/csv/CsvDiagnostic.schema"
 *
 * describeFinding(InvalidUtf8.make({ byteOffset: 7 })) // => "the bytes are not UTF-8 from byte 7"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Describe an empty heading)
 *
 * ```ts import.meta.vitest name="Describe an empty heading"
 * import { describeFinding, EmptyHeader } from "@beep/csv/CsvDiagnostic.schema"
 *
 * describeFinding(EmptyHeader.make({ field: 2 })) // => "heading 3 is empty"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmptyHeader extends S.Opaque<EmptyHeader, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("EmptyHeader"), field }).pipe(
    $I.annoteSchema("EmptyHeader", { description: "A heading with no text" })
  )
) {}

/**
 * A heading used twice, in the header view.
 *
 * **Example** (Describe a repeated heading)
 *
 * ```ts import.meta.vitest name="Describe a repeated heading"
 * import { describeFinding, DuplicateHeader } from "@beep/csv/CsvDiagnostic.schema"
 *
 * const finding = DuplicateHeader.make({ field: 2, firstField: 0, name: "SKU" })
 * describeFinding(finding) // => 'heading 3 repeats "SKU" from heading 1'
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * Which text cap a read ran into. The byte cap is not one of them: it has its own finding, {@link TooManyBytes}.
 *
 * **Example** (Name a text cap)
 *
 * ```ts import.meta.vitest name="Name a text cap"
 * import { CsvTextLimit } from "@beep/csv/CsvDiagnostic.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvTextLimit)("fieldLength") // => true
 * S.is(CsvTextLimit)("inputBytes") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvTextLimit = LiteralKit(["records", "fieldsPerRecord", "fieldLength", "recordLength"]).pipe(
  $I.annoteSchema("CsvTextLimit", { description: "Which text cap a read ran into" })
);

/**
 * One of the text caps named by {@link CsvTextLimit}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvTextLimit = typeof CsvTextLimit.Type;

/**
 * The text went past one of its caps. Always fatal: a cap keeps a hostile file in the typed channel.
 *
 * **Example** (Describe a passed cap)
 *
 * ```ts import.meta.vitest name="Describe a passed cap"
 * import { describeFinding, LimitExceeded } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = LimitExceeded.make({ limit: "fieldsPerRecord", maximum: 3, at: CsvTextSpan.locate("a,b,c,d", 6, 1) })
 * describeFinding(finding) // => "the fieldsPerRecord cap of 3 was passed at 1:7"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Describe oversized input)
 *
 * ```ts import.meta.vitest name="Describe oversized input"
 * import { describeFinding, TooManyBytes } from "@beep/csv/CsvDiagnostic.schema"
 * import * as ByteSize from "effect/ByteSize"
 *
 * const finding = TooManyBytes.make({ maximum: ByteSize.kibibytes(1), actual: ByteSize.bytes(1500) })
 * describeFinding(finding) // => "the input has 1500 bytes, over the cap of 1024"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Only some findings can be warnings)
 *
 * ```ts import.meta.vitest name="Only some findings can be warnings"
 * import { CsvWarningFinding, InvalidUtf8, StrayQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 * import * as S from "effect/Schema"
 *
 * const stray = StrayQuote.make({ at: CsvTextSpan.locate('a,b"c', 3, 1), record: 0, field: 1 })
 * S.is(CsvWarningFinding)(stray) // => true
 * S.is(CsvWarningFinding)(InvalidUtf8.make({ byteOffset: 7 })) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvWarningFinding = LiteralKit([
  "StrayQuote",
  "TextAfterClosingQuote",
  "RaggedRecord",
  "MixedTerminators",
  "WarningsTruncated",
])
  .mapMembers(() => Tuple.make(StrayQuote, TextAfterClosingQuote, RaggedRecord, MixedTerminators, WarningsTruncated))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvWarningFinding", { description: "What a read can go past" }));

/**
 * A finding a read can go past, discriminated by `kind`.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvWarningFinding = typeof CsvWarningFinding.Type;

/**
 * What stops a read: every finding kind except {@link MixedTerminators} and {@link WarningsTruncated}, which are only
 * ever warnings.
 *
 * **Example** (Mixed line endings never stop a read)
 *
 * ```ts import.meta.vitest name="Mixed line endings never stop a read"
 * import { CsvFatalFinding, InvalidUtf8, MixedTerminators } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 * import * as S from "effect/Schema"
 *
 * const mixed = MixedTerminators.make({ at: CsvTextSpan.locate("a\r\nb\nc", 4, 1), first: "CRLF", other: "LF" })
 * S.is(CsvFatalFinding)(mixed) // => false
 * S.is(CsvFatalFinding)(InvalidUtf8.make({ byteOffset: 7 })) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
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
 * A finding that stops a read, discriminated by `kind`.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvFatalFinding = typeof CsvFatalFinding.Type;

/**
 * An oddity the read went past; the person is told.
 *
 * **Example** (Wrap a finding as a warning)
 *
 * ```ts import.meta.vitest name="Wrap a finding as a warning"
 * import { CsvWarning, StrayQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = StrayQuote.make({ at: CsvTextSpan.locate('a,b"c', 3, 1), record: 0, field: 1 })
 * const warning = CsvWarning.make({ finding })
 * warning.severity // => "warning"
 * warning.finding.kind // => "StrayQuote"
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Wrap a finding as fatal)
 *
 * ```ts import.meta.vitest name="Wrap a finding as fatal"
 * import { CsvFatal, InvalidUtf8 } from "@beep/csv/CsvDiagnostic.schema"
 *
 * const fatal = CsvFatal.make({ finding: InvalidUtf8.make({ byteOffset: 7 }) })
 * fatal.severity // => "fatal"
 * fatal.finding.kind // => "InvalidUtf8"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvFatal extends S.Opaque<CsvFatal, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("fatal"),
    finding: CsvFatalFinding.pipe(S.annotateKey({ description: "What stopped the read" })),
  }).pipe($I.annoteSchema("CsvFatal", { description: "A problem that stopped the read" }))
) {}

/**
 * One finding and how serious it is, discriminated by `severity`.
 *
 * **Example** (Build and describe a warning)
 *
 * ```ts import.meta.vitest name="Build and describe a warning"
 * import { CsvDiagnostic, describeFinding, StrayQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = StrayQuote.make({ at: CsvTextSpan.locate('a,b"c', 3, 1), record: 0, field: 1 })
 * const warning = CsvDiagnostic.cases.warning.make({ finding })
 * CsvDiagnostic.guards.fatal(warning) // => false
 * describeFinding(warning.finding) // => 'a quote (") inside a field that did not start with one, at 1:4'
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvDiagnostic = LiteralKit(["warning", "fatal"])
  .mapMembers(() => Tuple.make(CsvWarning, CsvFatal))
  .pipe(S.toTaggedUnion("severity"), $I.annoteSchema("CsvDiagnostic", { description: "One finding and how serious" }));

/**
 * A {@link CsvWarning} or a {@link CsvFatal}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvDiagnostic = typeof CsvDiagnostic.Type;

/**
 * The sentence a finding is described by, with 1-based positions, for showing a person what a read found.
 *
 * **Details**
 *
 * Text positions render as `line:column` through `CsvTextSpan.render`; record and heading numbers are 1-based too,
 * and a byte offset is printed as stored.
 *
 * **Example** (Describe a ragged record)
 *
 * ```ts import.meta.vitest name="Describe a ragged record"
 * import { describeFinding, RaggedRecord } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const text = "SKU,Name\nBRK-040,Bracket,40mm\n"
 * const finding = RaggedRecord.make({ at: CsvTextSpan.locate(text, 9, 20), record: 1, expected: 2, actual: 3 })
 * describeFinding(finding) // => "record 2 has 3 cells where the first has 2, at 2:1"
 * ```
 *
 * @category formatting
 * @since 0.0.0
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
    WarningsTruncated: (f) => `${f.dropped} more warnings were read past but not kept, beyond the cap of ${f.kept}`,
    InvalidUtf8: (f) => `the bytes are not UTF-8 from byte ${f.byteOffset}`,
    EmptyHeader: (f) => `heading ${f.field + 1} is empty`,
    DuplicateHeader: (f) => `heading ${f.field + 1} repeats "${f.name}" from heading ${f.firstField + 1}`,
    LimitExceeded: (f) => `the ${f.limit} cap of ${f.maximum} was passed at ${CsvTextSpan.render(f.at)}`,
    TooManyBytes: (f) => `the input has ${f.actual} bytes, over the cap of ${f.maximum}`,
  })
);
