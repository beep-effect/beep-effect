/** Authenticated primitive source through cleaning, semantics and occurrences.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineSourceEvidence, CitationSourceRole } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { O } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { deriveCitationCanonicalSource, retainCitationCanonicalSource } from "./CanonicalSource.ts";
import { CitationExtractionEntryInput } from "./ExtractionEntry.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationOccurrenceProjectionResult, makeCitationOccurrenceProjection } from "./OccurrenceProjection.ts";
import {
  CitationSemanticExtractionConfiguration,
  CitationSemanticExtractionResult,
  makeCitationSemanticExtraction,
  ownCitationSemanticExtraction,
} from "./SemanticExtraction.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/VerifiedExtraction");
const Reason = LiteralKit(["invalid-configuration", "invalid-input"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed verified extraction boundary failures without request values or partial output.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationVerifiedExtractionFailure extends S.TaggedError<
  CitationVerifiedExtractionFailure,
  { readonly brand: unique symbol }
>($I`CitationVerifiedExtractionFailure`)(
  "CitationVerifiedExtractionFailure",
  { reason: Reason },
  $I.annoteError<CitationVerifiedExtractionFailure>("CitationVerifiedExtractionFailure", {
    description: "Verified extraction failed without input text or nested source causes.",
  })
) {}
const failed = (reason: typeof Reason.Type) => CitationVerifiedExtractionFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationVerifiedExtractionConfiguration extends S.Opaque<
  CitationVerifiedExtractionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ extraction: CitationSemanticExtractionConfiguration, engineArtifact: Sha256Hex }).pipe(
    $I.annoteSchema("CitationVerifiedExtractionConfiguration", {
      description: "Captured complete extraction configuration and trusted engine artifact identity.",
    })
  )
) {}
const Configuration = S.toType(CitationVerifiedExtractionConfiguration);
const IdentityInput = S.Struct({ source: VerifiedSourceText, role: CitationSourceRole }).pipe(
  $I.annoteSchema("IdentityInput", {
    description: "Authenticated primitive source and argument role, inspected before shortcut-ignored modes.",
  })
);
const Input = S.Struct({
  companion: S.optionalKey(VerifiedSourceText),
  cleanSteps: CitationExtractionEntryInput.fields.cleanSteps,
  container: CitationExtractionEntryInput.fields.container,
  removeAmbiguous: CitationExtractionEntryInput.fields.removeAmbiguous,
}).pipe(
  $I.annoteSchema("Input", {
    description: "Named modes snapshotted before extraction work; request data carries no callbacks.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationVerifiedExtractionResult extends S.Opaque<
  CitationVerifiedExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    source: CitationEngineSourceEvidence,
    inputs: S.Struct({ plain: S.NullOr(SourceTextIdentity), markup: S.NullOr(SourceTextIdentity) }),
    semantic: CitationSemanticExtractionResult,
    occurrences: CitationOccurrenceProjectionResult,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationVerifiedExtractionResult", {
      description:
        "One atomically completed authenticated source, semantic extraction and verified occurrence adaptation with cumulative allocation accounting.",
    })
  )
) {}
const own = Effect.fn("Citation.ownVerifiedExtraction")(function* (
  limits: CitationEngineLimits,
  configuration: CitationVerifiedExtractionConfiguration,
  runtime: CitationNativeProcessRuntime
) {
  const extracted = yield* ownCitationSemanticExtraction(limits, configuration.extraction);
  return yield* Effect.gen(function* () {
    // Installed once; an install failure surfaces where each request used to install it.
    const stage = yield* Effect.exit(makeCitationSemanticExtraction(limits, runtime, extracted.config));
    const projection = yield* Effect.exit(
      makeCitationOccurrenceProjection(limits, runtime, { engineArtifact: configuration.engineArtifact })
    );
    return { ...extracted, engineArtifact: configuration.engineArtifact, stage, projection };
  }).pipe(Effect.provideContext(extracted.children));
});
const sourcesFor = (source: VerifiedSourceText, role: CitationSourceRole, companion: VerifiedSourceText | null) =>
  role === "plain" ? { plain: source, markup: companion } : { plain: companion, markup: source };
const requestFor = (sources: ReturnType<typeof sourcesFor>) => ({
  plain: sources.plain === null ? null : sources.plain.sourceText,
  markup: sources.markup === null ? null : sources.markup.sourceText,
});
const identitiesFor = (sources: ReturnType<typeof sourcesFor>) => ({
  plain: sources.plain === null ? null : sources.plain.source,
  markup: sources.markup === null ? null : sources.markup.source,
});
// Original Both branch uses markup as Document.source, while tokenizer text
// remains the supplied plain value. Empty markup instead selects Plain.
const parentFor = (sources: ReturnType<typeof sourcesFor>, fallback: VerifiedSourceText) =>
  sources.markup !== null && !Str.isEmpty(sources.markup.sourceText) ? sources.markup : (sources.plain ?? fallback);
const prepare = Effect.fn("Citation.extractVerifiedPrimitiveSource")(function* (
  limits: CitationEngineLimits,
  _runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  const identity = yield* S.decodeUnknownEffect(IdentityInput)(raw).pipe(
    Effect.mapError(() => failed("invalid-input"))
  );
  const shortcut = identity.role === "plain" && identity.source.sourceText === "eyecite";
  const modes = shortcut
    ? O.none()
    : yield* S.decodeUnknownEffect(Input)(raw).pipe(
        Effect.mapError(() => failed("invalid-input")),
        Effect.asSome
      );
  return yield* Effect.gen(function* () {
    const stage = yield* owned.stage;
    const projection = yield* owned.projection;
    if (O.isNone(modes)) {
      const semantic = yield* stage.extract({ plain: "eyecite" });
      const source = yield* retainCitationCanonicalSource(identity.source);
      const occurrences = yield* projection.project({ source: source.source, result: semantic });
      return { semantic, source, occurrences, inputs: identitiesFor(sourcesFor(identity.source, "plain", null)) };
    }
    const input = modes.value;
    const sources = sourcesFor(identity.source, identity.role, input.companion ?? null);
    const parent = parentFor(sources, identity.source);
    const companion = parent === identity.source ? input.companion : identity.source;
    const role = parent === sources.markup ? "markup" : "plain";
    const semantic = yield* stage.extract({
      ...requestFor(sources),
      cleanSteps: input.cleanSteps,
      container: input.container,
      removeAmbiguous: input.removeAmbiguous,
    });
    if (semantic.raw.outcome._tag !== "Document") return yield* failed("invalid-input");
    const source = yield* deriveCitationCanonicalSource(
      limits,
      owned.engineArtifact,
      parent,
      semantic.raw.outcome.result.extraction.tokenizer.source,
      {
        ...input,
        role,
        ...O.getSomesStruct({ companion: O.map(O.fromUndefinedOr(companion), (value) => value.source) }),
      }
    );
    const occurrences = yield* projection.project({ source: source.source, result: semantic });
    return { semantic, source, occurrences, inputs: identitiesFor(sources) };
  }).pipe(Effect.provideContext(owned.children));
});
/** Run from authenticated primitive sources under the same permit, deadline
 * and cumulative budget through canonical source derivation and occurrence
 * verification. Ignored shortcut modes remain unread. The output has no partial
 * success path and returned methods require no caller services.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationVerifiedExtraction = makeCitationMetadataStage({
  method: "extract",
  schema: Configuration,
  invalid: () => failed("invalid-configuration"),
  own,
  prepare,
  project: (result, reservedUnits) => {
    const validated = CitationVerifiedExtractionResult.make({ ...result, reservedUnits });
    const restored: CitationVerifiedExtractionResult = { ...validated, semantic: result.semantic };
    return restored;
  },
});
