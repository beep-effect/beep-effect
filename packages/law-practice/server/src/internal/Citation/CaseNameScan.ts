/** Initialized _scan_for_case_boundaries from eyecite 2.7.6 helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationCaseNamePredicates } from "./CaseNamePredicates.ts";
import { copyCitationMetadataPatternConfiguration, makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonPointAt, concatCitationPythonRanges } from "./PythonUnicode.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import { CitationTokenContextInput } from "./TokenContext.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CaseNameScan");
const max = CitationEngineAbsoluteMaxima;
const Pattern = CitationPythonUnicodeStorage;
const Patterns = S.Struct({
  year: Pattern,
  connectorSpace: Pattern,
  capitalized: Pattern,
  connectorBoundary: Pattern,
  trailingDigits: Pattern,
});
const fingerprints = {
  year: "978000753938d72355c1a2fa4ebec39b3a32f4f249bf0bf0b1d794826855dbef",
  connectorSpace: "de093480fe409e8d1eb38f7c9a43b7d060f5342e2a47e22bb5ca7dbc44ca792a",
  capitalized: "b0a04e0f017aa32176e2db14e927c088d6f0a38683b111b52e1bfa405ed99993",
  connectorBoundary: "f77b49ff6f79c7fd080caba7f097ce7f106d00a1d7ccf5cf3af12a2bc2fcde0a",
  trailingDigits: "403be117600eda19727f1a965ac0df553ea9f8392a4b5862c173bdd53e88a9dc",
};
type PatternName = keyof typeof fingerprints;
const Reason = LiteralKit([
  "invalid-input",
  "invalid-configuration",
  "index-out-of-range",
  "invalid-token-length",
  "missing-stop-word",
  "missing-capture",
  "empty-word",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed initialized case-name scan failures without source values or state.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationCaseNameScanFailure extends S.TaggedError<
  CitationCaseNameScanFailure,
  { readonly brand: unique symbol }
>($I`CitationCaseNameScanFailure`)(
  "CitationCaseNameScanFailure",
  { reason: Reason },
  $I.annoteError<CitationCaseNameScanFailure>("CitationCaseNameScanFailure", {
    description: "Boundary scan failed without partial source state or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationCaseNameScanFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameScanConfiguration extends S.Opaque<
  CitationCaseNameScanConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patterns: Patterns,
    bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(5, 5)),
  }).pipe(
    $I.annoteSchema("CitationCaseNameScanConfiguration", {
      description: "Private fixed source patterns and independent parser descriptors, never raw request fields.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameScanInput extends S.Opaque<CitationCaseNameScanInput, { readonly brand: unique symbol }>()(
  S.Struct({
    words: S.Array(
      S.Struct({ ...CitationTokenContextInput.fields.words.value.fields, groups: CitationTokenSeed.fields.groups })
    ).check(S.isMaxLength(max.tokens)),
    index: S.Int.check(S.isBetween({ minimum: -max.tokens, maximum: max.tokens + 1 })),
  }).pipe(
    $I.annoteSchema("CitationCaseNameScanInput", {
      description: "Built-in native words and source citation index before default search-state initialization.",
    })
  )
) {}
const Index = S.Int.check(S.isBetween({ minimum: -max.tokens - 2, maximum: max.tokens + 2 }));
/** Complete source state; word slots retain the chosen v token's location.
 * Negative slice starts, empty candidate strings and None remain distinct.
 * @internal @category models @since 0.0.0
 */
export class CitationCaseNameScanState extends S.Opaque<CitationCaseNameScanState, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Natural.check(S.isLessThanOrEqualTo(max.producedTextUtf16)),
    vTokenIndex: S.NullOr(Index),
    startIndex: S.NullOr(Index),
    titleStartingIndex: Index,
    candidateCaseName: S.NullOr(CitationPythonUnicodeStorage),
    preCiteYear: S.NullOr(CitationPythonUnicodeStorage),
    caseNameLength: S.Natural.check(S.isLessThanOrEqualTo(27)),
    plaintiffLength: S.Natural.check(S.isLessThanOrEqualTo(27)),
  }).pipe(
    $I.annoteSchema("CitationCaseNameScanState", {
      description:
        "Default-initialized backward scan state, without verified mention spans or source object protocols.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameScanResult extends S.Opaque<
  CitationCaseNameScanResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    state: CitationCaseNameScanState,
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(max.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationCaseNameScanResult", {
      description: "Atomic initialized boundary-scan result and invocation-owned allocation count.",
    })
  )
) {}
const Input = S.toType(CitationCaseNameScanInput);
const Config = S.toType(CitationCaseNameScanConfiguration);
const Step = LiteralKit(["next", "continue", "stop"]);
const bound = (index: number, length: number) => Num.max(0, Num.min(length, index < 0 ? length + index : index));
const runScan = Effect.fn("Citation.runCaseNameScan")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationCaseNameScanConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  if (request.words.length > limits.tokens)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
  const input = yield* makeCitationRegexInput(limits);
  const budget = yield* CitationTextBudget;
  const predicates = yield* makeCitationCaseNamePredicates();
  const words = yield* Effect.forEach(
    request.words,
    Effect.fn("Citation.ownCaseNameWord")(function* (word) {
      const source = yield* word.data === null
        ? input.prepareText("None", () => Effect.void)
        : input.prepareUnicode(word.data, () => Effect.void);
      const stop = R.get(word.groups, "stop_word");
      const stopWord = yield* O.isSome(stop) && stop.value !== null
        ? input
            .prepareUnicode(stop.value, () => Effect.void)
            .pipe(Effect.map((prepared) => O.some(prepared.value.text)))
        : Effect.succeed(O.map(stop, () => null));
      return { ...word, source, stopWord };
    })
  );
  const state = yield* Ref.make(
    CitationCaseNameScanState.make({
      offset: 0,
      vTokenIndex: null,
      startIndex: null,
      candidateCaseName: null,
      preCiteYear: null,
      titleStartingIndex: request.index - 1,
      caseNameLength: 0,
      plaintiffLength: 0,
    })
  );
  const worker = yield* makeCitationRegexWorker(limits, runtime, config.bindings, "python-regex-v0");
  const update = (patch: Partial<CitationCaseNameScanState>) =>
    Ref.update(state, (current) => CitationCaseNameScanState.make({ ...current, ...patch }));
  const join = Effect.fn("Citation.extractCaseNameText")(function* (start: number, end: number) {
    const first = bound(start, words.length);
    const last = bound(end, words.length);
    const selected = A.take(A.drop(words, first), Num.max(0, last - first));
    return yield* concatCitationPythonRanges(
      A.map(selected, (word) => ({ source: word.source.value.storage, start: 0, end: word.source.value.pythonLength })),
      (layout) => budget.reserve(layout.utf16Units)
    );
  });
  const match = Effect.fn("Citation.matchCaseNamePattern")(function* (
    name: PatternName,
    source: CitationPythonUnicodeStorage
  ) {
    const evaluated = yield* worker.evaluate(
      config.patterns[name],
      source,
      name === "connectorBoundary" ? 2 : 0,
      1,
      name === "year" ? "match" : "search"
    );
    if (evaluated.result.matches === 0) return O.none();
    const span = yield* evaluated.result.capture(0, 0);
    if (span._tag === "Unmatched") return yield* fail("missing-capture");
    return O.some({ source: evaluated.source, span });
  });
  const removePrefix = Effect.fn("Citation.removeCaseNamePrefix")(function* (
    name: "connectorSpace" | "connectorBoundary",
    source: CitationPythonUnicodeStorage
  ) {
    const matched = yield* match(name, source);
    return O.isNone(matched)
      ? source
      : yield* matched.value.source.slice(
          { start: matched.value.span.end, end: matched.value.source.value.pythonLength },
          () => Effect.void
        );
  });
  const extract = Effect.fn("Citation.setCaseNameCandidate")(function* (start: number) {
    const current = yield* Ref.get(state);
    const candidateCaseName = yield* join(start, current.titleStartingIndex);
    yield* update({ startIndex: start, candidateCaseName });
    return candidateCaseName;
  });
  const accumulate = Effect.fn("Citation.accumulateCaseNameWord")(function* (index: number) {
    const word = A.getUnsafe(words, index);
    if (word.data === null) return yield* fail("invalid-token-length");
    const current = yield* Ref.get(state);
    yield* update({ offset: current.offset + word.source.value.pythonLength });
    // Python compares the original word: dataclass token objects do not equal a bare comma string.
    if (word.kind === "Text" && word.source.value.text === ",") return Step.Enum.continue;
    const plaintiff = current.vTokenIndex !== null && (yield* predicates.isNonblank(word.source.value));
    yield* update({
      caseNameLength: current.caseNameLength + 1,
      plaintiffLength: current.plaintiffLength + (plaintiff ? 1 : 0),
    });
    return Step.Enum.next;
  });
  const early = Effect.fn("Citation.scanEarlyCaseNameBoundary")(function* (index: number) {
    const word = A.getUnsafe(words, index);
    if (word.kind === "CitationToken") {
      yield* update({ titleStartingIndex: index - 1 });
      return Step.Enum.continue;
    }
    const text = word.source.value.text;
    if (Str.endsWith(";")(text) || Str.endsWith("”")(text) || Str.endsWith('"')(text)) {
      yield* extract(index + 2);
      return Step.Enum.stop;
    }
    const year = yield* match("year", word.source.value.storage);
    if (O.isNone(year)) return Step.Enum.next;
    const preCiteYear = yield* word.source.slice({ start: 1, end: 5 }, () => Effect.void);
    yield* update({ titleStartingIndex: index - 1, preCiteYear });
    return Step.Enum.continue;
  });
  const parenthesis = Effect.fn("Citation.scanCaseNameParenthesis")(function* (index: number) {
    const word = A.getUnsafe(words, index).source.value;
    const current = yield* Ref.get(state);
    if (!Str.startsWith("(")(word.text) || current.caseNameLength <= 3) return Step.Enum.next;
    const second = word.pythonLength > 1 ? citationPythonPointAt(word.storage, 1) : undefined;
    const skip =
      word.pythonLength === 1 || (second !== undefined && predicates.isAlpha(second) && predicates.isLower(second));
    yield* extract(skip ? index + 2 : index);
    return Step.Enum.stop;
  });
  const afterV = Effect.fn("Citation.scanCaseNameAfterV")(function* (index: number) {
    const word = A.getUnsafe(words, index);
    const current = yield* Ref.get(state);
    if (!(yield* predicates.isLowercaseAfterV(word.source.value, current.vTokenIndex !== null))) return Step.Enum.next;
    const candidate = yield* extract(index + 2);
    const candidateCaseName = yield* removePrefix("connectorSpace", candidate);
    yield* update({ candidateCaseName });
    return Step.Enum.stop;
  });
  const vToken = Effect.fn("Citation.scanCaseNameVToken")(function* (index: number) {
    const word = A.getUnsafe(words, index);
    if (word.kind === "PlaceholderCitationToken") {
      yield* update({ titleStartingIndex: index - 1 });
      return Step.Enum.continue;
    }
    if (word.kind === "StopWordToken") {
      const stop = yield* Effect.fromOption(word.stopWord, () => fail("missing-stop-word"));
      if (stop === "v") {
        yield* update({ vTokenIndex: index });
        yield* extract(index - 2);
        return Step.Enum.continue;
      }
    }
    const current = yield* Ref.get(state);
    const abbreviation = yield* predicates.isCapitalizedAbbreviation(
      word.source.value,
      current.vTokenIndex !== null,
      current.plaintiffLength
    );
    if (!abbreviation && word.kind !== "StopWordToken") return Step.Enum.next;
    yield* extract(index + 2);
    return Step.Enum.stop;
  });
  const withoutV = Effect.fn("Citation.scanCaseNameWithoutV")(function* (index: number) {
    const word = A.getUnsafe(words, index);
    const current = yield* Ref.get(state);
    if (!(yield* predicates.isLowercaseWithoutV(word.source.value, current.vTokenIndex !== null)))
      return Step.Enum.next;
    if (word.source.value.text === "ex" || word.source.value.text === "rel.") return Step.Enum.continue;
    if (word.kind === "SupraToken") {
      yield* update({ titleStartingIndex: index - 1 });
      return Step.Enum.continue;
    }
    const candidate = yield* extract(index + 2);
    const capital = yield* match("capitalized", candidate);
    const candidateCaseName = O.isNone(capital)
      ? null
      : yield* capital.value.source.slice(
          { start: capital.value.span.start, end: capital.value.source.value.pythonLength },
          () => Effect.void
        );
    yield* update({ candidateCaseName });
    return Step.Enum.stop;
  });
  const beginning = Effect.fn("Citation.scanCaseNameBeginning")(function* (index: number) {
    if (index !== 0) return Step.Enum.next;
    const candidate = yield* extract(0);
    const stripped = yield* removePrefix("connectorBoundary", candidate);
    const digits = yield* match("trailingDigits", stripped);
    yield* update({ candidateCaseName: O.isSome(digits) ? null : stripped });
    return Step.Enum.next;
  });
  const handlers = [accumulate, early, parenthesis, afterV, vToken, withoutV, beginning];
  const step = Effect.fn("Citation.advanceCaseNameScan")(function* (index: number) {
    if (index < 0 || index >= words.length) return yield* fail("index-out-of-range");
    for (const handler of handlers) {
      const result = yield* handler(index);
      if (result !== Step.Enum.next) return result;
    }
    return Step.Enum.next;
  });
  for (let index = request.index - 1; index > Num.max(request.index - 28, -1); index--) {
    const result = yield* step(index);
    if (result === Step.Enum.stop) break;
  }
  return yield* Ref.get(state);
});
const copyConfiguration = Effect.fn("Citation.copyCaseNameScanConfiguration")(function* (
  limits: CitationEngineLimits,
  decoded: CitationCaseNameScanConfiguration
) {
  const owned = yield* copyCitationMetadataPatternConfiguration(
    limits,
    Patterns,
    decoded.patterns,
    decoded.bindings,
    fingerprints,
    () => fail("invalid-configuration")
  );
  return CitationCaseNameScanConfiguration.make(owned);
});
/** Capture fixed patterns and existing operation/runtime ownership. Every scan
 * gets fresh Ref state and a native Scope under one budget/admission/deadline.
 * Returned methods have R = never. Custom initial dict/protocol behavior remains
 * separate from this built-in default-initialization path.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCaseNameScan = makeCitationMetadataStage({
  method: "scan",
  schema: Config,
  invalid: () => fail("invalid-configuration"),
  own: copyConfiguration,
  prepare: (limits, runtime, config, raw) =>
    runScan(limits, runtime, config, raw).pipe(
      Effect.catchTag("CitationCaseNamePredicateFailure", () => Effect.fail(fail("empty-word")))
    ),
  project: (state, reservedUnits) => CitationCaseNameScanResult.make({ state, reservedUnits }),
});
