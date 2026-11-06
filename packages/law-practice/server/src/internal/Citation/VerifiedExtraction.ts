/** Authenticated primitive source through cleaning, semantics and occurrences.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CitationCanonicalSourceResult,
  CitationSourceRole,
  deriveCitationCanonicalSource,
  retainCitationCanonicalSource,
} from "./CanonicalSource.ts";
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
    source: CitationCanonicalSourceResult,
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
  configuration: CitationVerifiedExtractionConfiguration
) {
  const extracted = yield* ownCitationSemanticExtraction(limits, configuration.extraction);
  return { ...extracted, engineArtifact: configuration.engineArtifact };
});
const requestFor = (source: VerifiedSourceText, role: CitationSourceRole) =>
  role === "plain" ? { plain: source.sourceText, markup: null } : { plain: null, markup: source.sourceText };
const prepare = Effect.fn("Citation.extractVerifiedPrimitiveSource")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
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
    const stage = yield* makeCitationSemanticExtraction(limits, runtime, owned.config);
    const projection = yield* makeCitationOccurrenceProjection(limits, runtime, {
      engineArtifact: owned.engineArtifact,
    });
    if (O.isNone(modes)) {
      const semantic = yield* stage.extract({ plain: "eyecite" });
      const source = yield* retainCitationCanonicalSource(identity.source);
      const occurrences = yield* projection.project({ source: source.source, result: semantic });
      return { semantic, source, occurrences };
    }
    const input = modes.value;
    const semantic = yield* stage.extract({
      ...requestFor(identity.source, identity.role),
      cleanSteps: input.cleanSteps,
      container: input.container,
      removeAmbiguous: input.removeAmbiguous,
    });
    if (semantic.raw.outcome._tag !== "Document") return yield* failed("invalid-input");
    const source = yield* deriveCitationCanonicalSource(
      limits,
      owned.engineArtifact,
      identity.source,
      semantic.raw.outcome.result.extraction.tokenizer.source,
      { ...input, role: identity.role }
    );
    const occurrences = yield* projection.project({ source: source.source, result: semantic });
    return { semantic, source, occurrences };
  }).pipe(Effect.provideContext(owned.children));
});
/** Run from one authenticated primitive source under the same permit, deadline
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
