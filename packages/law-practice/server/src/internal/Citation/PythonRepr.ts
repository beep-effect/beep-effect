/** Builtin str repr adapted from CPython 3.11.15 Objects/unicodeobject.c.
 * PSF-2.0; see THIRD_PARTY_NOTICES.md. Native source points are never collapsed
 * through a JavaScript projection before escaping.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationInvocation } from "./Invocation.ts";
import { citationPythonPointAt, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/PythonRepr");
const Reason = LiteralKit(["invalid-policy", "invalid-table"]);
/** Closed construction failure without retaining table contents or nested causes.
 * @internal @category errors @since 0.0.0
 */
export class CitationPythonReprFailure extends S.TaggedError<
  CitationPythonReprFailure,
  { readonly brand: unique symbol }
>($I`CitationPythonReprFailure`)(
  "CitationPythonReprFailure",
  { reason: Reason },
  $I.annoteError<CitationPythonReprFailure>("CitationPythonReprFailure", {
    description: "Invalid frozen printability input or resource policy.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationPythonReprFailure.make({ reason });
const Point = S.Int.check(S.isBetween({ minimum: 0, maximum: 0x10ffff }));
const Range = S.Tuple([Point, Point]);
const Table = S.Struct({
  schemaVersion: S.tag("citation-python-printability/v1"),
  python: S.tag("3.11.15"),
  unicode: S.tag("14.0.0"),
  printableRanges: S.Array(Range).check(S.isBetweenLength(700, 700)),
}).pipe(S.fromJsonString);
const TableText = S.String.check(S.isMaxLength(32768));
const readTable = Effect.fn("Citation.readPythonReprTable")(function* (raw: unknown) {
  const text = yield* S.decodeUnknownEffect(TableText)(raw).pipe(Effect.mapError(() => fail("invalid-table")));
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));
  if (digest !== "7cadfc9b8203c031be8f1460ce19e4f10b1e5d04f65a5041a62ca6afd9cf0719")
    return yield* fail("invalid-table");
  const table = yield* S.decodeEffect(Table)(text).pipe(Effect.mapError(() => fail("invalid-table")));
  let previous = -2;
  for (const [start, end] of table.printableRanges) {
    if (end < start || start <= previous + 1) return yield* fail("invalid-table");
    previous = end;
  }
  return table.printableRanges;
});
const printable = (ranges: typeof Table.Type.printableRanges, point: number) => {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const [start, end] = A.getUnsafe(ranges, middle);
    if (point < start) high = middle - 1;
    else if (point > end) low = middle + 1;
    else return true;
  }
  return false;
};
const fragment = (point: number, quote: number, ranges: typeof Table.Type.printableRanges) => {
  if (point === quote || point === 92) return `\\${String.fromCodePoint(point)}`;
  if (point === 9) return "\\t";
  if (point === 10) return "\\n";
  if (point === 13) return "\\r";
  if (printable(ranges, point)) return String.fromCodePoint(point);
  const digits = point.toString(16);
  if (point < 256) return `\\x${Str.padStart(2, "0")(digits)}`;
  if (point < 65536) return `\\u${Str.padStart(4, "0")(digits)}`;
  return `\\U${Str.padStart(8, "0")(digits)}`;
};
const chooseQuote = Effect.fn("Citation.choosePythonReprQuote")(function* (source: CitationPythonUnicodeStorage) {
  let single = false;
  let double = false;
  const length = source.bytes.length / source.width;
  for (let i = 0; i < length; i++) {
    const point = citationPythonPointAt(source, i);
    single ||= point === 39;
    double ||= point === 34;
    if (i % 4096 === 4095) yield* Effect.yieldNow;
  }
  return single && !double ? 34 : 39;
});
const measureRepr = Effect.fn("Citation.measurePythonRepr")(function* (
  source: CitationPythonUnicodeStorage,
  quote: number,
  ranges: typeof Table.Type.printableRanges
) {
  let units = 2;
  for (let i = 0; i < source.bytes.length / source.width; i++) {
    units += Str.length(fragment(citationPythonPointAt(source, i), quote, ranges));
    if (i % 4096 === 4095) yield* Effect.yieldNow;
  }
  return units;
});
const assembleRepr = Effect.fn("Citation.assemblePythonRepr")(function* (
  source: CitationPythonUnicodeStorage,
  quote: number,
  ranges: typeof Table.Type.printableRanges
) {
  const parts = MutableList.make<string>();
  let part = String.fromCodePoint(quote);
  for (let i = 0; i < source.bytes.length / source.width; i++) {
    part += fragment(citationPythonPointAt(source, i), quote, ranges);
    if (Str.length(part) >= 1024) {
      MutableList.append(parts, part);
      part = "";
    }
    if (i % 4096 === 4095) yield* Effect.yieldNow;
  }
  MutableList.append(parts, part + String.fromCodePoint(quote));
  return A.join(MutableList.takeAll(parts), "");
});
/** Capture frozen printability, native Unicode, timing and optional shared budget.
 * text accepts owned native storage and returns complete canonical native repr.
 * Its environment is captured; subclass hooks and arbitrary object repr are separate.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPythonRepr = Effect.fn("Citation.makePythonRepr")(function* (policy: unknown, table: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const ranges = yield* readTable(table);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const unicode = yield* makeCitationPythonUnicode(limits, timing.operation);
  const text = Effect.fn("Citation.pythonStringRepr")(function* (input: unknown) {
    const budget = (yield* CitationInvocation).budget;
    const value = yield* unicode.fromStorageReserved(input, budget.reserve);
    const quote = yield* chooseQuote(value.storage);
    const units = yield* measureRepr(value.storage, quote, ranges);
    // Reserve retained chunks and the joined JS text before either allocation;
    // native output reserves its separate representation below.
    yield* budget.reserve(2 * units);
    const assembled = yield* assembleRepr(value.storage, quote, ranges);
    const output = yield* unicode.fromTextReserved(assembled, budget.reserve);
    return output.storage;
  }, timing.timed);
  const repr = (input: unknown) =>
    text(input).pipe(
      Effect.mapError((error) =>
        error._tag === "CitationPythonUnicodeFailure" && error.reason === "deadline-exceeded"
          ? CitationSafetyLimitExceeded.make({
              operation: timing.operation,
              limit: error.limit ?? timing.deadlineLimit,
            })
          : error
      )
    );
  return { text: repr };
});
