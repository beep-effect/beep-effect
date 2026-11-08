/** Genuine raw-source annotation through the existing admitted native entry.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAnnotationMode,
  CitationEngineAnnotationInput,
  CitationEngineAnnotationResult,
  CitationEngineReport,
  CitationInputError,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { O as OptionUtils } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { captureCitationAnnotationReservation, failCitationAnnotationUnicode } from "./AnnotationBudget.ts";
import {
  CitationAnnotationEntryConfiguration,
  ownCitationAnnotationEntry,
  ownCitationAnnotationReplacements,
  prepareCitationAnnotationEntry,
} from "./AnnotationEntry.ts";
import { failCitationAnnotationBoundary } from "./AnnotationFailure.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { CitationRegexOperation, decodeCitationRegexPolicy } from "./RegexPolicy.ts";
import { snapshotCitationValue } from "./Snapshot.ts";
import { makeCitationSourceEvidence } from "./SourceEvidence.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SourceAnnotation");
const invalid = () => CitationInputError.make({ operation: "annotate" });
const Slot = S.Struct({ source: SourceTextIdentity, sourceText: S.String }).pipe(
  $I.annoteSchema("Slot", {
    description: "Canonical source identity and raw text; effective size is checked before resolution.",
  })
);
const SourceJson = SourceTextIdentity.pipe(S.toCodecJson, S.fromJsonString);
const Mode = S.Struct({
  mode: CitationAnnotationMode.pipe(S.withDecodingDefaultKey(Effect.succeed("unchecked"))),
  useDmp: CitationEngineAnnotationInput.fields.useDmp,
}).pipe($I.annoteSchema("Mode", { description: "Annotation policy inspected before source and replacement fields." }));
const Markup = S.Struct({ markup: S.NullOr(Slot).pipe(S.withDecodingDefaultKey(Effect.succeed(null))) }).pipe(
  $I.annoteSchema("Markup", {
    description: "Optional raw source_text component for original HTML mapping or supplied updater.",
  })
);
const Plain = S.Struct({ plain: Slot }).pipe(
  $I.annoteSchema("Plain", { description: "Raw plain text; ignored when a captured supplied updater selects markup." })
);
const EvidenceFields: {
  readonly source: S.Codec<VerifiedSourceText>;
  readonly companion: S.Codec<VerifiedSourceText | null>;
} = {
  source: CitationEngineAnnotationResult.fields.source,
  companion: CitationEngineAnnotationResult.fields.companion,
};
/** Runtime source capabilities remain genuine verifier output, separate from
 * rendered native text. This is a private composition result, not a wire codec.
 * @internal @category models @since 0.0.0
 */
export class CitationSourceAnnotationResult extends S.Opaque<
  CitationSourceAnnotationResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...EvidenceFields,
    text: CitationPythonUnicodeStorage,
    reservedUnits: S.Natural,
    workDuration: CitationEngineReport.fields.workDuration,
  }).pipe(
    $I.annoteSchema("CitationSourceAnnotationResult", {
      description: "Verified selected source, optional companion and completed annotation output.",
    })
  )
) {}
const own = Effect.fn("Citation.ownSourceAnnotation")(function* (
  limits: CitationEngineLimits,
  configuration: CitationAnnotationEntryConfiguration
) {
  const annotation = yield* ownCitationAnnotationEntry(limits, configuration);
  const evidence = yield* makeCitationSourceEvidence(limits);
  return { annotation, evidence };
});
const captureSlot = Effect.fn("Citation.captureAnnotationSourceSlot")(function* (
  limits: CitationEngineLimits,
  raw: typeof Slot.Type | null
) {
  if (raw === null) return null;
  const sourceText = raw.sourceText;
  if (Str.length(sourceText) > limits.sourceUtf16)
    return yield* CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "sourceUtf16" });
  const source = yield* snapshotCitationValue(SourceJson, raw.source, invalid);
  return { source, sourceText };
});
const captureRequest = Effect.fn("Citation.captureAnnotationRequest")(function* (
  limits: CitationEngineLimits,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  const mode = yield* S.decodeUnknownEffect(Mode)(raw).pipe(Effect.mapError(invalid));
  const decodedMarkup = yield* S.decodeUnknownEffect(Markup)(raw).pipe(Effect.mapError(invalid));
  const markup = yield* captureSlot(limits, decodedMarkup.markup);
  const plain = O.isSome(owned.annotation.updater)
    ? null
    : yield* S.decodeUnknownEffect(Plain)(raw).pipe(
        Effect.mapError(invalid),
        Effect.flatMap((input) => captureSlot(limits, input.plain))
      );
  if (plain === null && markup === null) return yield* invalid();
  const replacements = yield* ownCitationAnnotationReplacements(limits, raw);
  return { mode: mode.mode, useDmp: mode.useDmp, plain, markup, replacements };
});
const resolveSources = Effect.fn("Citation.resolveAnnotationSources")(function* (
  owned: Effect.Success<ReturnType<typeof own>>,
  request: Effect.Success<ReturnType<typeof captureRequest>>
) {
  const plain = request.plain === null ? null : yield* owned.evidence.resolve(request.plain);
  const markup = request.markup === null ? null : yield* owned.evidence.resolve(request.markup);
  const source = markup !== null && (O.isSome(owned.annotation.updater) || markup.sourceText !== "") ? markup : plain;
  if (source === null) return yield* invalid();
  return { plain, markup, source, companion: source === markup ? plain : markup };
});
const nativeSources = Effect.fn("Citation.prepareAnnotationNativeSources")(function* (
  limits: CitationEngineLimits,
  sources: Effect.Success<ReturnType<typeof resolveSources>>
) {
  const unicode = yield* makeCitationPythonUnicode(limits, "annotate").pipe(Effect.mapError(invalid));
  const reserve = yield* captureCitationAnnotationReservation;
  const word = Effect.fn("Citation.prepareVerifiedAnnotationWord")(function* (proof: VerifiedSourceText | null) {
    if (proof === null) return O.none();
    const native = yield* unicode
      .fromTextReserved(proof.sourceText, reserve)
      .pipe(
        Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
          failCitationAnnotationUnicode(limits, invalid, error)
        )
      );
    return O.some(native.storage);
  });
  const plain = yield* word(sources.plain);
  const source = yield* word(sources.markup);
  return OptionUtils.getSomesStruct({ plain, source });
});
const prepare = Effect.fn("Citation.annotateResolvedSource")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  const [workDuration, result] = yield* Effect.timed(
    Effect.gen(function* () {
      const request = yield* captureRequest(limits, owned, raw);
      const sources = yield* resolveSources(owned, request);
      const native = yield* nativeSources(limits, sources);
      const text = yield* prepareCitationAnnotationEntry(limits, runtime, owned.annotation, {
        mode: request.mode,
        useDmp: request.useDmp,
        ...native,
        replacements: request.replacements,
      });
      return { source: sources.source, companion: sources.companion, text };
    })
  );
  return { ...result, workDuration };
});
const install = makeCitationMetadataStage({
  method: "annotate",
  schema: S.toType(CitationAnnotationEntryConfiguration),
  invalid,
  own,
  prepare,
  project: (patch: Effect.Success<ReturnType<typeof prepare>>, reservedUnits: number) =>
    CitationSourceAnnotationResult.make({ ...patch, reservedUnits }),
});
/** Admission precedes resolution and spans complete source verification,
 * mapping and annotation with one deadline, Scope and allocation budget.
 * Callback/updater ports are captured at installation; annotate has R=never.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourceAnnotation = Effect.fn("Citation.makeSourceAnnotation")(
  function* (policy: unknown, runtime: unknown, configuration: unknown) {
    const limits = yield* decodeCitationRegexPolicy(policy, invalid);
    const stage = yield* install(limits, runtime, configuration);
    return {
      annotate: Effect.fn("Citation.annotateSourceBoundary")((raw: unknown) =>
        stage.annotate(raw).pipe(Effect.catch((error) => failCitationAnnotationBoundary(limits, error)))
      ),
    };
  },
  Effect.provideService(CitationRegexOperation, "annotate")
);
