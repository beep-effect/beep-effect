/** Raw single-source component to a genuine prerequisite source capability.
 * Reuses the canonical SourceTextResolver and provenance verifier.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineCleanerPlan,
  CitationEngineExtractionOptions,
  CitationEngineLimits,
  CitationEngineSourceInput,
  CitationInputError,
  CitationSafetyLimitExceeded,
  CitationSourceRole,
} from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { snapshotCitationValue } from "./Snapshot.ts";
import { makeCitationSourceEvidence } from "./SourceEvidence.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/SourceRequest");
type EvidenceFields = { readonly source: S.Codec<VerifiedSourceText> };
type CompanionFields = { readonly companion: S.optionalKey<S.Codec<VerifiedSourceText>> };
const CompanionFields: CompanionFields = { companion: S.optionalKey(VerifiedSourceText) };
const EvidenceFields: EvidenceFields = { source: VerifiedSourceText };
/** Internal runtime proof plus snapshotted named modes; not a serializable wire
 * model. Shortcut deliberately has no options to read or reconstruct.
 * @internal @category models @since 0.0.0
 */
export const CitationPreparedSourceRequest = S.TaggedUnion({
  Shortcut: { ...EvidenceFields, role: S.tag("plain") },
  Extract: {
    ...EvidenceFields,
    ...CompanionFields,
    role: CitationSourceRole,
    ...CitationEngineExtractionOptions.fields,
  },
}).pipe(
  $I.annoteSchema("CitationPreparedSourceRequest", {
    description: "A genuine resolved source capability with the original shortcut's ignored-option behavior.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationPreparedSourceRequest = typeof CitationPreparedSourceRequest.Type;
// Inspect text type/length without copying or hashing an over-limit source.
const Probe = S.Struct({
  source: SourceTextIdentity,
  sourceText: S.String,
  role: CitationEngineSourceInput.fields.role,
}).pipe($I.annoteSchema("Probe", { description: "Single raw component before effective source-size preflight." }));
const Shortcut = S.Struct({ role: S.tag("plain"), sourceText: S.tag("eyecite") }).pipe(
  $I.annoteSchema("Shortcut", { description: "Original shortcut condition over already captured source fields only." })
);
const isShortcut = S.is(Shortcut);
const Slot = S.NullOr(S.Struct({ source: Probe.fields.source, sourceText: Probe.fields.sourceText })).pipe(
  $I.annoteSchema("Slot", { description: "An optional primitive source before effective-size preflight." })
);
const PlainProbe = S.Struct({ plain: Slot.pipe(S.withDecodingDefaultKey(Effect.succeed(null))) }).pipe(
  $I.annoteSchema("PlainProbe", { description: "Plain slot inspected before shortcut-ignored fields." })
);
const MarkupProbe = S.Struct({ markup: Slot.pipe(S.withDecodingDefaultKey(Effect.succeed(null))) }).pipe(
  $I.annoteSchema("MarkupProbe", { description: "Markup slot inspected after the shortcut condition." })
);
const SourceJson = SourceTextIdentity.pipe(S.toCodecJson, S.fromJsonString);
const LimitsJson = CitationEngineLimits.pipe(S.toCodecJson, S.fromJsonString);
const inputFailure = () => CitationInputError.make({ operation: "extract" });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const prepareOptions = Effect.fn("Citation.prepareSourceRequestOptions")(function* (raw: unknown, maximum: number) {
  const decoded = yield* S.decodeUnknownEffect(CitationEngineExtractionOptions)(raw).pipe(
    Effect.mapError(inputFailure)
  );
  const selection = decoded.cleanSteps;
  if (S.is(CitationEngineCleanerPlan)(selection)) {
    return CitationEngineExtractionOptions.make({
      ...decoded,
      cleanSteps: CitationEngineCleanerPlan.make({ plan: selection.plan }),
    });
  }
  if (selection !== null && selection.length > maximum) return yield* safety("resolutionIterations");
  return CitationEngineExtractionOptions.make({
    ...decoded,
    cleanSteps: selection === null ? null : A.copy(selection),
  });
});
/** Capture resolver, digest, policy and Clock. Returned preparation has R=never.
 * Single and paired primitive profiles resolve independently verified sources.
 * Retained-Document request dispatch remains separate engine integration work.
 * The enclosing engine must admit the operation and share its total deadline
 * across source preparation and extraction; this stage has its own captured cap.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSourceRequestAdapter = Effect.fn("Citation.makeSourceRequestAdapter")(function* (
  policy: unknown
) {
  const decoded = yield* decodeCitationRegexPolicy(policy, inputFailure);
  const limits = yield* snapshotCitationValue(LimitsJson, decoded, inputFailure);
  const evidence = yield* makeCitationSourceEvidence(limits);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const resolve = Effect.fn("Citation.resolveRequestSource")((source: SourceTextIdentity, text: string) =>
    evidence.resolve({ source, sourceText: text })
  );
  const prepare: (raw: unknown) => Effect.Effect<CitationPreparedSourceRequest, CitationEngineFailure> = Effect.fn(
    "Citation.prepareSourceRequest"
  )(function* (raw: unknown) {
    const input = yield* S.decodeUnknownEffect(Probe)(raw).pipe(Effect.mapError(inputFailure));
    if (Str.length(input.sourceText) > limits.sourceUtf16) return yield* safety("sourceUtf16");
    const source = yield* snapshotCitationValue(SourceJson, input.source, inputFailure);
    const shortcut = isShortcut(input);
    const options = shortcut ? O.none() : yield* prepareOptions(raw, limits.resolutionIterations).pipe(Effect.asSome);
    const proof = yield* resolve(source, input.sourceText);
    if (O.isNone(options)) return CitationPreparedSourceRequest.cases.Shortcut.make({ source: proof });
    return CitationPreparedSourceRequest.cases.Extract.make({ source: proof, role: input.role, ...options.value });
  }, timing.timed);
  const captureSlot = Effect.fn("Citation.captureRequestSourceSlot")(function* (slot: typeof Slot.Type) {
    if (slot === null) return null;
    if (Str.length(slot.sourceText) > limits.sourceUtf16) return yield* safety("sourceUtf16");
    const source = yield* snapshotCitationValue(SourceJson, slot.source, inputFailure);
    return { source, sourceText: slot.sourceText };
  });
  const resolveSlot = (slot: Effect.Success<ReturnType<typeof captureSlot>>) =>
    slot === null ? Effect.succeed(null) : resolve(slot.source, slot.sourceText);
  const preparePair: (raw: unknown) => Effect.Effect<CitationPreparedSourceRequest, CitationEngineFailure> = Effect.fn(
    "Citation.prepareSourcePairRequest"
  )(function* (raw: unknown) {
    const first = yield* S.decodeUnknownEffect(PlainProbe)(raw).pipe(Effect.mapError(inputFailure));
    const plain = yield* captureSlot(first.plain);
    // Read only the plain slot before the original shortcut. Markup and all
    // option getters stay unread on that path.
    if (plain !== null && plain.sourceText === "eyecite") {
      const source = yield* resolve(plain.source, plain.sourceText);
      return CitationPreparedSourceRequest.cases.Shortcut.make({ source });
    }
    const second = yield* S.decodeUnknownEffect(MarkupProbe)(raw).pipe(Effect.mapError(inputFailure));
    const markup = yield* captureSlot(second.markup);
    if (plain === null && markup === null) return yield* inputFailure();
    const options = yield* prepareOptions(raw, limits.resolutionIterations);
    const plainProof = yield* resolveSlot(plain);
    const markupProof = yield* resolveSlot(markup);
    if (plainProof !== null) {
      return CitationPreparedSourceRequest.cases.Extract.make({
        source: plainProof,
        role: "plain",
        ...options,
        ...O.getSomesStruct({ companion: O.fromNullishOr(markupProof) }),
      });
    }
    if (markupProof === null) return yield* inputFailure();
    return CitationPreparedSourceRequest.cases.Extract.make({ source: markupProof, role: "markup", ...options });
  }, timing.timed);
  return { prepare, preparePair };
});
