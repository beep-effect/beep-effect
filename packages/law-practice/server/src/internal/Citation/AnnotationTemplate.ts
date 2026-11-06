/** Fixed one-capture replacement templates from CPython 3.11.15 re/_parser.py.
 * Python Software Foundation, PSF-2.0; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { captureCitationAnnotationReservation } from "./AnnotationBudget.ts";
import { parseCitationPythonInteger } from "./PythonInteger.ts";
import {
  citationPythonPointAt,
  concatCitationPythonRanges,
  makeCitationPythonUnicode,
  sliceCitationPythonStorage,
} from "./PythonUnicode.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationPythonSliceBounds } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/AnnotationTemplate");
/** @internal @category errors @since 0.0.0 */
export class CitationAnnotationTemplateFailure extends S.TaggedError<
  CitationAnnotationTemplateFailure,
  { readonly brand: unique symbol }
>($I`CitationAnnotationTemplateFailure`)(
  "CitationAnnotationTemplateFailure",
  {},
  $I.annoteError<CitationAnnotationTemplateFailure>("CitationAnnotationTemplateFailure", {
    description: "Invalid one-capture Python replacement template, without source text or parser diagnostics.",
  })
) {}
const Part = S.TaggedUnion({
  Literal: { start: S.Natural, end: S.Natural },
  Byte: { value: S.Int.check(S.isBetween({ minimum: 0, maximum: 255 })) },
  Group: { ordinal: S.Literals([0, 1]) },
}).pipe($I.annoteSchema("Part", { description: "Borrowed template literal, decoded byte or whole/tag capture." }));
/** @internal @category models @since 0.0.0 */
export class CitationAnnotationTemplate extends S.Opaque<
  CitationAnnotationTemplate,
  { readonly brand: unique symbol }
>()(
  S.Struct({ template: CitationPythonUnicodeStorage, parts: S.Array(Part), warnings: S.Natural }).pipe(
    $I.annoteSchema("CitationAnnotationTemplate", {
      description: "Owned fixed-capture replacement plan; no callable, source proof or execution authority.",
    })
  )
) {}
const invalid = () => CitationAnnotationTemplateFailure.make({});
const digit = (point: number) => point >= 48 && point <= 57;
const octal = (point: number) => point >= 48 && point <= 55;
const asciiLetter = (point: number) => (point >= 65 && point <= 90) || (point >= 97 && point <= 122);
const escapes: R.ReadonlyRecord<string, number> = {
  "97": 7,
  "98": 8,
  "102": 12,
  "110": 10,
  "114": 13,
  "116": 9,
  "118": 11,
  "92": 92,
};
const at = (source: CitationPythonUnicodeStorage, index: number) =>
  index < source.bytes.length / source.width ? citationPythonPointAt(source, index) : -1;
const canonicalGroupName = Effect.fn("Citation.canonicalTemplateGroupName")(function* (
  source: CitationPythonUnicodeStorage,
  start: number,
  end: number
) {
  if (start === end) return false;
  for (let i = start; i < end; i++) {
    if (i % 256 === 0) yield* Effect.yieldNow;
    if (!digit(at(source, i))) return false;
  }
  return true;
});
const reference = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([92, 49]) });
const decodedBytes = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(A.makeBy(256, (i) => i)) });
/** Compile the original rf"{before}\\1{after}" as one template, including
 * cross-boundary escape/digit interactions. Inputs are immutable native values.
 * This intentionally specializes CPython's parser to the helper's one group;
 * Effect String replacement has JavaScript semantics and cannot supply this law.
 * Captured allocation/Unicode capabilities leave returned methods R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationAnnotationTemplates = Effect.fn("Citation.makeAnnotationTemplates")(function* (
  limits: CitationEngineLimits
) {
  const unicode = yield* makeCitationPythonUnicode(limits, "annotate");
  const reserveUnits = yield* captureCitationAnnotationReservation;
  const reserve = (layout: { readonly utf16Units: number }) => reserveUnits(layout.utf16Units);
  const groupName = Effect.fn("Citation.annotationTemplateGroupName")(function* (
    template: CitationPythonUnicodeStorage,
    start: number,
    end: number
  ) {
    const storage = yield* sliceCitationPythonStorage(template, start, end, reserve);
    const value = yield* unicode.fromStorageReserved(storage, reserveUnits).pipe(
      Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
        Effect.fail(
          error.reason === "invalid-input"
            ? invalid()
            : CitationSafetyLimitExceeded.make({
                operation: "annotate",
                limit: error.reason === "deadline-exceeded" ? "annotateDeadline" : "producedTextUtf16",
              })
        )
      )
    );
    const number = yield* parseCitationPythonInteger(value);
    if (O.isNone(number) || number.value < BigInt(0) || number.value >= BigInt(1073741823)) return yield* invalid();
    const canonical = yield* canonicalGroupName(template, start, end);
    if (!canonical)
      yield* Effect.logWarning("Noncanonical annotation template group reference").pipe(
        Effect.annotateLogs({ operation: "annotate", sourceCategory: "DeprecationWarning" })
      );
    if (number.value > BigInt(1)) return yield* invalid();
    return {
      part: Part.cases.Group.make({ ordinal: number.value === BigInt(0) ? 0 : 1 }),
      warnings: canonical ? 0 : 1,
    };
  });
  const scanNamedGroup = Effect.fn("Citation.scanTemplateNamedGroup")(function* (
    template: CitationPythonUnicodeStorage,
    start: number
  ) {
    if (at(template, start + 2) !== 60) return yield* invalid();
    let end = start + 3;
    const size = template.bytes.length / template.width;
    while (end < size && at(template, end) !== 62) {
      if (end % 256 === 0) yield* Effect.yieldNow;
      end++;
    }
    if (end === size) return yield* invalid();
    const group = yield* groupName(template, start + 3, end);
    return { end: end + 1, ...group };
  });
  const scanZero = (template: CitationPythonUnicodeStorage, start: number) => {
    let end = start + 2;
    let value = 0;
    for (let count = 0; count < 2 && octal(at(template, end)); count++) value = value * 8 + at(template, end++) - 48;
    return { end, part: Part.cases.Byte.make({ value }), warnings: 0 };
  };
  const groupReference = Effect.fn("Citation.templateGroupReference")(function* (value: number, end: number) {
    if (value > 1) return yield* invalid();
    return { end, part: Part.cases.Group.make({ ordinal: value === 0 ? 0 : 1 }), warnings: 0 };
  });
  const tripleOctal = Effect.fn("Citation.templateTripleOctal")(function* (
    first: number,
    second: number,
    third: number,
    end: number
  ) {
    const value = (first - 48) * 64 + (second - 48) * 8 + third - 48;
    if (value > 255) return yield* invalid();
    return { end, part: Part.cases.Byte.make({ value }), warnings: 0 };
  });
  const scanDigits = Effect.fn("Citation.scanTemplateNumericEscape")(function* (
    template: CitationPythonUnicodeStorage,
    start: number
  ) {
    const first = at(template, start + 1);
    const second = at(template, start + 2);
    if (!digit(second)) return yield* groupReference(first - 48, start + 2);
    const third = at(template, start + 3);
    if (octal(first) && octal(second) && octal(third)) return yield* tripleOctal(first, second, third, start + 4);
    return yield* groupReference((first - 48) * 10 + second - 48, start + 3);
  });
  const scanEscape = Effect.fn("Citation.scanAnnotationTemplateEscape")(function* (
    template: CitationPythonUnicodeStorage,
    start: number
  ) {
    const code = at(template, start + 1);
    if (code < 0) return yield* invalid();
    if (code === 103) return yield* scanNamedGroup(template, start);
    if (code === 48) return scanZero(template, start);
    if (digit(code)) return yield* scanDigits(template, start);
    const escaped = R.get(escapes, `${code}`);
    if (O.isSome(escaped)) return { end: start + 2, part: Part.cases.Byte.make({ value: escaped.value }), warnings: 0 };
    if (asciiLetter(code)) return yield* invalid();
    return { end: start + 2, part: Part.cases.Literal.make({ start, end: start + 2 }), warnings: 0 };
  });
  const compile = Effect.fn("Citation.compileAnnotationTemplate")(function* (
    before: CitationPythonUnicodeStorage,
    after: CitationPythonUnicodeStorage
  ) {
    const template = yield* concatCitationPythonRanges(
      A.map([before, reference, after], (source) => ({ source, start: 0, end: source.bytes.length / source.width })),
      reserve
    );
    const size = template.bytes.length / template.width;
    const parts = MutableList.make<typeof Part.Type>();
    let warnings = 0;
    let cursor = 0;
    let literalStart = 0;
    const flush = (end: number) => {
      if (literalStart < end) MutableList.append(parts, Part.cases.Literal.make({ start: literalStart, end }));
    };
    while (cursor < size) {
      if (cursor % 256 === 0) yield* Effect.yieldNow;
      if (at(template, cursor) !== 92) {
        cursor++;
        continue;
      }
      flush(cursor);
      const escaped = yield* scanEscape(template, cursor);
      MutableList.append(parts, escaped.part);
      warnings += escaped.warnings;
      cursor = escaped.end;
      literalStart = cursor;
    }
    flush(size);
    return CitationAnnotationTemplate.make({ template, parts: MutableList.toArray(parts), warnings });
  });
  const substitute = Effect.fn("Citation.substituteAnnotationTemplate")(function* (
    plan: CitationAnnotationTemplate,
    source: CitationPythonUnicodeStorage,
    matches: ReadonlyArray<CitationPythonSliceBounds>
  ) {
    if (A.isReadonlyArrayEmpty(matches)) return source;
    const ranges = MutableList.make<{
      readonly source: CitationPythonUnicodeStorage;
      readonly start: number;
      readonly end: number;
    }>();
    let cursor = 0;
    const size = source.bytes.length / source.width;
    for (const match of matches) {
      if (match.start < cursor || match.end <= match.start || match.end > size) return yield* invalid();
      MutableList.append(ranges, { source, start: cursor, end: match.start });
      for (const part of plan.parts) {
        yield* Effect.yieldNow;
        MutableList.append(
          ranges,
          Part.match(part, {
            Literal: (literal) => ({ source: plan.template, start: literal.start, end: literal.end }),
            Byte: (byte) => ({ source: decodedBytes, start: byte.value, end: byte.value + 1 }),
            Group: () => ({ source, start: match.start, end: match.end }),
          })
        );
      }
      cursor = match.end;
    }
    MutableList.append(ranges, { source, start: cursor, end: size });
    return yield* concatCitationPythonRanges(MutableList.toArray(ranges), reserve);
  });
  return { compile, substitute };
});
