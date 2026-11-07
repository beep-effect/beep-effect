/** Canonical source evidence for builtin raw-to-semantic extraction results.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { convertTextOffsetRange, TextOffsetRange } from "@beep/langextract/VerifiedSpan";
import {
  Citation,
  CitationComponentAnchor,
  CitationMention,
  CitationOverlapWarning,
} from "@beep/law-practice-domain/values";
import {
  CitationEngineAbsoluteMaxima,
  CitationExtractionDiagnostics,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  VerifiedSourceText,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationExtractionLoopEntry } from "./ExtractionLoop.ts";
import { projectCitationExtractionSelection } from "./ExtractionSelection.ts";
import { makeCitationMention } from "./Mention.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { measureCitationPythonText } from "./PythonHash.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { CitationSemanticExtractionResult } from "./SemanticExtraction.ts";
import { snapshotCitationValue } from "./Snapshot.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
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
const Span = S.Tuple([S.Int, S.Int]).pipe(
  $I.annoteSchema("Span", { description: "Original Python point pair before canonical nonempty-range validation." })
);
const Row = S.Struct({
  index: S.Natural,
  modelId: S.Natural,
  citation: Citation,
  span: Span,
  fullSpan: Span,
  spanWithPincite: Span,
}).pipe(
  $I.annoteSchema("Row", {
    description:
      "Snapshot of semantic meaning, original model identity and native primary/full/pin-cite-inclusive coordinates before identity work.",
  })
);
const Rows = S.Array(Row)
  .check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates))
  .pipe($I.annoteSchema("Rows", { description: "Absolute bounded ordered occurrence candidates." }));
const WarningPair = S.Tuple([S.Natural, S.Natural]).pipe(
  $I.annoteSchema("WarningPair", { description: "Original previous/current model IDs from overlap selection." })
);
const Snapshot = S.Struct({
  rows: Rows,
  warnings: S.Array(WarningPair).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
}).pipe(
  $I.annoteSchema("Snapshot", {
    description: "Detached ordered occurrence rows and original source warning events before identity work.",
  })
);
const SnapshotJson = S.fromJsonString(Snapshot);
const Unverified = CitationExtractionDiagnostics.fields.unverified.value;
const UnverifiedReason = Unverified.fields.reason;
const ComponentIssue = CitationExtractionDiagnostics.fields.unverifiedComponents.value;
const UnboundWarning = CitationExtractionDiagnostics.fields.unboundWarnings.value;
const sameSpan = S.toEquivalence(Span);
const sameEntry = S.toEquivalence(CitationExtractionLoopEntry);
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
    ...CitationExtractionDiagnostics.fields,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationOccurrenceProjectionResult", {
      description:
        "Verified primary/full-span evidence and bound overlap warnings, with explicit unverified objects/components and unbound source events.",
    })
  )
) {}
const own = Effect.fn("Citation.ownOccurrenceProjection")(
  (_limits: CitationEngineLimits, configuration: typeof Configuration.Type) => Effect.succeed(configuration)
);
const captureReturnedModels = Effect.fn("Citation.captureReturnedOccurrenceModels")(function* (
  result: CitationSemanticExtractionResult
) {
  if (result.raw.outcome._tag === "Shortcut") return { models: result.raw.outcome.citations, ids: [0], warnings: [] };
  const loop = result.raw.outcome.result.extraction.extraction;
  const ids =
    loop.citations.length === loop.selection.selected.length ? loop.selection.selected : loop.selection.disambiguated;
  if (ids.length !== loop.citations.length || HashSet.size(HashSet.fromIterable(ids)) !== ids.length)
    return yield* fail("invalid-input");
  yield* Effect.forEach(
    A.zip(loop.citations, ids),
    Effect.fnUntraced(function* ([entry, id]) {
      const original = yield* Effect.fromOption(A.get(loop.models, id), () => fail("invalid-input"));
      if (!sameEntry(entry, original)) return yield* fail("invalid-input");
    }),
    { concurrency: 1, discard: true }
  );
  if (!A.every(loop.selection.warnings, (pair) => A.every(pair, (id) => id < loop.models.length)))
    return yield* fail("invalid-input");
  return { models: A.map(loop.citations, (entry) => entry.model), ids, warnings: loop.selection.warnings };
});
const snapshotRows = Effect.fn("Citation.snapshotOccurrenceRows")(function* (result: CitationSemanticExtractionResult) {
  const captured = yield* captureReturnedModels(result);
  if (captured.models.length !== result.citations.length) return yield* fail("invalid-input");
  const rows = yield* Effect.forEach(
    A.zip(captured.models, result.citations),
    Effect.fnUntraced(function* ([model, citation], index) {
      const modelId = yield* Effect.fromOption(A.get(captured.ids, index), () => fail("invalid-input"));
      const selected = yield* projectCitationExtractionSelection(modelId, model);
      const metadata = "outcome" in model ? model.outcome.metadata : model.metadata;
      // CitationBase.span_with_pincite uses all non-null endpoint observations,
      // including token endpoints even when explicit model spans override them.
      const start = pipe(
        model.token.start,
        Num.min(selected.span[0]),
        Num.min(metadata.pinCiteSpanStart ?? model.token.start)
      );
      const end = pipe(model.token.end, Num.max(selected.span[1]), Num.max(metadata.pinCiteSpanEnd ?? model.token.end));
      return {
        index,
        modelId,
        citation,
        span: selected.span,
        fullSpan: selected.fullSpan,
        spanWithPincite: Tuple.make(start, end),
      };
    }),
    { concurrency: 1 }
  );
  return yield* snapshotCitationValue(SnapshotJson, { rows, warnings: captured.warnings }, () => fail("invalid-input"));
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
const componentEvidence = Effect.fn("Citation.verifyOccurrenceComponent")(function* (
  source: VerifiedSourceText,
  row: typeof Row.Type,
  primary: VerifiedTextAnchor,
  name: typeof ComponentIssue.Type.name
) {
  const span = row[name];
  const proof = sameSpan(row.span, span) ? O.some(primary) : yield* anchor(source, span);
  return O.map(proof, (anchor) => CitationComponentAnchor.make({ name, anchor }));
});
const bindWarnings = (pairs: typeof Snapshot.Type.warnings, byModel: HashMap.HashMap<number, CitationMention>) => {
  let warnings = HashMap.empty<number, ReadonlyArray<CitationOverlapWarning>>();
  const unboundWarnings = A.empty<typeof UnboundWarning.Type>();
  for (const [previousModel, currentModel] of pairs) {
    const endpoints = O.all([HashMap.get(byModel, previousModel), HashMap.get(byModel, currentModel)]);
    if (O.isNone(endpoints)) {
      unboundWarnings.push({ previousModel, currentModel, reason: "unavailable-occurrence" });
      continue;
    }
    const [previous, current] = endpoints.value;
    if (previous.id === current.id) {
      unboundWarnings.push({ previousModel, currentModel, reason: "same-occurrence" });
      continue;
    }
    const prior = O.getOrElse(HashMap.get(warnings, currentModel), () => []);
    warnings = HashMap.set(
      warnings,
      currentModel,
      A.append(prior, CitationOverlapWarning.make({ previousMentionId: previous.id }))
    );
  }
  return { warnings, unboundWarnings };
};
const createMentionEvidence = Effect.fn("Citation.createOccurrenceEvidence")(function* (
  source: VerifiedSourceText,
  row: typeof Row.Type,
  primary: VerifiedTextAnchor,
  engineArtifact: Sha256Hex
) {
  const projected = yield* Effect.forEach(
    ComponentIssue.fields.name.literals,
    (name) => componentEvidence(source, row, primary, name).pipe(Effect.map((component) => ({ name, component }))),
    { concurrency: 1 }
  );
  const components = A.getSomes(A.map(projected, (entry) => entry.component));
  const issues = pipe(
    projected,
    A.filter((entry) => O.isNone(entry.component)),
    A.map((entry) => ComponentIssue.make({ index: row.index, name: entry.name }))
  );
  const mention = yield* makeCitationMention({
    citation: row.citation,
    engineArtifact: engineArtifact,
    anchor: primary,
    components,
    footnote: O.none(),
    signal: O.none(),
    warnings: [],
    evidenceConfidence: O.none(),
  });
  return { mention, issues };
});
const projectRows = Effect.fn("Citation.projectOccurrenceRows")(function* (
  limits: CitationEngineLimits,
  source: VerifiedSourceText,
  engineArtifact: Sha256Hex,
  snapshot: typeof Snapshot.Type
) {
  let byModel = HashMap.empty<number, CitationMention>();
  const modelOrder = A.empty<number>();
  const unverified = A.empty<typeof Unverified.Type>();
  const unverifiedComponents = A.empty<typeof ComponentIssue.Type>();
  for (const row of snapshot.rows) {
    const proof = yield* anchor(source, row.span);
    if (O.isNone(proof)) {
      unverified.push({ index: row.index, citation: row.citation, reason: "invalid-span" });
      continue;
    }
    if (modelOrder.length >= limits.mentions)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "mentions" });
    const created = yield* createMentionEvidence(source, row, proof.value, engineArtifact);
    const mention = created.mention;
    if (created.issues.length > limits.candidates - unverifiedComponents.length)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
    unverifiedComponents.push(...created.issues);
    byModel = HashMap.set(byModel, row.modelId, mention);
    modelOrder.push(row.modelId);
  }
  const bound = bindWarnings(snapshot.warnings, byModel);
  const mentions = A.map(modelOrder, (id) => {
    const mention = O.getOrThrow(HashMap.get(byModel, id));
    return CitationMention.make({ ...mention, warnings: O.getOrElse(HashMap.get(bound.warnings, id), () => []) });
  });
  return { mentions, unverified, unverifiedComponents, unboundWarnings: bound.unboundWarnings };
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
  const snapshot = yield* snapshotRows(input.result);
  if (snapshot.rows.length > limits.candidates)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
  const corresponds = yield* sourceCorresponds(limits, input.source, input.result);
  if (!corresponds)
    return {
      mentions: [],
      unverifiedComponents: [],
      unboundWarnings: A.map(snapshot.warnings, ([previousModel, currentModel]) =>
        UnboundWarning.make({
          previousModel,
          currentModel,
          reason: "unavailable-occurrence",
        })
      ),
      unverified: unverifiedRows(
        snapshot.rows,
        input.result.raw.outcome._tag === "Shortcut" ? "shortcut" : "native-point-layout"
      ),
    };
  return yield* projectRows(limits, input.source, configuration.engineArtifact, snapshot);
});
/** Adapt builtin result positions only against a genuine prerequisite source
 * capability for the exact tokenizer text. Cleaning does not authorize anchors
 * into a different raw artifact. Shortcut and invalid positions remain explicit
 * unverified data. Full spans share the canonical verifier; source overlap events
 * bind only distinct verified endpoints and otherwise remain explicit data.
 * Returned project captures its dependencies and requires none.
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
