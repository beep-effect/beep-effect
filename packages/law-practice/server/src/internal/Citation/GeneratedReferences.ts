/** Original extract_pincited_reference_citations from eyecite 2.7.6 find.py.
 * Free Law Project, BSD-2-Clause; source-native private models only.
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
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationCaseMetadataFields } from "./CaseMetadata.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import {
  CitationReferencePatternConfiguration,
  copyCitationReferencePatternConfiguration,
  makeCitationReferencePatterns,
} from "./ReferencePatterns.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/GeneratedReferences");
const Value = S.NullOr(CitationPythonUnicodeStorage);
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "invalid-match"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed generated-reference failures without source text or partial matches.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationGeneratedReferenceFailure extends S.TaggedError<
  CitationGeneratedReferenceFailure,
  { readonly brand: unique symbol }
>($I`CitationGeneratedReferenceFailure`)(
  "CitationGeneratedReferenceFailure",
  { reason: Reason },
  $I.annoteError<CitationGeneratedReferenceFailure>("CitationGeneratedReferenceFailure", {
    description: "Reference construction failed without source, names, captures or nested causes.",
  })
) {}
/** Complete fresh original ReferenceCitation state before any Document attachment.
 * @internal @category models @since 0.0.0
 */
export class CitationGeneratedReference extends S.Opaque<
  CitationGeneratedReference,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("ReferenceCitation", {
    index: S.tag(0),
    documentAttached: S.tag(false),
    token: CitationTokenSeed,
    spanStart: S.Int,
    spanEnd: S.Int,
    fullSpanStart: S.Int,
    fullSpanEnd: S.Int,
    metadata: S.Struct({
      pinCite: Value,
      parenthetical: Value,
      pinCiteSpanStart: S.NullOr(S.Int),
      pinCiteSpanEnd: S.NullOr(S.Int),
      plaintiff: Value,
      defendant: Value,
      resolvedCaseNameShort: Value,
      resolvedCaseName: Value,
    }),
  }).pipe(
    $I.annoteSchema("CitationGeneratedReference", {
      description:
        "Original generated name/pincite reference with native token, all metadata slots and unverified Python spans.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationGeneratedReferenceInput extends S.Opaque<
  CitationGeneratedReferenceInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: CitationPythonUnicodeStorage,
    offset: CitationTokenSeed.fields.end,
    metadata: CitationCaseMetadataFields,
  }).pipe(
    $I.annoteSchema("CitationGeneratedReferenceInput", {
      description: "Original plain Document text, citation.span end and native full-case name metadata.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationGeneratedReferencesResult extends S.Opaque<
  CitationGeneratedReferencesResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    references: S.Array(CitationGeneratedReference).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationGeneratedReferencesResult", {
      description: "Atomically completed generated references and enclosing operation text usage.",
    })
  )
) {}
const Input = S.toType(CitationGeneratedReferenceInput);
const Configuration = S.toType(CitationReferencePatternConfiguration);
const fail = (reason: typeof Reason.Type) => CitationGeneratedReferenceFailure.make({ reason });
const prepare = Effect.fn("Citation.extractPincitedReferences")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationReferencePatternConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const builder = yield* makeCitationReferencePatterns(limits, config);
  const pattern = yield* builder.build(request.metadata, "pin");
  if (O.isNone(pattern)) return A.empty<CitationGeneratedReference>();
  const input = yield* makeCitationRegexInput(limits, "source");
  const plain = yield* input.prepareUnicode(request.plain, () => Effect.void);
  const length = plain.value.pythonLength;
  const start = Num.max(0, Num.min(length, request.offset < 0 ? length + request.offset : request.offset));
  const remainder = yield* plain.slice({ start, end: length }, () => Effect.void);
  const worker = yield* makeCitationRegexWorker(limits, runtime, [pattern.value.descriptor]);
  const evaluated = yield* worker.evaluate(pattern.value.pattern, remainder, pattern.value.descriptor.flags);
  if (evaluated.result.matches === 0) return A.empty<CitationGeneratedReference>();
  if (evaluated.result.matches > limits.candidates)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
  return yield* Effect.forEach(
    A.makeBy(evaluated.result.matches, (index) => index),
    Effect.fnUntraced(function* (index) {
      const whole = yield* evaluated.result.capture(index, 0);
      if (whole._tag === "Unmatched") return yield* fail("invalid-match");
      const data = yield* evaluated.source.slice(whole, () => Effect.void);
      const named = yield* Effect.forEach(
        R.toEntries(pattern.value.descriptor.profile.names),
        Effect.fnUntraced(function* ([name, group]) {
          const capture = yield* evaluated.result.capture(index, group);
          const value = capture._tag === "Unmatched" ? null : yield* evaluated.source.slice(capture, () => Effect.void);
          return Tuple.make(name, value);
        }),
        { concurrency: 1 }
      );
      const values = R.fromEntries(named);
      const first = whole.start + request.offset;
      const last = whole.end + request.offset;
      return CitationGeneratedReference.make({
        token: CitationTokenSeed.make({
          kind: "CaseReferenceToken",
          data,
          start: first,
          end: last,
          groups: {},
          exact: [],
          variation: [],
          short: false,
        }),
        spanStart: first,
        spanEnd: last,
        fullSpanStart: first,
        fullSpanEnd: last,
        metadata: {
          pinCite: O.getOrNull(R.get(values, "pin_cite")),
          parenthetical: null,
          pinCiteSpanStart: null,
          pinCiteSpanEnd: null,
          plaintiff: O.getOrNull(R.get(values, "plaintiff")),
          defendant: O.getOrNull(R.get(values, "defendant")),
          resolvedCaseNameShort: O.getOrNull(R.get(values, "resolved_case_name_short")),
          resolvedCaseName: O.getOrNull(R.get(values, "resolved_case_name")),
        },
      });
    }),
    { concurrency: 1 }
  );
});
/** Run original plain-name reference generation through shared admission, captured
 * Scope/deadline/text authority, existing typed regex RPC and retirement barrier.
 * No partial references publish; markup generation and whole-loop assembly follow.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationGeneratedReferences = makeCitationMetadataStage({
  method: "pincited",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own: copyCitationReferencePatternConfiguration,
  prepare,
  project: (references, reservedUnits) => CitationGeneratedReferencesResult.make({ references, reservedUnits }),
});
