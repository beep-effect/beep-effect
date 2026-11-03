/** Source-point alphabet for reviewed, backreference-free regex programs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexAlphabet");
const max = CitationEngineAbsoluteMaxima;
const Limits = S.toType(CitationEngineLimits);
const Point = S.Natural.check(S.isLessThanOrEqualTo(0x10ffff)).pipe(
  $I.annoteSchema("Point", {
    description: "A Python Unicode source point, including literal surrogate points.",
  })
);
const AtomIndex = S.Natural.check(S.isLessThan(max.patternUtf16)).pipe(
  $I.annoteSchema("AtomIndex", {
    description: "Index into a bounded reviewed atom descriptor table.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationRegexAtomInterval extends S.Opaque<CitationRegexAtomInterval, { readonly brand: unique symbol }>()(
  S.Struct({ atom: AtomIndex, start: Point, end: Point })
    .check(
      S.makeFilter(
        (row) => row.start <= row.end,
        $I.annote("IntervalOrder", { description: "Inclusive nonempty source interval." })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexAtomInterval", {
        description: "One interval of an already reviewed atomic predicate.",
      })
    )
) {}
/** The compiler must supply all atomic predicates, including word-boundary
 * classification and case-expanded sets. This descriptor grants no execution
 * authority and cannot represent identity-sensitive backreferences.
 * @internal @category models @since 0.0.0
 */
export class CitationRegexAtomSets extends S.Opaque<CitationRegexAtomSets, { readonly brand: unique symbol }>()(
  S.Struct({
    atoms: S.Int.check(S.isBetween({ minimum: 1, maximum: max.patternUtf16 })),
    intervals: S.Array(CitationRegexAtomInterval).check(S.isMaxLength(max.patternUtf16)),
  })
    .check(
      S.makeFilter(
        (value) => {
          let atom = -1;
          let end = -2;
          for (const row of value.intervals) {
            if (row.atom >= value.atoms || row.atom < atom || (row.atom === atom && row.start <= end + 1)) return false;
            atom = row.atom;
            end = row.end;
          }
          return true;
        },
        $I.annote("CanonicalAtomSets", {
          description: "Require bounded atom indices and sorted, disjoint maximal intervals for each atom.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexAtomSets", {
        description: "Flat bounded source predicates; empty atom sets need no interval rows.",
      })
    )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexAlphabetText extends S.Opaque<CitationRegexAlphabetText, { readonly brand: unique symbol }>()(
  S.Struct({
    flags: S.tag("dgu"),
    source: S.String.check(S.isMaxLength(max.producedTextUtf16)),
    atoms: S.Array(S.String.check(S.isMaxLength(max.patternUtf16))).check(S.isMaxLength(max.patternUtf16)),
    pythonLength: S.Natural.check(S.isLessThanOrEqualTo(max.producedTextUtf16)),
    cells: S.Int.check(S.isBetween({ minimum: 1, maximum: 2 * max.patternUtf16 + 1 })),
  })
    .check(
      S.makeFilter(
        (value) =>
          Str.length(value.source) === value.pythonLength &&
          A.reduce(value.atoms, 0, (units, text) => units + Str.length(text)) <= max.patternUtf16,
        $I.annote("OneUnitPerPoint", {
          description: "Every original Python point occupies exactly one encoded UTF-16 unit.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexAlphabetText", {
        description:
          "Encoded text and atomic classes for a reviewed regular program. Native captures remain source-point offsets.",
      })
    )
) {}
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
// With at most 8192 intervals there are at most 16385 cells. Starting at
// U+0100 avoids regex syntax and never reaches the surrogate range.
const symbol = (cell: number) => String.fromCodePoint(0x100 + cell);
const cellFor = (boundaries: ReadonlyArray<number>, point: number) => {
  let low = 0;
  let high = A.length(boundaries) - 1;
  while (low + 1 < high) {
    const middle = low + (high - low - ((high - low) % 2)) / 2;
    if (A.getUnsafe(boundaries, middle) <= point) low = middle;
    else high = middle;
  }
  return low;
};
const makeBoundaries = Effect.fn("Citation.partitionRegexAtoms")(function* (sets: CitationRegexAtomSets) {
  const endpoints = new Uint32Array(2 + 2 * A.length(sets.intervals));
  endpoints[0] = 0;
  endpoints[1] = 0x110000;
  for (let index = 0; index < A.length(sets.intervals); index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const row = A.getUnsafe(sets.intervals, index);
    endpoints[2 + index * 2] = row.start;
    endpoints[3 + index * 2] = row.end + 1;
  }
  return A.dedupeAdjacent(A.sort(A.fromIterable(endpoints), Order.Number));
});
const encodeAtoms = Effect.fn("Citation.encodeRegexAtoms")(function* (
  sets: CitationRegexAtomSets,
  boundaries: ReadonlyArray<number>,
  maximum: number
) {
  const atoms = A.empty<string>();
  let rowIndex = 0;
  let patternUnits = 0;
  for (let atom = 0; atom < sets.atoms; atom++) {
    yield* Effect.yieldNow;
    let body = "";
    while (rowIndex < A.length(sets.intervals) && A.getUnsafe(sets.intervals, rowIndex).atom === atom) {
      const row = A.getUnsafe(sets.intervals, rowIndex);
      const first = cellFor(boundaries, row.start);
      const last = cellFor(boundaries, row.end);
      const units = first === last ? 1 : 3;
      if (patternUnits + Str.length(body) + units + 2 > maximum) return yield* safety("patternUtf16");
      body += first === last ? symbol(first) : `${symbol(first)}-${symbol(last)}`;
      rowIndex++;
    }
    const text = Str.isEmpty(body) ? "(?!)" : `[${body}]`;
    if (patternUnits + Str.length(text) > maximum) return yield* safety("patternUtf16");
    patternUnits += Str.length(text);
    atoms.push(text);
  }
  return atoms;
});
const encodeSource = Effect.fn("Citation.encodeRegexAlphabetSource")(function* (
  value: CitationPythonUnicodeValue,
  boundaries: ReadonlyArray<number>
) {
  const native = value.storage;
  const view = new DataView(native.bytes.buffer, native.bytes.byteOffset, native.bytes.byteLength);
  const chunks = A.empty<string>();
  let chunk = "";
  for (let index = 0; index < value.pythonLength; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const offset = index * native.width;
    const point =
      native.width === 1
        ? view.getUint8(offset)
        : native.width === 2
          ? view.getUint16(offset, true)
          : view.getUint32(offset, true);
    chunk += symbol(cellFor(boundaries, point));
    if (Str.length(chunk) === 4096) {
      chunks.push(chunk);
      chunk = "";
    }
  }
  if (Str.isNonEmpty(chunk)) chunks.push(chunk);
  return A.join(chunks, "");
});

/** Capture policy/Clock. Classification is performed on native source words;
 * original display text is never fed to a native matcher. All character atoms
 * and assertions must be lowered by the future reviewed program compiler.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexAlphabet = Effect.fn("Citation.makeRegexAlphabet")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(
    Effect.mapError(() => CitationRegexWorkerFailure.make({ reason: "invalid-runtime" }))
  );
  const input = yield* makeCitationRegexInput(limits);
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.extractDeadline, limits.operationDeadline);
  const deadlineLimit = Duration.isLessThanOrEqualTo(limits.operationDeadline, limits.extractDeadline)
    ? "operationDeadline"
    : "extractDeadline";
  const prepare = Effect.fn("Citation.prepareRegexAlphabet")(
    function* (setsInput: unknown, sourceInput: unknown) {
      const borrowed = yield* S.decodeUnknownEffect(CitationRegexAtomSets, { onExcessProperty: "error" })(
        setsInput
      ).pipe(Effect.mapError(invalid));
      const sets = CitationRegexAtomSets.make({
        atoms: borrowed.atoms,
        intervals: A.map(borrowed.intervals, (row) =>
          CitationRegexAtomInterval.make({ atom: row.atom, start: row.start, end: row.end })
        ),
      });
      if (sets.atoms > limits.patternUtf16 || A.length(sets.intervals) > limits.patternUtf16)
        return yield* safety("patternUtf16");
      const boundaries = yield* makeBoundaries(sets);
      const atoms = yield* encodeAtoms(sets, boundaries, limits.patternUtf16);
      const prepared = yield* input.prepareUnicode(sourceInput, () => Effect.void);
      const source = yield* encodeSource(prepared.value, boundaries);
      return CitationRegexAlphabetText.make({
        source,
        atoms,
        pythonLength: prepared.value.pythonLength,
        cells: A.length(boundaries) - 1,
      });
    },
    (body) =>
      body.pipe(
        Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety(deadlineLimit)) }),
        Effect.provideService(Clock.Clock, clock)
      )
  );
  return { prepare };
});
