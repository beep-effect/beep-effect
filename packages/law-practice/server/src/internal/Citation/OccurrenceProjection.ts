/** Canonical source evidence for builtin raw-to-semantic extraction results.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { convertTextOffsetRange, TextOffsetRange } from "@beep/langextract/VerifiedSpan";
import { Citation, CitationMention } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  VerifiedSourceText,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { projectCitationExtractionSelection } from "./ExtractionSelection.ts";
import { makeCitationMention } from "./Mention.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { measureCitationPythonText } from "./PythonHash.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { CitationSemanticExtractionResult } from "./SemanticExtraction.ts";
import { snapshotCitationValue } from "./Snapshot.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/OccurrenceProjection");
const Reason = LiteralKit(["invalid-configuration", "invalid-input", "source-mismatch", "unverifiable-source"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed occurrence adaptation failures without source or nested causes." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationOccurrenceProjectionFailure extends S.TaggedError<
  CitationOccurrenceProjectionFailure,
  { readonly brand: unique symbol }
>($I`CitationOccurrenceProjectionFailure`)(
  "CitationOccurrenceProjectionFailure",
  { reason: Reason },
  $I.annoteError<CitationOccurrenceProjectionFailure>("CitationOccurrenceProjectionFailure", {
    description: "Occurrence adaptation failed without partial output or source-bearing diagnostics.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationOccurrenceProjectionFailure.make({ reason });
const UnverifiedReason = LiteralKit(["shortcut", "invalid-span", "native-point-layout"]).pipe(
  $I.annoteSchema("UnverifiedReason", {
    description: "Semantic objects retained explicitly when no canonical source occurrence can be asserted.",
  })
);
const Unverified = S.Struct({ index: S.Natural, citation: Citation, reason: UnverifiedReason }).pipe(
  $I.annoteSchema("Unverified", {
    description: "Retained semantic value and original result index without occurrence authority.",
  })
);
const Span = S.Tuple([S.Int, S.Int]).pipe(
  $I.annoteSchema("Span", { description: "Original Python point pair before canonical nonempty-range validation." })
);
const Row = S.Struct({ index: S.Natural, citation: Citation, span: Span }).pipe(
  $I.annoteSchema("Row", {
    description: "Snapshot of semantic meaning and native primary coordinates before identity work.",
  })
);
const Rows = S.Array(Row)
  .check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates))
  .pipe($I.annoteSchema("Rows", { description: "Absolute bounded ordered occurrence candidates." }));
const RowsJson = S.fromJsonString(Rows);
const Input = S.Struct({ source: VerifiedSourceText, result: S.toType(CitationSemanticExtractionResult) }).pipe(
  $I.annoteSchema("Input", {
    description: "Real canonical source capability and completed private semantic extraction.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationOccurrenceProjectionConfiguration extends S.Opaque<
  CitationOccurrenceProjectionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ engineArtifact: Sha256Hex }).pipe(
    $I.annoteSchema("CitationOccurrenceProjectionConfiguration", {
      description: "Trusted server-supplied engine artifact identity, never derived from request citation values.",
    })
  )
) {}
const Configuration = S.toType(CitationOccurrenceProjectionConfiguration);
const decodeRange = S.decodeResult(TextOffsetRange);
/** @internal @category models @since 0.0.0 */
export class CitationOccurrenceProjectionResult extends S.Opaque<
  CitationOccurrenceProjectionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    mentions: S.Array(CitationMention).check(S.isMaxLength(CitationEngineAbsoluteMaxima.mentions)),
    unverified: S.Array(Unverified).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationOccurrenceProjectionResult", {
      description:
        "Verified primary occurrences and explicitly unverified semantic objects; full-span/components, warnings and final document adaptation remain separate.",
    })
  )
) {}
const own = Effect.fn("Citation.ownOccurrenceProjection")(
  (_limits: CitationEngineLimits, configuration: typeof Configuration.Type) => Effect.succeed(configuration)
);
const snapshotRows = Effect.fn("Citation.snapshotOccurrenceRows")(function* (result: CitationSemanticExtractionResult) {
  const models =
    result.raw.outcome._tag === "Shortcut"
      ? result.raw.outcome.citations
      : A.map(result.raw.outcome.result.extraction.extraction.citations, (entry) => entry.model);
  if (models.length !== result.citations.length) return yield* fail("invalid-input");
  const rows = yield* Effect.forEach(
    A.zip(models, result.citations),
    Effect.fnUntraced(function* ([model, citation], index) {
      const selected = yield* projectCitationExtractionSelection(index, model);
      return { index, citation, span: selected.span };
    }),
    { concurrency: 1 }
  );
  return yield* snapshotCitationValue(RowsJson, rows, () => fail("invalid-input"));
});
const anchor = Effect.fn("Citation.verifyOccurrenceSpan")(function* (
  source: VerifiedSourceText,
  span: typeof Span.Type
) {
  const decoded = decodeRange({ start: span[0], end: span[1], unit: "unicode-code-point" });
  if (Result.isFailure(decoded)) return O.none();
  const converted = yield* convertTextOffsetRange(decoded.success, source.sourceText).pipe(
    Effect.asSome,
    Effect.catchTag("VerifiedSpanError", (error) =>
      error.reason === "invalid-offset" || error.reason === "absent-text"
        ? Effect.succeedNone
        : Effect.fail(fail("unverifiable-source"))
    )
  );
  if (O.isNone(converted)) return O.none();
  const range = converted.value;
  const budget = yield* CitationTextBudget;
  yield* budget.reserve(range.endChar - range.startChar);
  const quote = Str.slice(range.startChar, range.endChar)(source.sourceText);
  const proof = yield* verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({
      verifiedSource: source,
      anchor: TextAnchor.make({ ...range, quote }),
    })
  ).pipe(Effect.mapError(() => fail("unverifiable-source")));
  return O.some(proof);
});
const unverifiedRows = (rows: typeof Rows.Type, reason: typeof UnverifiedReason.Type) =>
  A.map(rows, (row) => ({ index: row.index, citation: row.citation, reason }));
const sourceCorresponds = Effect.fn("Citation.checkOccurrenceSource")(function* (
  limits: CitationEngineLimits,
  source: VerifiedSourceText,
  result: CitationSemanticExtractionResult
) {
  const text = source.sourceText;
  if (result.raw.outcome._tag === "Shortcut") {
    if (text !== "eyecite") return yield* fail("source-mismatch");
    return false;
  }
  const budget = yield* CitationTextBudget;
  const unicode = yield* makeCitationPythonUnicode(limits);
  const native = yield* unicode.fromStorageReserved(
    result.raw.outcome.result.extraction.tokenizer.source,
    budget.reserve
  );
  if (native.text !== text) return yield* fail("source-mismatch");
  const [, points] = yield* measureCitationPythonText(text);
  return points === native.pythonLength;
});
const projectRows = Effect.fn("Citation.projectOccurrenceRows")(function* (
  limits: CitationEngineLimits,
  source: VerifiedSourceText,
  engineArtifact: Sha256Hex,
  rows: typeof Rows.Type
) {
  const mentions = A.empty<CitationMention>();
  const unverified = A.empty<typeof Unverified.Type>();
  for (const row of rows) {
    const proof = yield* anchor(source, row.span);
    if (O.isNone(proof)) {
      unverified.push({ index: row.index, citation: row.citation, reason: "invalid-span" });
      continue;
    }
    if (mentions.length >= limits.mentions)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "mentions" });
    const mention = yield* makeCitationMention({
      citation: row.citation,
      engineArtifact: engineArtifact,
      anchor: proof.value,
      components: [],
      footnote: O.none(),
      signal: O.none(),
      warnings: [],
      evidenceConfidence: O.none(),
    });
    mentions.push(mention);
  }
  return { mentions, unverified };
});
const prepare = Effect.fn("Citation.projectVerifiedOccurrences")(function* (
  limits: CitationEngineLimits,
  _runtime: CitationNativeProcessRuntime,
  configuration: typeof Configuration.Type,
  raw: unknown
) {
  const input = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  if (Str.length(input.source.sourceText) > limits.sourceUtf16)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "sourceUtf16" });
  const rows = yield* snapshotRows(input.result);
  if (rows.length > limits.candidates)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
  const corresponds = yield* sourceCorresponds(limits, input.source, input.result);
  if (!corresponds)
    return {
      mentions: [],
      unverified: unverifiedRows(
        rows,
        input.result.raw.outcome._tag === "Shortcut" ? "shortcut" : "native-point-layout"
      ),
    };
  return yield* projectRows(limits, input.source, configuration.engineArtifact, rows);
});
/** Adapt builtin result positions only against a genuine prerequisite source
 * capability for the exact tokenizer text. Cleaning does not authorize anchors
 * into a different raw artifact. Shortcut and invalid positions remain explicit
 * unverified data. Returned project captures its dependencies and requires none.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationOccurrenceProjection = makeCitationMetadataStage({
  method: "project",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own,
  prepare,
  project: (result, reservedUnits) => CitationOccurrenceProjectionResult.make({ ...result, reservedUnits }),
});
