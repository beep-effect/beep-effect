/** Final built-in selection from eyecite 2.7.6 helpers.py, BSD-2-Clause.
 * Selection facts are internal borrowed model views, not semantic citations or verified anchors.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationOperationAdmission } from "./Admission.ts";
import { CitationGeneratedReference } from "./GeneratedReferences.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonPointAt, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { captureCitationTextReservation } from "./TextBudget.ts";
import type { CitationFullExtractionResult } from "./FullExtraction.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";
import type { CitationReferenceTokenResult } from "./ReferenceTokenExtraction.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractionSelection");
const Kind = LiteralKit([
  "FullCaseCitation",
  "FullLawCitation",
  "FullJournalCitation",
  "ShortCaseCitation",
  "IdCitation",
  "SupraCitation",
  "ReferenceCitation",
  "UnknownCitation",
]).pipe($I.annoteSchema("Kind", { description: "Original built-in families participating in final selection." }));
const Span = S.Tuple([S.Int, S.Int]).pipe(
  $I.annoteSchema("Span", {
    description: "Original half-open Python point span, preserving inverted and empty source-model overrides.",
  })
);
/** Borrowed model facts; ids address original objects in the enclosing extraction list.
 * @internal @category models @since 0.0.0
 */
export class CitationExtractionSelectionEntry extends S.Opaque<
  CitationExtractionSelectionEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: S.Natural,
    kind: Kind,
    span: Span,
    fullSpan: Span,
    matched: CitationPythonUnicodeStorage,
    parenthetical: S.NullOr(CitationPythonUnicodeStorage),
    hasEdition: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationExtractionSelectionEntry", {
      description:
        "Minimum original model observations for filtering; neither model copies nor caller-provided semantic citations.",
    })
  )
) {}
/** Original retained object ids and source-free warning pairs.
 * @internal @category models @since 0.0.0
 */
export class CitationExtractionSelectionResult extends S.Opaque<
  CitationExtractionSelectionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    selected: S.Array(S.Natural),
    disambiguated: S.Array(S.Natural),
    warnings: S.Array(S.Tuple([S.Natural, S.Natural])),
  }).pipe(
    $I.annoteSchema("CitationExtractionSelectionResult", {
      description:
        "Selection indices preserve original model identity and source order; warnings expose no source text.",
    })
  )
) {}
const Rows = S.Array(CitationExtractionSelectionEntry)
  .check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates))
  .pipe($I.annoteSchema("Rows", { description: "Absolute bounded original extraction-list projection." }));
const Reason = LiteralKit(["invalid-policy", "invalid-input", "duplicate-id"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed selection boundary failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationExtractionSelectionFailure extends S.TaggedError<
  CitationExtractionSelectionFailure,
  { readonly brand: unique symbol }
>($I`CitationExtractionSelectionFailure`)(
  "CitationExtractionSelectionFailure",
  { reason: Reason },
  $I.annoteError<CitationExtractionSelectionFailure>("CitationExtractionSelectionFailure", {
    description: "Final selection failed without source text or partial output.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationExtractionSelectionFailure.make({ reason });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const resource = (kind: typeof Kind.Type) =>
  kind === "FullCaseCitation" ||
  kind === "FullLawCitation" ||
  kind === "FullJournalCitation" ||
  kind === "ShortCaseCitation";
const spanOrder = Order.Tuple([Num.Order, Num.Order]);
const rowOrder = Order.mapInput(spanOrder, (row: CitationExtractionSelectionEntry) => row.fullSpan);
const overlap = (left: CitationExtractionSelectionEntry, right: CitationExtractionSelectionEntry) =>
  Num.max(left.fullSpan[0], right.fullSpan[0]) < Num.min(left.fullSpan[1], right.fullSpan[1]);
const fullPair = (left: CitationExtractionSelectionEntry, right: CitationExtractionSelectionEntry) =>
  left.kind === "FullCaseCitation" && right.kind === "FullCaseCitation";
const shortSupra = (left: CitationExtractionSelectionEntry, right: CitationExtractionSelectionEntry) =>
  left.kind === "ShortCaseCitation" && right.kind === "SupraCitation";
const isGeneratedReference = S.is(CitationGeneratedReference);
/** Project actual constructed models without copying their text or minting semantic identity.
 * @internal @category operations @since 0.0.0
 */
export const projectCitationExtractionSelection = Effect.fn("Citation.projectExtractionSelection")(function* (
  id: number,
  result: CitationFullExtractionResult | CitationReferenceTokenResult | CitationGeneratedReference
) {
  const data = result.token.data;
  if (data === null) return yield* fail("invalid-input");
  if (isGeneratedReference(result))
    return CitationExtractionSelectionEntry.make({
      id,
      kind: result._tag,
      span: Tuple.make(result.spanStart, result.spanEnd),
      fullSpan: Tuple.make(result.fullSpanStart, result.fullSpanEnd),
      matched: data,
      parenthetical: result.metadata.parenthetical,
      hasEdition: false,
    });
  const state = result.outcome;
  const spanEnd = "spanEnd" in state ? state.spanEnd : null;
  const span = Tuple.make(result.token.start, spanEnd ?? result.token.end);
  return CitationExtractionSelectionEntry.make({
    id,
    kind: state._tag,
    span,
    fullSpan: Tuple.make(state.fullSpanStart ?? span[0], state.fullSpanEnd ?? span[1]),
    matched: data,
    parenthetical: state.metadata.parenthetical,
    hasEdition: "editionGuess" in state && state.editionGuess !== null,
  });
});
/** Capture ordinary Effect admission, timing, Unicode ownership and shared text authority.
 * Native Python substring comparison is required for isolated-surrogate fidelity;
 * it yields and charges the captured comparison budget. No native process is started.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationExtractionSelection = Effect.fn("Citation.makeExtractionSelection")(function* (
  policy: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const admission = yield* CitationOperationAdmission;
  const unicode = yield* makeCitationPythonUnicode(limits);
  const reserveParent = yield* captureCitationTextReservation;
  const select = Effect.fn("Citation.selectExtractedCitations")(function* (raw: unknown) {
    if (!A.isArray(raw)) return yield* fail("invalid-input");
    if (raw.length > limits.candidates) return yield* safety("candidates");
    const rows = yield* S.decodeUnknownEffect(Rows)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
    if (HashSet.size(HashSet.fromIterable(A.map(rows, (row) => row.id))) !== rows.length)
      return yield* fail("duplicate-id");
    let used = 0;
    const reserve = Effect.fnUntraced(function* (units: number) {
      if (units > limits.producedTextUtf16 - used) return yield* safety("producedTextUtf16");
      yield* reserveParent(units);
      used += units;
    });
    const owned = yield* Effect.forEach(
      rows,
      Effect.fnUntraced(function* (row) {
        const matched = yield* unicode.fromStorageReserved(row.matched, reserve);
        const parenthetical =
          row.parenthetical === null ? null : yield* unicode.fromStorageReserved(row.parenthetical, reserve);
        return { row, matched, parenthetical };
      }),
      { concurrency: 1 }
    );
    let work = 0;
    const charge = Effect.suspend(() => {
      if (++work > limits.resolutionIterations) return Effect.fail(safety("resolutionIterations"));
      return work % 256 === 0 ? Effect.yieldNow : Effect.void;
    });
    const at = Effect.fnUntraced(function* (
      haystack: CitationPythonUnicodeValue,
      needle: CitationPythonUnicodeValue,
      start: number
    ) {
      for (let offset = 0; offset < needle.pythonLength; offset++) {
        yield* charge;
        if (citationPythonPointAt(haystack.storage, start + offset) !== citationPythonPointAt(needle.storage, offset))
          return false;
      }
      return true;
    });
    const contains = Effect.fnUntraced(function* (
      haystack: CitationPythonUnicodeValue,
      needle: CitationPythonUnicodeValue
    ) {
      for (let start = 0; start <= haystack.pythonLength - needle.pythonLength; start++) {
        yield* charge;
        if (yield* at(haystack, needle, start)) return true;
      }
      return false;
    });
    let values = HashMap.empty<string, { readonly first: number; readonly value: (typeof owned)[number] }>();
    for (const [position, value] of A.map(owned, (value, position) => Tuple.make(position, value))) {
      yield* charge;
      const key = `${value.row.span[0]},${value.row.span[1]}`;
      const first = O.match(HashMap.get(values, key), { onNone: () => position, onSome: (item) => item.first });
      values = HashMap.set(values, key, { first, value });
    }
    const byFirst = values.pipe(
      HashMap.values,
      A.fromIterable,
      A.sort(Order.mapInput(Num.Order, (item: { readonly first: number }) => item.first))
    );
    const sorted = pipe(
      A.map(byFirst, (item) => item.value),
      A.sort(Order.mapInput(rowOrder, (item: (typeof owned)[number]) => item.row))
    );
    type Owned = (typeof owned)[number];
    const decide = Effect.fnUntraced(function* (previous: Owned, current: Owned) {
      if (previous.row.kind === "ReferenceCitation") return "replace";
      if (current.row.kind === "ReferenceCitation" || shortSupra(previous.row, current.row)) return "skip";
      const inParenthetical =
        previous.parenthetical !== null &&
        previous.parenthetical.pythonLength > 0 &&
        (yield* contains(previous.parenthetical, current.matched));
      return !inParenthetical && !fullPair(previous.row, current.row) ? "warn" : "append";
    });
    const kept = A.empty<Owned>();
    const warnings = A.empty<readonly [number, number]>();
    yield* Effect.forEach(
      sorted,
      Effect.fnUntraced(function* (current) {
        yield* charge;
        const prior = A.last(kept);
        if (O.isSome(prior) && overlap(prior.value.row, current.row)) {
          const action = yield* decide(prior.value, current);
          if (action === "skip") return;
          if (action === "replace") kept.pop();
          if (action === "warn") warnings.push(Tuple.make(prior.value.row.id, current.row.id));
        }
        kept.push(current);
      }),
      { concurrency: 1, discard: true }
    );
    return CitationExtractionSelectionResult.make({
      selected: A.map(kept, (item) => item.row.id),
      disambiguated: A.map(
        A.filter(kept, (item) => !resource(item.row.kind) || item.row.hasEdition),
        (item) => item.row.id
      ),
      warnings,
    });
  });
  return {
    select: Effect.fn("Citation.filterExtraction")((raw: unknown) =>
      admission.run("extract", timing.timed(select(raw)))
    ),
  };
});
